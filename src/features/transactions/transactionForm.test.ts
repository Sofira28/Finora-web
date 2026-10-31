import { describe, expect, it } from 'vitest'

import type { Account } from '../accounts/api.ts'
import type { Transaction } from './api.ts'
import { TRANSACTION_MESSAGES as M } from './messages.ts'
import {
  emptyFormValues,
  formValuesFrom,
  selectableAccounts,
  transactionBody,
  transactionFormSchema,
  type TransactionFormValues,
} from './transactionForm.ts'

const TODAY = '2026-10-31'
const A = '0193f2a4-0000-7000-8000-000000000001'
const B = '0193f2a4-0000-7000-8000-000000000002'

const base = (overrides: Partial<TransactionFormValues>): TransactionFormValues => ({
  ...emptyFormValues(TODAY),
  accountId: A,
  ...overrides,
})

const expense = base({
  type: 'expense',
  amount: '120.000',
  category: 'groceries',
  description: ' Mercado ',
})

/** Mensajes por campo que produce el esquema. */
function errorsOf(values: TransactionFormValues): Record<string, string> {
  const result = transactionFormSchema(TODAY).safeParse(values)
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message] as const),
  )
}

describe('validación del formulario (VAL-TRX-01 a 08)', () => {
  it('un gasto completo es válido', () => {
    expect(errorsOf(expense)).toEqual({})
  })

  it.each(['', '0', '-5000', '1.000,555', 'abc'])('monto inválido: %j', (amount) => {
    expect(errorsOf({ ...expense, amount })).toEqual({ amount: M.amount })
  })

  it.each(['', '2026-11-01', '1999-12-31', '31/10/2026'])('fecha inválida: %j', (date) => {
    expect(errorsOf({ ...expense, date })).toEqual({ date: M.date })
  })

  it('acepta hoy y el 01/01/2000', () => {
    expect(errorsOf({ ...expense, date: TODAY })).toEqual({})
    expect(errorsOf({ ...expense, date: '2000-01-01' })).toEqual({})
  })

  it('exige cuenta, categoría del tipo y descripción en gastos e ingresos', () => {
    expect(errorsOf({ ...expense, accountId: '', category: '', description: '  ' })).toEqual({
      accountId: M.account,
      category: M.category,
      description: M.description,
    })
    expect(errorsOf({ ...expense, type: 'income', category: 'groceries' })).toEqual({
      category: M.category,
    })
  })

  it('descripción de hasta 80 caracteres y nota de hasta 500, con saltos de línea', () => {
    expect(errorsOf({ ...expense, description: 'a'.repeat(81) })).toEqual({
      description: M.description,
    })
    expect(errorsOf({ ...expense, note: 'a'.repeat(501) })).toEqual({ note: M.note })
    expect(errorsOf({ ...expense, note: 'Primera línea\nSegunda' })).toEqual({})
    expect(errorsOf({ ...expense, note: 'con\ttabulador' })).toEqual({ note: M.note })
  })

  it('transferencia: destino distinto del origen; sin categoría ni descripción obligatorias', () => {
    const transfer = base({ type: 'transfer', amount: '500.000', destinationAccountId: B })
    expect(errorsOf(transfer)).toEqual({})
    expect(errorsOf({ ...transfer, destinationAccountId: A })).toEqual({
      destinationAccountId: M.destination,
    })
    expect(errorsOf({ ...transfer, destinationAccountId: '' })).toEqual({
      destinationAccountId: M.destination,
    })
  })

  it('ajuste: pide el saldo real (puede ser negativo o cero), no el monto', () => {
    const adjustment = base({ type: 'adjustment', targetBalance: '-15.000' })
    expect(errorsOf(adjustment)).toEqual({})
    expect(errorsOf({ ...adjustment, targetBalance: '0' })).toEqual({})
    expect(errorsOf({ ...adjustment, targetBalance: '' })).toEqual({
      targetBalance: M.targetBalance,
    })
  })
})

describe('cuerpo de la petición (api-contracts §6.3, VAL-TRX-11)', () => {
  it('gasto: solo sus campos, montos como cadena decimal', () => {
    expect(transactionBody({ ...expense, note: '  ' })).toEqual({
      type: 'expense',
      amount: '120000',
      date: TODAY,
      account_id: A,
      category: 'groceries',
      description: 'Mercado',
    })
  })

  it('transferencia: sin categoría y sin opcionales vacíos', () => {
    expect(
      transactionBody({
        ...expense,
        type: 'transfer',
        amount: '500.000',
        destinationAccountId: B,
        description: '',
        note: 'Ahorro\r\nde octubre',
      }),
    ).toEqual({
      type: 'transfer',
      amount: '500000',
      date: TODAY,
      account_id: A,
      destination_account_id: B,
      note: 'Ahorro\nde octubre',
    })
  })

  it('ajuste: envía target_balance y no amount', () => {
    expect(
      transactionBody(base({ type: 'adjustment', amount: '9', targetBalance: '-15.000,5' })),
    ).toEqual({ type: 'adjustment', target_balance: '-15000.5', date: TODAY, account_id: A })
  })
})

function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    type: 'bank',
    institution: null,
    balance: '2800000.00',
    opening_balance: '0.00',
    has_movements: true,
    archived: false,
    credit_card: null,
    created_at: '2026-10-01T15:00:00Z',
    ...overrides,
  }
}

const tx: Transaction = {
  id: 't1',
  type: 'adjustment',
  amount: '-15000.00',
  date: '2026-10-20',
  account_id: A,
  destination_account_id: null,
  category: null,
  description: null,
  note: null,
  created_at: '2026-10-20T15:00:00Z',
  updated_at: '2026-10-20T15:00:00Z',
}

describe('edición', () => {
  it('un ajuste propone como saldo real el saldo actual (sin cambios, el ajuste queda igual)', () => {
    expect(formValuesFrom(tx, [account(A)])).toMatchObject({
      type: 'adjustment',
      amount: '',
      targetBalance: '2.800.000',
      date: '2026-10-20',
    })
  })

  it('ofrece las activas y las archivadas que el movimiento ya tenía (RN-TRX-08)', () => {
    const archived = account(A, { archived: true })
    const otherArchived = account('c', { archived: true })
    const active = account(B)
    const all = [archived, otherArchived, active]
    expect(selectableAccounts(all)).toEqual([active])
    expect(selectableAccounts(all, tx)).toEqual([archived, active])
  })
})
