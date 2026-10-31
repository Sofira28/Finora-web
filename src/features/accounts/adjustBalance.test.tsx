import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../lib/api/index.ts'
import { json, mockApi, renderApp } from '../../test/app.tsx'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { SessionInfo } from '../auth/session/index.ts'
import type { Account, AccountList } from './api.ts'

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: false,
  user: { name: 'Ana', email: 'ana@correo.com' },
}
const SLOW = { timeout: 5000 }

function account(n: number, name: string, overrides: Partial<Account> = {}): Account {
  return {
    id: `0193f2a4-0000-7000-8000-${String(n).padStart(12, '0')}`,
    name,
    type: 'cash',
    institution: null,
    balance: '90000.00',
    opening_balance: '90000.00',
    has_movements: false,
    archived: false,
    credit_card: null,
    created_at: '2026-10-01T15:00:00Z',
    ...overrides,
  }
}

const EFECTIVO = account(1, 'Efectivo')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T15:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

/** API con estado: el ajuste cambia el saldo y los totales que devuelve `/accounts`. */
function setup(initial: Account) {
  let current = initial
  let netWorth = '14070000.00'
  const list = (): AccountList => ({
    accounts: [current],
    totals: { available_balance: current.balance, net_worth: netWorth, credit_card_debt: '0.00' },
  })
  const api = mockApi({
    'GET /auth/session': () => json(200, ACTIVE),
    'GET /accounts': () => json(200, list()),
    'POST /transactions': () => {
      // Como el backend: guarda la diferencia (75.000 − 90.000 = −15.000).
      current = { ...current, balance: '75000.00', has_movements: true }
      netWorth = '14055000.00'
      return json(201, {
        id: 't1',
        type: 'adjustment',
        amount: '-15000.00',
        date: '2026-10-31',
        account_id: current.id,
        destination_account_id: null,
        category: null,
        description: null,
        note: null,
        created_at: '2026-10-31T15:00:00Z',
        updated_at: '2026-10-31T15:00:00Z',
      })
    },
  })
  renderApp('/cuentas')
  return api
}

function totalOf(label: string): string {
  const summary = screen.getByRole('region', { name: 'Resumen' })
  const term = within(summary).getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.firstElementChild?.textContent.replace(/\s/g, ' ') ?? ''
}

describe('Ajustar saldo desde Cuentas (T-TRX-FE-04)', () => {
  it('CA-TRX-06: ajusta Efectivo a $ 75.000 y recarga saldos y totales', async () => {
    const api = setup(EFECTIVO)
    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Efectivo' }, SLOW))
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar saldo' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ajustar saldo de Efectivo' }, SLOW)
    await expectNoAxeViolations(dialog)
    expect(within(dialog).getByRole('radio', { name: 'Ajuste' })).toBeChecked()
    expect(within(dialog).getByLabelText('Cuenta')).toHaveValue(EFECTIVO.id)
    const target = within(dialog).getByLabelText('Saldo real de la cuenta')
    expect(target).toHaveAccessibleDescription(/Saldo actual en FINORA: \$\s90\.000/)

    await userEvent.type(target, '75.000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar movimiento' }))

    expect(await screen.findByText('Ajustamos el saldo de Efectivo.')).toBeVisible()
    expect(api.bodies('POST /transactions')).toEqual([
      { type: 'adjustment', target_balance: '75000', date: '2026-10-31', account_id: EFECTIVO.id },
    ])
    // Los saldos y el patrimonio vienen del backend tras el ajuste.
    await waitFor(() => {
      expect(totalOf('Patrimonio neto')).toBe('$ 14.055.000')
    })
    expect(totalOf('Saldo disponible')).toBe('$ 75.000')
  })

  it('las cuentas archivadas no ofrecen "Ajustar saldo" (RN-TRX-08)', async () => {
    setup({ ...EFECTIVO, archived: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Efectivo' }, SLOW))
    expect(screen.queryByRole('button', { name: 'Ajustar saldo' })).not.toBeInTheDocument()
  })

  it('con saldo bloqueado, el formulario de la cuenta lleva a "Ajustar saldo" (VAL-ACC-07)', async () => {
    setup({ ...EFECTIVO, has_movements: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de Efectivo' }, SLOW))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const form = screen.getByRole('dialog', { name: 'Editar Efectivo' })
    expect(within(form).getByLabelText('Saldo inicial')).toHaveAttribute('readonly')
    await userEvent.click(within(form).getByRole('button', { name: 'Ajustar saldo' }))
    expect(
      await screen.findByRole('dialog', { name: 'Ajustar saldo de Efectivo' }, SLOW),
    ).toBeVisible()
    expect(screen.queryByRole('dialog', { name: 'Editar Efectivo' })).not.toBeInTheDocument()
  })
})
