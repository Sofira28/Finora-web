import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../lib/api/index.ts'
import { json, mockApi, problem, renderApp } from '../../test/app.tsx'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { Account, AccountList } from '../accounts/api.ts'
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
const id = (n: number) => `0193f2a4-0000-7000-8000-${String(n).padStart(12, '0')}`

function account(n: number, name: string, overrides: Partial<Account> = {}): Account {
  return {
    id: id(n),
    name,
    type: 'bank',
    institution: null,
    balance: '2800000.00',
    opening_balance: '2800000.00',
    has_movements: true,
    archived: false,
    credit_card: null,
    created_at: '2026-10-01T15:00:00Z',
    ...overrides,
  }
}

const NOMINA = account(1, 'Nómina')
const FONDO = account(2, 'Fondo de emergencia', { type: 'savings', balance: '2000000.00' })
const TARJETA = account(3, 'Tarjeta Órbita', { type: 'credit_card', balance: '820000.00' })
const VIEJA = account(4, 'Cuenta vieja', { archived: true, balance: '50000.00' })
const ACCOUNTS = [NOMINA, FONDO, TARJETA, VIEJA]

const MERCADO: Transaction = {
  id: id(100),
  type: 'expense',
  amount: '120000.00',
  date: '2026-10-30',
  account_id: NOMINA.id,
  destination_account_id: null,
  category: 'groceries',
  description: 'Mercado',
  note: 'Semana 4',
  created_at: '2026-10-30T15:00:00Z',
  updated_at: '2026-10-30T15:00:00Z',
}
const EN_ARCHIVADA: Transaction = {
  ...MERCADO,
  id: id(101),
  account_id: VIEJA.id,
  description: 'Gasto viejo',
  note: null,
}

function page(items: Transaction[]): TransactionPage {
  return {
    items,
    total: items.length,
    next_cursor: null,
    summary: {
      count: items.length,
      income: '0.00',
      expense: '0.00',
      savings: '0.00',
      transfers: '0.00',
    },
  }
}

