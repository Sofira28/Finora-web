import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../lib/api/index.ts'
import { json, mockApi, problem, renderApp } from '../../test/app.tsx'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { Account, AccountList } from '../accounts/api.ts'
import type { SessionInfo } from '../auth/session/index.ts'
import type { Transaction, TransactionPage } from './api.ts'

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: false,
  user: { name: 'Ana', email: 'ana@correo.com' },
}

// La primera prueba descarga la página (`lazy`); en máquinas lentas tarda más de 1 s.
const SLOW = { timeout: 5000 }

const id = (n: number) => `0193f2a4-0000-7000-8000-${String(n).padStart(12, '0')}`

function account(n: number, name: string, overrides: Partial<Account> = {}): Account {
  return {
    id: id(n),
    name,
    type: 'bank',
    institution: null,
    balance: '0.00',
    opening_balance: '0.00',
    has_movements: true,
    archived: false,
    credit_card: null,
    created_at: '2026-10-01T15:00:00Z',
    ...overrides,
  }
}

const NOMINA = account(1, 'Nómina')
const EFECTIVO = account(2, 'Efectivo', { type: 'cash' })
const FONDO = account(3, 'Fondo de emergencia', { type: 'savings' })
const VIEJA = account(4, 'Cuenta vieja', { archived: true })

function accountList(accounts: Account[]): AccountList {
  return {
    accounts,
    totals: { available_balance: '0.00', net_worth: '0.00', credit_card_debt: '0.00' },
  }
}

let txId = 1000
function tx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  return {
    id: id(txId++),
    date: '2026-10-30',
    account_id: NOMINA.id,
    destination_account_id: null,
    category: null,
    description: null,
    note: null,
    created_at: '2026-10-30T15:00:00Z',
    updated_at: '2026-10-30T15:00:00Z',
    ...overrides,
  }
}

const SAMPLE: Transaction[] = [
  tx({ type: 'expense', amount: '120000.00', category: 'groceries', description: 'Mercado' }),
  tx({ type: 'income', amount: '3200000.00', category: 'salary', description: 'Salario' }),
  tx({ type: 'transfer', amount: '500000.00', destination_account_id: FONDO.id }),
  tx({ type: 'adjustment', amount: '-15000.00', account_id: EFECTIVO.id }),
]

function page(items: Transaction[], extra: Partial<TransactionPage> = {}): TransactionPage {
  return {
    items,
    total: items.length,
    next_cursor: null,
    summary: {
      count: items.length,
      income: '3200000.00',
      expense: '120000.00',
      savings: '500000.00',
      transfers: '0.00',
    },
    ...extra,
  }
}

/** Simula `matchMedia` con un ancho de ventana fijo. */
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
  // Solo se fija la fecha; los temporizadores siguen siendo reales.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T15:00:00Z'))
  setViewport(1440)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

interface Setup {
  accounts?: Account[]
  transactions?: (url: URL) => Response | Promise<Response>
}

function setup(url = '/movimientos', options: Setup = {}) {
  const queries: URLSearchParams[] = []
  const api = mockApi({
    'GET /auth/session': () => json(200, ACTIVE),
    'GET /accounts': () =>
      json(200, accountList(options.accounts ?? [NOMINA, EFECTIVO, FONDO, VIEJA])),
    'GET /transactions': (_body, requestUrl) => {
      queries.push(requestUrl.searchParams)
      return options.transactions ? options.transactions(requestUrl) : json(200, page(SAMPLE))
    },
  })
  const view = renderApp(url)
  return { ...view, api, queries, last: () => Object.fromEntries(queries.at(-1) ?? []) }
}

