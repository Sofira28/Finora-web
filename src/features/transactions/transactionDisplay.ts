import type { ComponentType, SVGProps } from 'react'

import {
  AdjustmentIcon,
  ExpenseIcon,
  IncomeIcon,
  TransactionsIcon,
} from '../../components/icons/index.ts'
import { formatMoney } from '../../lib/format/index.ts'
import type { Transaction, TransactionType } from './api.ts'
import { CATEGORIES } from './categories.ts'

interface TypeInfo {
  /** Nombre en singular, debajo del monto (RNF-TRX-04: el tipo nunca solo con color). */
  label: string
  /** Nombre en plural, en el filtro por tipo. */
  plural: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Tono del ícono, como en el diseño. */
  tone: 'neg' | 'pos' | 'info' | 'lav'
}

export const TRANSACTION_TYPES: Record<TransactionType, TypeInfo> = {
  expense: { label: 'Gasto', plural: 'Gastos', icon: ExpenseIcon, tone: 'neg' },
  income: { label: 'Ingreso', plural: 'Ingresos', icon: IncomeIcon, tone: 'pos' },
  transfer: {
    label: 'Transferencia',
    plural: 'Transferencias',
    icon: TransactionsIcon,
    tone: 'info',
  },
  adjustment: { label: 'Ajuste', plural: 'Ajustes', icon: AdjustmentIcon, tone: 'lav' },
}

const isNegative = (amount: string) => amount.startsWith('-')
const isZero = (amount: string) => !/[1-9]/.test(amount)
const absolute = (amount: string) => (isNegative(amount) ? amount.slice(1) : amount)

/** Monto con signo explícito: `+ $ 1.000`, `− $ 1.000` o `$ 0`. */
export function formatSigned(amount: string): string {
  const text = formatMoney(absolute(amount), 'COP')
  if (isZero(amount)) return text
  return `${isNegative(amount) ? '−' : '+'} ${text}`
}

/**
 * Monto de un movimiento como se muestra en la lista: el ingreso suma (`+`), el gasto resta
 * (`−`), la transferencia no lleva signo (no es ingreso ni gasto) y el ajuste, el de su
 * diferencia.
 */
export function transactionAmount(transaction: Transaction): string {
  switch (transaction.type) {
    case 'income':
      return `+ ${formatMoney(transaction.amount, 'COP')}`
    case 'expense':
      return `− ${formatMoney(transaction.amount, 'COP')}`
    case 'transfer':
      return formatMoney(transaction.amount, 'COP')
    case 'adjustment':
      return formatSigned(transaction.amount)
  }
}

/** Descripción, o un texto por defecto en transferencias y ajustes sin ella (SUP-TRX-05). */
export function transactionDescription(
  transaction: Transaction,
  accountName: (id: string) => string,
): string {
  if (transaction.description) return transaction.description
  if (transaction.type === 'transfer' && transaction.destination_account_id) {
    return `Transferencia a ${accountName(transaction.destination_account_id)}`
  }
  return transaction.type === 'adjustment'
    ? 'Ajuste de saldo'
    : TRANSACTION_TYPES[transaction.type].label
}

/** Nombre y color de la categoría; transferencias y ajustes no tienen. */
export function transactionCategory(transaction: Transaction) {
  return transaction.category ? CATEGORIES[transaction.category] : null
}
