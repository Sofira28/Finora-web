import { z } from 'zod'

import { parseMoneyInput, toMoneyInput } from '../../lib/format/index.ts'
import type { Account } from '../accounts/api.ts'
import type { Category, Transaction, TransactionBody, TransactionType } from './api.ts'
import { CATEGORIES, isCategoryAllowed } from './categories.ts'
import { TRANSACTION_MESSAGES as M } from './messages.ts'

// Caracteres de control (C0, DEL y C1): el backend los rechaza. En la nota se permiten los
// saltos de línea (VAL-TRX-08).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/
// eslint-disable-next-line no-control-regex
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const DESCRIPTION_MAX = 80
export const NOTE_MAX = 500
export const MIN_DATE = '2000-01-01'

const isPositive = (amount: string) => !amount.startsWith('-') && /[1-9]/.test(amount)

/** Valores del formulario: todo como texto. Los montos se leen con `parseMoneyInput`. */
export interface TransactionFormValues {
  type: TransactionType
  amount: string
  targetBalance: string
  date: string
  accountId: string
  destinationAccountId: string
  category: Category | ''
  description: string
  note: string
}

/**
 * Validación de ayuda al usuario (la obligatoria es la del backend), con `today` en hora de
 * Colombia para la fecha máxima (VAL-TRX-02).
 */
export function transactionFormSchema(today: string) {
  return z
    .object({
      type: z.enum(['expense', 'income', 'transfer', 'adjustment']),
      amount: z.string(),
      targetBalance: z.string(),
      date: z.string(),
      accountId: z.string(),
      destinationAccountId: z.string(),
      category: z.union([
        z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
        z.literal(''),
      ]),
      description: z.string(),
      note: z.string(),
    })
    .superRefine((values, ctx) => {
      const issue = (path: keyof TransactionFormValues, message: string) => {
        ctx.addIssue({ code: 'custom', path: [path], message })
      }
      if (values.type === 'adjustment') {
        if (parseMoneyInput(values.targetBalance) === null || !values.targetBalance.trim()) {
          issue('targetBalance', M.targetBalance)
        }
      } else {
        const amount = parseMoneyInput(values.amount)
        if (amount === null || !isPositive(amount)) issue('amount', M.amount)
      }
      // Las fechas ISO se comparan como texto.
      if (!ISO_DATE.test(values.date) || values.date < MIN_DATE || values.date > today) {
        issue('date', M.date)
      }
      if (!values.accountId) issue('accountId', M.account)
      if (values.type === 'transfer') {
        if (!values.destinationAccountId || values.destinationAccountId === values.accountId) {
          issue('destinationAccountId', M.destination)
        }
      }
      const categorized = values.type === 'expense' || values.type === 'income'
      if (categorized && (!values.category || !isCategoryAllowed(values.type, values.category))) {
        issue('category', M.category)
      }
      const description = values.description.trim()
      if (
        (categorized && !description) ||
        description.length > DESCRIPTION_MAX ||
        CONTROL.test(description)
      ) {
        issue('description', M.description)
      }
      const note = values.note.replaceAll('\r\n', '\n').trim()
      if (note.length > NOTE_MAX || CONTROL_EXCEPT_NEWLINE.test(note)) issue('note', M.note)
    })
}

/** Campo del backend → campo del formulario (para los errores `422`). */
export const SERVER_FIELDS = {
  amount: 'amount',
  target_balance: 'targetBalance',
  date: 'date',
  account_id: 'accountId',
  destination_account_id: 'destinationAccountId',
  category: 'category',
  description: 'description',
  note: 'note',
} as const satisfies Record<string, keyof TransactionFormValues>

export interface NewTransactionDefaults {
  type?: TransactionType
  accountId?: string
}

export function emptyFormValues(
  today: string,
  defaults: NewTransactionDefaults = {},
): TransactionFormValues {
  return {
    type: defaults.type ?? 'expense',
    amount: '',
    targetBalance: '',
    date: today,
    accountId: defaults.accountId ?? '',
    destinationAccountId: '',
    category: '',
    description: '',
    note: '',
  }
}

/**
 * Valores de un movimiento existente. En un ajuste, el saldo real propuesto es el saldo
 * actual de la cuenta, que ya incluye el ajuste: si no se cambia, el ajuste queda igual.
 */
export function formValuesFrom(
  transaction: Transaction,
  accounts: readonly Account[],
): TransactionFormValues {
  const account = accounts.find((item) => item.id === transaction.account_id)
  return {
    type: transaction.type,
    amount: transaction.type === 'adjustment' ? '' : toMoneyInput(transaction.amount),
    targetBalance:
      transaction.type === 'adjustment' && account ? toMoneyInput(account.balance) : '',
    date: transaction.date,
    accountId: transaction.account_id,
    destinationAccountId: transaction.destination_account_id ?? '',
    category: transaction.category ?? '',
    description: transaction.description ?? '',
    note: transaction.note ?? '',
  }
}

function money(text: string): string {
  const amount = parseMoneyInput(text)
  // El esquema ya lo validó; si no, el backend respondería 422.
  if (amount === null) throw new RangeError('Monto inválido')
  return amount
}

/**
 * Cuerpo de `POST`/`PUT` con solo los campos del tipo (`api-contracts.md` §6.3): un campo que
 * no corresponde al tipo respondería `422` (VAL-TRX-11). Los opcionales vacíos no se envían.
 */
export function transactionBody(values: TransactionFormValues): TransactionBody {
  const description = values.description.trim()
  const note = values.note.replaceAll('\r\n', '\n').trim()
  const optional = {
    ...(description ? { description } : {}),
    ...(note ? { note } : {}),
  }
  const common = { date: values.date, account_id: values.accountId }
  switch (values.type) {
    case 'expense':
    case 'income':
      return {
        type: values.type,
        amount: money(values.amount),
        ...common,
        category: values.category as Category,
        description,
        ...(note ? { note } : {}),
      }
    case 'transfer':
      return {
        type: 'transfer',
        amount: money(values.amount),
        ...common,
        destination_account_id: values.destinationAccountId,
        ...optional,
      }
    case 'adjustment':
      return {
        type: 'adjustment',
        target_balance: money(values.targetBalance),
        ...common,
        ...optional,
      }
  }
}

/**
 * Cuentas que ofrece el formulario: las activas y, al editar, las archivadas que el movimiento
 * ya tenía (RN-TRX-08), para poder editarlo sin cambiar la cuenta.
 */
export function selectableAccounts(
  accounts: readonly Account[],
  transaction?: Transaction,
): Account[] {
  const kept = new Set(
    [transaction?.account_id, transaction?.destination_account_id].filter(Boolean),
  )
  return accounts.filter((account) => !account.archived || kept.has(account.id))
}