describe('Movimientos (T-TRX-FE-02)', () => {
  it('al entrar muestra este mes, el resumen del backend y la tabla con signo y tipo', async () => {
    const { container, last } = setup()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Movimientos' }, SLOW),
    ).toBeVisible()
    const table = await screen.findByRole('table', { name: 'Movimientos' })
    expect(last()).toEqual({ sort: 'date_desc', from: '2026-10-01', to: '2026-10-31' })

    // Resumen calculado por el backend (RF-TRX-06): el frontend no suma.
    const summary = screen.getByRole('status')
    expect(summary).toHaveTextContent('4 movimientos')
    expect(summary).toHaveTextContent('Ingresos + $ 3.200.000')
    expect(summary).toHaveTextContent('Gastos − $ 120.000')
    expect(summary).toHaveTextContent('Ahorro neto + $ 500.000')
    expect(summary).toHaveTextContent('Transferencias $ 0 · no suman como gasto')

    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(4)
    const [expense, income, transfer, adjustment] = rows as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ]
    expect(expense).toHaveTextContent('30/10/2026')
    expect(expense).toHaveTextContent('Mercado')
    expect(expense).toHaveTextContent('− $ 120.000Gasto')
    expect(income).toHaveTextContent('+ $ 3.200.000Ingreso')
    expect(transfer).toHaveTextContent('Transferencia a Fondo de emergencia')
    expect(transfer).toHaveTextContent('Nómina →a Fondo de emergencia')
    expect(transfer).toHaveTextContent('No aplica')
    expect(transfer).toHaveTextContent('$ 500.000Transferencia')
    expect(adjustment).toHaveTextContent('Ajuste de saldo')
    expect(adjustment).toHaveTextContent('− $ 15.000Ajuste')
    expect(adjustment).toHaveTextContent('Efectivo')

    expect(screen.getByLabelText('Periodo')).toHaveValue('this_month')
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument()
    await expectNoAxeViolations(container)
  })

  it('CA-TRX-10: "Este mes" y "Nómina" piden 50, "Cargar más" trae los otros 10', async () => {
    const all = Array.from({ length: 60 }, (_, n) =>
      tx({
        type: 'expense',
        amount: '1000.00',
        category: 'groceries',
        description: `Gasto ${String(n + 1)}`,
      }),
    )
    const summary = {
      count: 60,
      income: '0.00',
      expense: '60000.00',
      savings: '0.00',
      transfers: '0.00',
    }
    const { queries, last } = setup('/movimientos', {
      transactions: (url) =>
        url.searchParams.get('cursor') === 'pagina-2'
          ? json(200, { items: all.slice(50), total: 60, next_cursor: null, summary })
          : json(200, { items: all.slice(0, 50), total: 60, next_cursor: 'pagina-2', summary }),
    })
    await screen.findByRole('table', { name: 'Movimientos' }, SLOW)
    await userEvent.selectOptions(screen.getByLabelText('Cuenta'), 'Nómina')
    await waitFor(() => {
      expect(last()).toEqual({
        sort: 'date_desc',
        from: '2026-10-01',
        to: '2026-10-31',
        account_id: NOMINA.id,
      })
    })

    expect(await screen.findByText('Mostrando 50 de 60')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('60 movimientos')
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByText('Mostrando 60 de 60')).toBeVisible()
    expect(screen.getAllByRole('row')).toHaveLength(61)
    expect(last()).toMatchObject({ account_id: NOMINA.id, cursor: 'pagina-2' })
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument()
    // El resumen es el del filtro completo, igual en ambas páginas.
    expect(screen.getByRole('status')).toHaveTextContent('Gastos − $ 60.000')
    expect(queries.length).toBeGreaterThanOrEqual(2)
  })

  it('lee los filtros de la URL y escribe en ella los cambios', async () => {
    const { router, last } = setup(`/movimientos?periodo=all&tipo=expense&q=cafe&orden=amount_asc`)
    await screen.findByRole('table', { name: 'Movimientos' }, SLOW)
    expect(last()).toEqual({ sort: 'amount_asc', q: 'cafe', type: 'expense' })
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('cafe')
    expect(screen.getByLabelText('Periodo')).toHaveValue('all')
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('amount_asc')
    expect(screen.getByRole('button', { name: 'Gastos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('columnheader', { name: /Monto/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )

    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Mercado')
    await waitFor(() => {
      expect(router.state.location.search).toBe(
        '?q=cafe&periodo=all&tipo=expense&categoria=groceries&orden=amount_asc',
      )
    })
    // Pasar a ingresos quita una categoría de gasto: si no, la lista quedaría vacía.
    await userEvent.click(screen.getByRole('button', { name: 'Ingresos' }))
    await waitFor(() => {
      expect(router.state.location.search).toBe('?q=cafe&periodo=all&tipo=income&orden=amount_asc')
    })
    // Transferencias y ajustes no tienen categoría.
    await userEvent.click(screen.getByRole('button', { name: 'Transferencias' }))
    expect(screen.getByLabelText('Categoría')).toBeDisabled()
  })

  it('ordena desde los encabezados de la tabla', async () => {
    const { last } = setup()
    await screen.findByRole('table', { name: 'Movimientos' }, SLOW)
    expect(screen.getByRole('columnheader', { name: /Fecha/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    await userEvent.click(screen.getByRole('button', { name: /Fecha/ }))
    await waitFor(() => {
      expect(last().sort).toBe('date_asc')
    })
    await userEvent.click(screen.getByRole('button', { name: /Monto/ }))
    await waitFor(() => {
      expect(last().sort).toBe('amount_desc')
    })
  })

  it('busca al dejar de escribir, sin una petición por tecla', async () => {
    const { queries, last } = setup()
    await screen.findByRole('table', { name: 'Movimientos' }, SLOW)
    const before = queries.length
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'mercado')
    await waitFor(() => {
      expect(last().q).toBe('mercado')
    })
    expect(queries.length - before).toBe(1)
  })

  it('sin ningún movimiento invita a registrar el primero (RF-TRX-09)', async () => {
    setup('/movimientos', {
      accounts: [{ ...NOMINA, has_movements: false }],
      transactions: () => json(200, page([])),
    })
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Aún no tienes movimientos' }, SLOW),
    ).toBeVisible()
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument()
  })

  it('con movimientos fuera del filtro: "Sin resultados" y Limpiar filtros muestra todo', async () => {
    const { router, last } = setup('/movimientos?tipo=income', {
      transactions: (url) => json(200, page(url.searchParams.has('from') ? [] : SAMPLE)),
    })
    const empty = await screen.findByRole('heading', { level: 2, name: 'Sin resultados' }, SLOW)
    const section = empty.closest('section') as HTMLElement
    await userEvent.click(within(section).getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() => {
      expect(router.state.location.search).toBe('?periodo=all')
    })
    expect(last()).toEqual({ sort: 'date_desc' })
    expect(await screen.findByRole('table', { name: 'Movimientos' })).toBeVisible()
    // Sin filtros que quitar, el botón ya no aparece.
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    let fail = true
    setup('/movimientos', {
      transactions: () =>
        fail
          ? problem(500, 'internal_error', 'Ocurrió un error inesperado.')
          : json(200, page(SAMPLE)),
    })
    expect(await screen.findByText('No pudimos cargar tus movimientos.', {}, SLOW)).toBeVisible()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('table', { name: 'Movimientos' })).toBeVisible()
  })

  it('si falla "Cargar más" conserva la lista ya cargada', async () => {
    const first = Array.from({ length: 50 }, (_, n) =>
      tx({
        type: 'expense',
        amount: '1000.00',
        category: 'groceries',
        description: `Gasto ${String(n)}`,
      }),
    )
    setup('/movimientos', {
      transactions: (url) =>
        url.searchParams.has('cursor')
          ? problem(500, 'internal_error', 'Ocurrió un error inesperado.')
          : json(200, page(first, { total: 60, next_cursor: 'pagina-2' })),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Cargar más' }, SLOW))
    // Un 5xx se reintenta una vez antes de mostrar el error (queryClient.ts).
    expect(
      await screen.findByText('No pudimos cargar más movimientos. Intenta de nuevo.', {}, SLOW),
    ).toBeVisible()
    expect(screen.getAllByRole('row')).toHaveLength(51)
  })

  it('ignora una cuenta de la URL que no es del usuario', async () => {
    const { last } = setup(`/movimientos?cuenta=${id(999)}`)
    await screen.findByRole('table', { name: 'Movimientos' }, SLOW)
    expect(last().account_id).toBeUndefined()
    expect(screen.getByLabelText('Cuenta')).toHaveValue('')
    // Las archivadas siguen disponibles para consultar su historial.
    expect(screen.getByRole('option', { name: 'Cuenta vieja (archivada)' })).toBeInTheDocument()
  })

  it('en tablet la cuenta va debajo de la descripción', async () => {
    setViewport(1024)
    setup()
    const table = await screen.findByRole('table', { name: 'Movimientos' }, SLOW)
    expect(within(table).queryByRole('columnheader', { name: 'Cuenta' })).not.toBeInTheDocument()
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('MercadoNómina')
  })

  it('en móvil muestra una lista con monto, tipo, categoría, fecha y cuenta', async () => {
    setViewport(375)
    const { container } = setup()
    const list = await screen.findByRole('list', { name: 'Movimientos' }, SLOW)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('Mercado')
    expect(items[0]).toHaveTextContent('Mercado · 30/10/2026')
    expect(items[0]).toHaveTextContent('Nómina')
    expect(items[0]).toHaveTextContent('− $ 120.000Gasto')
    await expectNoAxeViolations(container)
  })
})
