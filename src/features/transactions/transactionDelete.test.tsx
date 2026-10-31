import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../lib/api/index.ts'
import { json, mockApi, problem, renderApp } from '../../test/app.tsx'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { Account } from '../accounts/api.ts'
import type { SessionInfo } from '../auth/session/index.ts'
import type { Transaction, TransactionPage } from './api.ts'
import { TRANSACTION_MESSAGES as M } from './messages.ts'

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: false,
  user: { name: 'Ana', email: 'ana@correo.com' },
}
const SLOW = { timeout: 5000 }

const NOMINA: Account = {
  id: '0193f2a4-0000-7000-8000-000000000001',
  name: 'Nómina',
  type: 'bank',
  institution: null,
  balance: '2680000.00',
  opening_balance: '2800000.00',
  has_movements: true,
  archived: false,
  credit_card: null,
  created_at: '2026-10-01T15:00:00Z',
}

const MERCADO: Transaction = {
  id: '0193f2a4-0000-7000-8000-000000000100',
  type: 'expense',
  amount: '120000.00',
  date: '2026-10-30',
  account_id: NOMINA.id,
  destination_account_id: null,
  category: 'groceries',
  description: 'Mercado',
  note: null,
  created_at: '2026-10-30T15:00:00Z',
  updated_at: '2026-10-30T15:00:00Z',
}

function page(items: Transaction[]): TransactionPage {
  return {
    items,
    total: items.length,
    next_cursor: null,
    summary: {
      count: items.length,
      income: '0.00',
      expense: items.length ? '120000.00' : '0.00',
      savings: '0.00',
      transfers: '0.00',
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T15:00:00Z'))
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: /min-width/.test(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

type Handler = () => Response | Promise<Response>

/** API con estado: eliminar quita el movimiento y devuelve el saldo de la cuenta. */
function setup(onDelete?: Handler) {
  let items = [MERCADO]
  let account = NOMINA
  const api = mockApi({
    'GET /auth/session': () => json(200, ACTIVE),
    'GET /accounts': () =>
      json(200, {
        accounts: [account],
        totals: {
          available_balance: account.balance,
          net_worth: account.balance,
          credit_card_debt: '0.00',
        },
      }),
    'GET /transactions': () => json(200, page(items)),
    [`DELETE /transactions/${MERCADO.id}`]: () => {
      items = []
      account = { ...NOMINA, balance: '2800000.00', has_movements: false }
      return onDelete ? onDelete() : json(204, null)
    },
  })
  renderApp('/movimientos')
  return api
}

async function openDelete() {
  await userEvent.click(await screen.findByRole('button', { name: /^Acciones de Mercado/ }, SLOW))
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  return screen.getByRole('dialog', { name: '¿Eliminar este movimiento?' })
}

const accountCalls = (api: ReturnType<typeof mockApi>) =>
  api.fetchMock.mock.calls.filter(([url]) => url === '/api/v1/accounts').length

describe('Eliminar movimiento (T-TRX-FE-04, RF-TRX-08)', () => {
  it('confirma con el detalle, elimina con CSRF y recarga movimientos y cuentas', async () => {
    const api = setup()
    const dialog = await openDelete()
    await expectNoAxeViolations(dialog)
    expect(dialog).toHaveTextContent('Mercado · 30/10/2026 · − $ 120.000')
    // "Cancelar" va primero; el foco inicial lo da el `<dialog>` nativo, que jsdom no
    // implementa: se verifica en navegador (T-TRX-QA-02).
    const buttons = within(dialog)
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(buttons).toEqual(['Cancelar', 'Eliminar movimiento'])
    const before = accountCalls(api)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar movimiento' }))
    expect(await screen.findByText('Eliminamos el movimiento.')).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.headers(`DELETE /transactions/${MERCADO.id}`)[0]).toMatchObject({
      'X-CSRF-Token': 'csrf-activa',
    })
    // Sin movimientos y con el saldo de Cuentas recargado (CA-TRX-07).
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Aún no tienes movimientos' }),
    ).toBeVisible()
    expect(accountCalls(api)).toBeGreaterThan(before)
  })

  it('cancelar no elimina nada', async () => {
    const api = setup()
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.bodies(`DELETE /transactions/${MERCADO.id}`)).toEqual([])
  })

  it('si ya no existía (404), cierra, avisa y recarga la lista', async () => {
    setup(() => problem(404, 'transaction_not_found', M.notFound))
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar movimiento' }))
    expect(await screen.findByText(M.notFound)).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: 'Aún no tienes movimientos' }),
      ).toBeVisible()
    })
  })

  it('otro error queda dentro del diálogo, sin perder el contexto', async () => {
    setup(() => problem(503, 'unavailable', 'Servicio no disponible. Intenta de nuevo.'))
    const dialog = await openDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar movimiento' }))
    expect(
      await within(dialog).findByText('Servicio no disponible. Intenta de nuevo.'),
    ).toBeVisible()
    expect(screen.getByRole('dialog', { name: '¿Eliminar este movimiento?' })).toBeVisible()
  })
})
