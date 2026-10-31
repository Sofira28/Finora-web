import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../lib/api/index.ts'
import { json, mockApi, problem, renderApp } from '../../test/app.tsx'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { SessionInfo } from '../auth/session/index.ts'
import type { Account, AccountList } from './api.ts'

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: false,
  user: { name: 'Ana', email: 'ana@correo.com' },
}

// La primera prueba descarga la página (`lazy`); en máquinas lentas tarda más de 1 s.
const SLOW = { timeout: 5000 }

// Intl separa el símbolo con un espacio sin ruptura (U+00A0).
const cop = (text: string) => text.replace('$ ', '$ ')

let nextId = 1
function account(
  overrides: Partial<Account> & Pick<Account, 'name' | 'type' | 'balance'>,
): Account {
  return {
    id: `0193f2a4-0000-7000-8000-${String(nextId++).padStart(12, '0')}`,
    institution: null,
    opening_balance: overrides.balance,
    has_movements: false,
    archived: false,
    credit_card: null,
    created_at: '2026-10-30T15:00:00Z',
    ...overrides,
  }
}

const TARJETA = account({
  name: 'Tarjeta Órbita',
  type: 'credit_card',
  institution: 'Banco Andino',
  balance: '820000.00',
  credit_card: {
    credit_limit: '6000000.00',
    available_credit: '5180000.00',
    usage_percent: 14,
    over_limit: false,
    statement_day: 28,
    payment_due_day: 18,
  },
})

// CA-ACC-01: los totales los envía el backend; el frontend no suma.
const CA_ACC_01: AccountList = {
  accounts: [
    account({ name: 'Nómina', type: 'bank', institution: 'Banco Andino', balance: '2800000.00' }),
    account({ name: 'Efectivo', type: 'cash', balance: '90000.00' }),
    account({ name: 'CDT', type: 'investment', balance: '12000000.00' }),
    TARJETA,
  ],
  totals: {
    available_balance: '2890000.00',
    net_worth: '14070000.00',
    credit_card_debt: '820000.00',
  },
}

const EMPTY_TOTALS = { available_balance: '0.00', net_worth: '0.00', credit_card_debt: '0.00' }

afterEach(() => {
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

function renderAccounts(list: AccountList | (() => Response | Promise<Response>)) {
  const api = mockApi({
    'GET /auth/session': () => json(200, ACTIVE),
    'GET /accounts': typeof list === 'function' ? list : () => json(200, list),
  })
  return { api, ...renderApp('/cuentas') }
}

function totalValue(name: string): string {
  const summary = screen.getByRole('region', { name: 'Resumen' })
  const term = within(summary).getByText(name, { selector: 'dt' })
  return term.nextElementSibling?.firstElementChild?.textContent ?? ''
}

describe('página Cuentas y tarjetas (T-ACC-FE-03)', () => {
  it('CA-ACC-01: muestra los totales del backend, cada uno con su nombre', async () => {
    const { container } = renderAccounts(CA_ACC_01)
    await screen.findByRole('region', { name: 'Resumen' }, SLOW)
    expect(totalValue('Saldo disponible')).toBe(cop('$ 2.890.000'))
    expect(totalValue('Patrimonio neto')).toBe(cop('$ 14.070.000'))
    expect(totalValue('Deuda en tarjetas')).toBe(cop('$ 820.000'))
    // RN-ACC-06: cada total con su explicación.
    expect(screen.getByText(/No incluye ahorro, inversión ni el cupo/)).toBeVisible()
    await expectNoAxeViolations(container)
  }, 15000)

  it('CA-ACC-01: cada cuenta en su grupo, con tipo, entidad y saldo', async () => {
    renderAccounts(CA_ACC_01)
    const liquid = await screen.findByRole('region', { name: 'Cuentas y efectivo' }, SLOW)
    const items = within(liquid).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      `NóminaCuenta bancaria · Banco AndinoSaldo: ${cop('$ 2.800.000')}`,
      `EfectivoEfectivoSaldo: ${cop('$ 90.000')}`,
    ])
    const savings = screen.getByRole('region', { name: 'Ahorro e inversión' })
    expect(within(savings).getByText('CDT')).toBeVisible()
    expect(within(savings).getByText('$ 12.000.000')).toBeVisible()
    const cards = screen.getByRole('region', { name: 'Tarjetas de crédito' })
    expect(within(cards).getByRole('heading', { name: 'Tarjeta Órbita' })).toBeVisible()
  })

  it('CA-ACC-02: datos de la tarjeta con su barra de uso accesible', async () => {
    renderAccounts(CA_ACC_01)
    const cards = await screen.findByRole('region', { name: 'Tarjetas de crédito' }, SLOW)
    expect(within(cards).getByText('Deuda pendiente')).toBeVisible()
    expect(within(cards).getByText('$ 820.000')).toBeVisible()
    expect(within(cards).getByText('$ 5.180.000')).toBeVisible()
    expect(within(cards).getByText('$ 6.000.000')).toBeVisible()
    expect(within(cards).getByText('14 % usado')).toBeVisible()
    expect(within(cards).getByText('Corte día 28 · pago día 18')).toBeVisible()
    const bar = within(cards).getByRole('progressbar', { name: 'Uso del cupo de Tarjeta Órbita' })
    expect(bar).toHaveAttribute('aria-valuenow', '14')
    expect(bar).toHaveAttribute('aria-valuetext', '14 % del cupo usado')
    expect(within(cards).queryByText('Superaste el cupo de esta tarjeta.')).not.toBeInTheDocument()
  })

  it('VAL-ACC-10: cupo superado con aviso en texto, no solo color', async () => {
    const over = account({
      name: 'Visa',
      type: 'credit_card',
      balance: '7000000.00',
      credit_card: {
        credit_limit: '6000000.00',
        available_credit: '0.00',
        usage_percent: 117,
        over_limit: true,
        statement_day: 5,
        payment_due_day: 20,
      },
    })
    renderAccounts({ accounts: [over], totals: EMPTY_TOTALS })
    expect(await screen.findByText('Superaste el cupo de esta tarjeta.')).toBeVisible()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(bar).toHaveAttribute('aria-valuetext', '117 % del cupo usado')
  })

  it('tarjeta con saldo a favor', async () => {
    const favor = account({
      name: 'Mastercard',
      type: 'credit_card',
      balance: '-50000.00',
      credit_card: {
        credit_limit: '1000000.00',
        available_credit: '1050000.00',
        usage_percent: 0,
        over_limit: false,
        statement_day: 1,
        payment_due_day: 15,
      },
    })
    renderAccounts({ accounts: [favor], totals: EMPTY_TOTALS })
    expect(await screen.findByText('Saldo a favor')).toBeVisible()
    expect(screen.getByText('$ 50.000')).toBeVisible()
  })

  it('CA-ACC-03: con solo una tarjeta sin deuda, disponible y patrimonio en $ 0', async () => {
    const card = account({
      name: 'Visa',
      type: 'credit_card',
      balance: '0.00',
      credit_card: {
        credit_limit: '6000000.00',
        available_credit: '6000000.00',
        usage_percent: 0,
        over_limit: false,
        statement_day: 5,
        payment_due_day: 20,
      },
    })
    renderAccounts({ accounts: [card], totals: EMPTY_TOTALS })
    await screen.findByRole('region', { name: 'Resumen' }, SLOW)
    expect(totalValue('Saldo disponible')).toBe(cop('$ 0'))
    expect(totalValue('Patrimonio neto')).toBe(cop('$ 0'))
  })

  it('saldo negativo con signo menos', async () => {
    renderAccounts({
      accounts: [account({ name: 'Sobregiro', type: 'bank', balance: '-30000.00' })],
      totals: { ...EMPTY_TOTALS, available_balance: '-30000.00', net_worth: '-30000.00' },
    })
    expect(await screen.findByText('Sobregiro')).toBeVisible()
    expect(totalValue('Saldo disponible')).toBe(cop('−$ 30.000'))
  })
})

