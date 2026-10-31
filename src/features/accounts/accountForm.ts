import { z } from 'zod'

import { parseMoneyInput, toMoneyInput } from '../../lib/format/index.ts'
import type { Account, AccountType, CreateAccountBody, UpdateAccountBody } from './api.ts'
import { ACCOUNT_MESSAGES as M } from './messages.ts'

// Caracteres de control (C0, DEL y C1): el backend los rechaza en nombre y entidad.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/

const DAY = /^(0?[1-9]|[12]\d|3[01])$/

/**
 * Valores del formulario: todo como texto, tal como se escribe. Los montos se convierten
 * con `parseMoneyInput`, nunca con `number`.
 */
export const accountFormSchema = z
  .object({
    type: z.enum(['bank', 'wallet', 'cash', 'savings', 'investment', 'credit_card']),
    name: z
      .string()
      .trim()
      .min(1, M.name)
      .max(60, M.name)
      .refine((value) => !CONTROL.test(value), M.name),
    institution: z
      .string()
      .trim()
      .max(60, M.institution)
      .refine((value) => !CONTROL.test(value), M.institution),
    openingBalance: z.string(),
    creditLimit: z.string(),
    statementDay: z.string(),
    paymentDueDay: z.string(),
  })
  .superRefine((values, ctx) => {
    if (parseMoneyInput(values.openingBalance) === null) {
      ctx.addIssue({ code: 'custom', path: ['openingBalance'], message: M.amount })
    }
    if (values.type !== 'credit_card') return
    const limit = parseMoneyInput(values.creditLimit)
    if (!values.creditLimit.trim()) {
      ctx.addIssue({ code: 'custom', path: ['creditLimit'], message: M.creditLimit })
    } else if (limit === null) {
      ctx.addIssue({ code: 'custom', path: ['creditLimit'], message: M.amount })
    } else if (limit.startsWith('-') || !/[1-9]/.test(limit)) {
      ctx.addIssue({ code: 'custom', path: ['creditLimit'], message: M.creditLimitPositive })
    }
    for (const field of ['statementDay', 'paymentDueDay'] as const) {
      if (!DAY.test(values[field].trim())) {
        ctx.addIssue({ code: 'custom', path: [field], message: M.day })
      }
    }
  })

export type AccountFormValues = z.infer<typeof accountFormSchema>

/** Nombre del campo del backend → campo del formulario (para los errores `422`/`409`). */
export const SERVER_FIELDS = {
  name: 'name',
  institution: 'institution',
  opening_balance: 'openingBalance',
  credit_limit: 'creditLimit',
  statement_day: 'statementDay',
  payment_due_day: 'paymentDueDay',
} as const satisfies Record<string, keyof AccountFormValues>

export function emptyFormValues(type: AccountType = 'bank'): AccountFormValues {
  return {
    type,
    name: '',
    institution: '',
    openingBalance: '0',
    creditLimit: '',
    statementDay: '',
    paymentDueDay: '',
  }
}

export function formValuesFrom(account: Account): AccountFormValues {
  const card = account.credit_card
  return {
    type: account.type,
    name: account.name,
    institution: account.institution ?? '',
    openingBalance: toMoneyInput(account.opening_balance),
    creditLimit: card ? toMoneyInput(card.credit_limit) : '',
    statementDay: card ? String(card.statement_day) : '',
    paymentDueDay: card ? String(card.payment_due_day) : '',
  }
}

function money(text: string): string {
  const amount = parseMoneyInput(text)
  // El esquema ya lo validó; si no, el backend respondería 422.
  if (amount === null) throw new RangeError('Monto inválido')
  return amount
}

function cardFields(values: AccountFormValues) {
  if (values.type !== 'credit_card') return {}
  return {
    credit_limit: money(values.creditLimit),
    statement_day: Number.parseInt(values.statementDay, 10),
    payment_due_day: Number.parseInt(values.paymentDueDay, 10),
  }
}

export function createBody(values: AccountFormValues): CreateAccountBody {
  return {
    name: values.name.trim(),
    type: values.type,
    institution: values.institution.trim() || null,
    opening_balance: money(values.openingBalance),
    ...cardFields(values),
  }
}

/** En la edición el tipo no se envía (RN-ACC-08) ni el saldo inicial si hay movimientos. */
export function updateBody(values: AccountFormValues, account: Account): UpdateAccountBody {
  return {
    name: values.name.trim(),
    institution: values.institution.trim() || null,
    ...(account.has_movements ? {} : { opening_balance: money(values.openingBalance) }),
    ...cardFields(values),
  }
}