function setViewport(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T15:00:00Z'))
  setViewport(1440)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

type Handler = (body: unknown) => Response | Promise<Response>

function setup(extra: Record<string, Handler> = {}, accounts: Account[] = ACCOUNTS) {
  const lists: AccountList = {
    accounts,
    totals: { available_balance: '0.00', net_worth: '0.00', credit_card_debt: '0.00' },
  }
  const api = mockApi({
    'GET /auth/session': () => json(200, ACTIVE),
    'GET /accounts': () => json(200, lists),
    'GET /transactions': () => json(200, page([MERCADO, EN_ARCHIVADA])),
    ...extra,
  })
  renderApp('/movimientos')
  return api
}

async function openCreate() {
  await userEvent.click(await screen.findByRole('button', { name: 'Añadir movimiento' }, SLOW))
  return screen.getByRole('dialog', { name: 'Nuevo movimiento' })
}

async function openEdit(description: string) {
  await userEvent.click(
    await screen.findByRole('button', { name: new RegExp(`^Acciones de ${description}`) }, SLOW),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
  return screen.getByRole('dialog', { name: 'Editar movimiento' })
}

const options = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent)

describe('TransactionFormDialog (T-TRX-FE-03)', () => {
  it('registra un gasto con sus campos y recarga movimientos y cuentas (RF-TRX-01)', async () => {
    const api = setup({ 'POST /transactions': () => json(201, MERCADO) })
    const dialog = await openCreate()
    await expectNoAxeViolations(dialog)

    expect(within(dialog).getByRole('radio', { name: 'Gasto' })).toBeChecked()
    expect(within(dialog).getByLabelText('Fecha')).toHaveValue('2026-10-31')
    expect(within(dialog).getByLabelText('Fecha')).toHaveAttribute('max', '2026-10-31')
    // Solo cuentas activas (RN-TRX-08).
    expect(options(within(dialog).getByLabelText('Cuenta'))).toEqual([
      'Elige una cuenta',
      'Nómina',
      'Fondo de emergencia',
      'Tarjeta Órbita',
    ])
    expect(options(within(dialog).getByLabelText('Categoría'))).toContain('Mercado')
    expect(options(within(dialog).getByLabelText('Categoría'))).not.toContain('Salario')

    await userEvent.type(within(dialog).getByLabelText('Monto'), '120.000')
    await userEvent.selectOptions(within(dialog).getByLabelText('Cuenta'), 'Nómina')
    await userEvent.selectOptions(within(dialog).getByLabelText('Categoría'), 'Mercado')
    await userEvent.type(within(dialog).getByLabelText('Descripción'), 'Mercado')
    const before = api.fetchMock.mock.calls.length
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar movimiento' }))

    expect(await screen.findByText('Registramos el movimiento.')).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.bodies('POST /transactions')).toEqual([
      {
        type: 'expense',
        amount: '120000',
        date: '2026-10-31',
        account_id: NOMINA.id,
        category: 'groceries',
        description: 'Mercado',
      },
    ])
    expect(api.headers('POST /transactions')[0]).toMatchObject({ 'X-CSRF-Token': 'csrf-activa' })
    // Saldos y resumen vuelven del backend.
    await waitFor(() => {
      const after = api.fetchMock.mock.calls
        .slice(before)
        .map(([url]) => (typeof url === 'string' ? url : ''))
      expect(after.some((url) => url.startsWith('/api/v1/transactions?'))).toBe(true)
      expect(after).toContain('/api/v1/accounts')
    })
  })

  it('muestra los mensajes de la spec sin enviar nada (VAL-TRX-01, 03, 06 y 07)', async () => {
    const api = setup()
    const dialog = await openCreate()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar movimiento' }))
    expect(await within(dialog).findByText(M.amount)).toBeVisible()
    expect(within(dialog).getByText(M.account)).toBeVisible()
    expect(within(dialog).getByText(M.category)).toBeVisible()
    expect(within(dialog).getByText(M.description)).toBeVisible()
    expect(within(dialog).getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'true')
    expect(api.bodies('POST /transactions')).toEqual([])
  })

  it('transferencia: origen y destino distintos, sin categoría y con el aviso (RF-TRX-02)', async () => {
    const api = setup({ 'POST /transactions': () => json(201, MERCADO) })
    const dialog = await openCreate()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Transferencia' }))
    expect(within(dialog).getByText(M.transferInfo)).toBeVisible()
    expect(within(dialog).queryByLabelText('Categoría')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Descripción (opcional)')).toBeInTheDocument()

    await userEvent.selectOptions(within(dialog).getByLabelText('Cuenta de origen'), 'Nómina')
    const destination = within(dialog).getByLabelText('Cuenta de destino')
    expect(options(destination)).toEqual([
      'Elige una cuenta',
      'Fondo de emergencia',
      'Tarjeta Órbita',
    ])
    await userEvent.selectOptions(destination, 'Fondo de emergencia')
    await userEvent.type(within(dialog).getByLabelText('Monto'), '500.000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar movimiento' }))
    await waitFor(() => {
      expect(api.bodies('POST /transactions')).toEqual([
        {
          type: 'transfer',
          amount: '500000',
          date: '2026-10-31',
          account_id: NOMINA.id,
          destination_account_id: FONDO.id,
        },
      ])
    })
  })

  it('ajuste: pide el saldo real con el actual como ayuda; en tarjetas, la deuda (RF-TRX-03)', async () => {
    const api = setup({
      'POST /transactions': () =>
        problem(422, 'validation_failed', 'Revisa los datos.', {
          errors: [
            { loc: ['body', 'target_balance'], type: 'value_error', message: M.sameBalance },
          ],
        }),
    })
    const dialog = await openCreate()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Ajuste' }))
    expect(within(dialog).queryByLabelText('Monto')).not.toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText('Cuenta'), 'Tarjeta Órbita')
    const target = within(dialog).getByLabelText('Deuda real de la tarjeta')
    expect(target).toHaveAccessibleDescription(/Deuda actual en FINORA: \$\s820\.000/)
    await userEvent.selectOptions(within(dialog).getByLabelText('Cuenta'), 'Nómina')
    expect(within(dialog).getByLabelText('Saldo real de la cuenta')).toHaveAccessibleDescription(
      /Saldo actual en FINORA: \$\s2\.800\.000/,
    )

    await userEvent.type(within(dialog).getByLabelText('Saldo real de la cuenta'), '2.800.000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar movimiento' }))
    // VAL-TRX-09 lo decide el backend y queda en su campo.
    expect(await within(dialog).findByText(M.sameBalance)).toBeVisible()
    expect(within(dialog).getByLabelText('Saldo real de la cuenta')).toHaveFocus()
    expect(api.bodies('POST /transactions')).toEqual([
      { type: 'adjustment', target_balance: '2800000', date: '2026-10-31', account_id: NOMINA.id },
    ])
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lleva los 422 del backend a su campo (VAL-TRX-04)', async () => {
    setup({
      'POST /transactions': () =>
        problem(422, 'validation_failed', 'Revisa los datos.', {
          errors: [{ loc: ['body', 'account_id'], type: 'value_error', message: M.archived }],
        }),
    })
    const dialog = await openCreate()
    await userEvent.type(within(dialog).getByLabelText('Monto'), '1000')
    await userEvent.selectOptions(within(dialog).getByLabelText('Cuenta'), 'Nómina')
    await userEvent.selectOptions(within(dialog).getByLabelText('Categoría'), 'Salud')
    await userEvent.type(within(dialog).getByLabelText('Descripción'), 'Droguería')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar movimiento' }))
    expect(await within(dialog).findByText(M.archived)).toBeVisible()
    expect(within(dialog).getByLabelText('Cuenta')).toHaveAttribute('aria-invalid', 'true')
  })

  it('al pasar de gasto a ingreso quita la categoría de gasto', async () => {
    setup()
    const dialog = await openCreate()
    await userEvent.selectOptions(within(dialog).getByLabelText('Categoría'), 'Mercado')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Ingreso' }))
    const category = within(dialog).getByLabelText('Categoría')
    expect(category).toHaveValue('')
    expect(options(category)).toEqual([
      'Elige una categoría',
      'Salario',
      'Freelance',
      'Otros ingresos',
      'Sin categoría',
    ])
  })

  it('edita un movimiento con sus datos y lo reemplaza con PUT (RF-TRX-07)', async () => {
    const api = setup({ [`PUT /transactions/${MERCADO.id}`]: () => json(200, MERCADO) })
    const dialog = await openEdit('Mercado')
    expect(within(dialog).getByLabelText('Monto')).toHaveValue('120.000')
    expect(within(dialog).getByLabelText('Fecha')).toHaveValue('2026-10-30')
    expect(within(dialog).getByLabelText('Cuenta')).toHaveValue(NOMINA.id)
    expect(within(dialog).getByLabelText('Categoría')).toHaveValue('groceries')
    expect(within(dialog).getByLabelText('Nota (opcional)')).toHaveValue('Semana 4')

    // Cambiar el tipo: pierde la categoría y la descripción pasa a ser opcional.
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Transferencia' }))
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Cuenta de destino'),
      'Fondo de emergencia',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Guardamos los cambios del movimiento.')).toBeVisible()
    expect(api.bodies(`PUT /transactions/${MERCADO.id}`)).toEqual([
      {
        type: 'transfer',
        amount: '120000',
        date: '2026-10-30',
        account_id: NOMINA.id,
        destination_account_id: FONDO.id,
        description: 'Mercado',
        note: 'Semana 4',
      },
    ])
  })

  it('edita un movimiento de una cuenta archivada sin cambiar la cuenta (RN-TRX-08)', async () => {
    const api = setup({ [`PUT /transactions/${EN_ARCHIVADA.id}`]: () => json(200, EN_ARCHIVADA) })
    const dialog = await openEdit('Gasto viejo')
    const select = within(dialog).getByLabelText('Cuenta')
    expect(select).toHaveValue(VIEJA.id)
    expect(options(select)).toContain('Cuenta vieja (archivada)')
    await userEvent.clear(within(dialog).getByLabelText('Monto'))
    await userEvent.type(within(dialog).getByLabelText('Monto'), '99.000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      expect(api.bodies(`PUT /transactions/${EN_ARCHIVADA.id}`)).toEqual([
        expect.objectContaining({ account_id: VIEJA.id, amount: '99000' }),
      ])
    })
  })

  it('si el movimiento ya no existe, cierra y avisa (VAL-TRX-10)', async () => {
    setup({
      [`PUT /transactions/${MERCADO.id}`]: () => problem(404, 'transaction_not_found', M.notFound),
    })
    const dialog = await openEdit('Mercado')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(M.notFound)).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin cuentas activas, explica que primero hay que crear una', async () => {
    setup({ 'GET /transactions': () => json(200, page([])) }, [{ ...VIEJA, has_movements: false }])
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Añadir movimiento' }, SLOW))[0] as HTMLElement,
    )
    const dialog = screen.getByRole('dialog', { name: 'Nuevo movimiento' })
    expect(within(dialog).getByRole('link', { name: 'Ir a Cuentas' })).toHaveAttribute(
      'href',
      '/cuentas',
    )
    expect(
      within(dialog).queryByRole('button', { name: 'Guardar movimiento' }),
    ).not.toBeInTheDocument()
  })
})