describe('archivadas (RF-ACC-08)', () => {
  it('van aparte, plegadas, y no en los grupos', async () => {
    const billetera = account({ name: 'Billetera', type: 'wallet', balance: '250000.00' })
    renderAccounts({
      accounts: [
        account({ name: 'Nómina', type: 'bank', balance: '1000.00' }),
        { ...billetera, archived: true },
      ],
      totals: { ...EMPTY_TOTALS, available_balance: '1000.00', net_worth: '1000.00' },
    })
    const liquid = await screen.findByRole('region', { name: 'Cuentas y efectivo' }, SLOW)
    expect(within(liquid).queryByText('Billetera')).not.toBeInTheDocument()

    const archived = screen.getByRole('region', { name: 'Cuentas archivadas' })
    const summary = within(archived).getByText('Archivadas (1)', { exact: false })
    expect(archived.querySelector('details')).not.toHaveAttribute('open')
    await userEvent.click(summary)
    expect(archived.querySelector('details')).toHaveAttribute('open')
    expect(within(archived).getByText('Billetera')).toBeVisible()
  })
})

describe('estados (RF-ACC-10)', () => {
  it('sin cuentas: totales en $ 0 y estado vacío', async () => {
    const { container } = renderAccounts({ accounts: [], totals: EMPTY_TOTALS })
    expect(
      await screen.findByRole('heading', { name: 'Aún no tienes cuentas activas' }),
    ).toBeVisible()
    expect(totalValue('Saldo disponible')).toBe(cop('$ 0'))
    expect(screen.queryByRole('region', { name: 'Cuentas y efectivo' })).not.toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  it('solo archivadas: estado vacío y la sección de archivadas', async () => {
    renderAccounts({
      accounts: [{ ...account({ name: 'Vieja', type: 'cash', balance: '0.00' }), archived: true }],
      totals: EMPTY_TOTALS,
    })
    expect(
      await screen.findByRole('heading', { name: 'Aún no tienes cuentas activas' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: 'Cuentas archivadas' })).toBeInTheDocument()
  })

  it('mientras carga lo anuncia', async () => {
    renderAccounts(() => new Promise<Response>(() => undefined))
    expect(await screen.findByText('Cargando tus cuentas…')).toBeInTheDocument()
  })

  it('si falla, muestra el error y permite reintentar', async () => {
    let recovered = false
    const { container } = renderAccounts(() =>
      recovered
        ? json(200, CA_ACC_01)
        : problem(500, 'internal_error', 'Algo salió mal de nuestro lado.'),
    )
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'No pudimos cargar tus cuentas.',
    )
    await expectNoAxeViolations(container)
    recovered = true
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('region', { name: 'Resumen' })).toBeInTheDocument()
  }, 15000)
})
