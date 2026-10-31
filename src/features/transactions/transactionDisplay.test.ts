import { describe, expect, it } from 'vitest'

import type { Transaction } from './api.ts'
import {
  formatSigned,
  transactionAmount,
  transactionCategory,
  transactionDescription,
} from './transactionDisplay.ts'

// Intl separa el símbolo con un espacio sin ruptura (U+00A0).
const cop = (text: string) => text.replaceAll('$ ', '$ ')

function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  return {
    id: 't1',
    date: '2026-10-30',
    account_id: 'a1',
    destination_account_id: null,
    category: null,
    description: null,
    note: null,
    created_at: '2026-10-30T15:00:00Z',
    updated_at: '2026-10-30T15:00:00Z',
    ...overrides,
  }
}

const names: Record<string, string> = { a1: 'Nómina', a2: 'Fondo de emergencia' }
const accountName = (id: string) => names[id] ?? '?'

describe('monto con signo (RNF-TRX-04)', () => {
  it('ingreso suma, gasto resta y transferencia sin signo', () => {
    expect(transactionAmount(tx({ type: 'income', amount: '3200000.00' }))).toBe(
      cop('+ $ 3.200.000'),
    )
    expect(transactionAmount(tx({ type: 'expense', amount: '120000.00' }))).toBe(cop('− $ 120.000'))
    expect(transactionAmount(tx({ type: 'transfer', amount: '500000.00' }))).toBe(cop('$ 500.000'))
  })

  it('el ajuste lleva el signo de su diferencia', () => {
    expect(transactionAmount(tx({ type: 'adjustment', amount: '-15000.00' }))).toBe(
      cop('− $ 15.000'),
    )
    expect(transactionAmount(tx({ type: 'adjustment', amount: '2500.50' }))).toBe(cop('+ $ 2.500'))
  })

  it('formatSigned: cero sin signo', () => {
    expect(formatSigned('0.00')).toBe(cop('$ 0'))
    expect(formatSigned('-500000.00')).toBe(cop('− $ 500.000'))
  })
})

describe('descripción y categoría', () => {
  it('usa la descripción si la hay', () => {
    expect(
      transactionDescription(
        tx({ type: 'expense', amount: '1.00', description: 'Mercado' }),
        accountName,
      ),
    ).toBe('Mercado')
  })

  it('transferencia sin descripción: "Transferencia a <destino>" (SUP-TRX-05)', () => {
    const transfer = tx({ type: 'transfer', amount: '1.00', destination_account_id: 'a2' })
    expect(transactionDescription(transfer, accountName)).toBe(
      'Transferencia a Fondo de emergencia',
    )
  })

  it('ajuste sin descripción: "Ajuste de saldo"', () => {
    expect(transactionDescription(tx({ type: 'adjustment', amount: '1.00' }), accountName)).toBe(
      'Ajuste de saldo',
    )
  })

  it('categoría con nombre es-CO; transferencias sin categoría', () => {
    expect(
      transactionCategory(tx({ type: 'expense', amount: '1.00', category: 'groceries' })),
    ).toEqual({
      label: 'Mercado',
      color: 'var(--c-mercado)',
    })
    expect(transactionCategory(tx({ type: 'transfer', amount: '1.00' }))).toBeNull()
  })
})
