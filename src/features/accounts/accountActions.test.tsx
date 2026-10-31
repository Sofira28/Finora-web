import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../lib/api/index.ts'
import { json, mockApi, problem, renderApp } from '../../test/app.tsx'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { SessionInfo } from '../auth/session/index.ts'
import type { Account, Totals } from './api.ts'

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: false,
  user: { name: 'Ana', email: 'ana@correo.com' },
}
const SLOW = { timeout: 5000 }

function account(id: number, name: string, type: Account['type'], balance: string): Account {
  return {
    id: `0193f2a4-0000-7000-8000-${String(id).padStart(12, '0')}`,
    name,
    type,
    institution: null,
    opening_balance: balance,
    balance,
    has_movements: false,
    archived: false,
    credit_card: null,
    created_at: '2026-10-30T15:00:00Z',
  }
}

const NOMINA = account(1, 'Nómina', 'bank', '1000.00')
const BILLETERA = account(2, 'Billetera', 'wallet', '250000.00')
const VACIA = account(3, 'Vacía', 'cash', '0.00')

/** Totales como los calcularía el backend (solo para las pruebas: bank, wallet y cash). */
function totals(accounts: Account[]): Totals {
  const cents = accounts
    .filter((a) => !a.archived)
    .reduce((sum, a) => sum + BigInt(a.balance.replace('.', '')), 0n)
  const text = `${String(cents / 100n)}.${String(cents % 100n).padStart(2, '0')}`
  return { available_balance: text, net_worth: text, credit_card_debt: '0.00' }
}

afterEach(() => {
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

type Handler = (body: unknown) => Response | Promise<Response>

/** API con estado: archivar, reactivar y eliminar cambian el listado siguiente. */
function setup(initial: Account[], overrides: Record<string, Handler> = {}) {
  let accounts = [...initial]
  const handlers: Record<string, Handler> = {
    'GET /auth/session': () => json(200, ACTIVE),
    'GET /accounts': () => json(200, { accounts, totals: totals(accounts) }),
  }
  for (const a of initial) {
    const set = (archived: boolean) => () => {
      accounts = accounts.map((x) => (x.id === a.id ? { ...x, archived } : x))
      return json(
        200,
        accounts.find((x) => x.id === a.id),
      )
    }
    handlers[`POST /accounts/${a.id}/archive`] = set(true)
    handlers[`POST /accounts/${a.id}/restore`] = set(false)
    handlers[`DELETE /accounts/${a.id}`] = () => {
      accounts = accounts.filter((x) => x.id !== a.id)
      return json(204, null)
    }
  }
  const api = mockApi({ ...handlers, ...overrides })
  return { api, ...renderApp('/cuentas') }
}

async function choose(name: string, action: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Acciones de ${name}` }, SLOW))
  await userEvent.click(screen.getByRole('button', { name: action }))
}

function available(): string {
  const summary = screen.getByRole('region', { name: 'Resumen' })
  const term = within(summary).getByText('Saldo disponible', { selector: 'dt' })
  return term.nextElementSibling?.firstElementChild?.textContent.replace(/\s/g, ' ') ?? ''
}

describe('menú de acciones', () => {
  it('cuentas activas: editar, archivar y eliminar', async () => {
    const { container } = setup([NOMINA])
    const button = await screen.findByRole('button', { name: 'Acciones de Nómina' }, SLOW)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const region = screen.getByRole('region', { name: 'Cuentas y efectivo' })
    const items = within(region)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(items).toEqual(['', 'Editar', 'Archivar', 'Eliminar'])
    await expectNoAxeViolations(container)

    await userEvent.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
  }, 15000)
})

describe('archivar (CA-ACC-04)', () => {
  it('avisa del saldo, archiva, la pasa a Archivadas y deja de contar', async () => {
    const { api, container } = setup([NOMINA, BILLETERA])
    await choose('Billetera', 'Archivar')
    const dialog = screen.getByRole('dialog', { name: '¿Archivar Billetera?' })
    expect(dialog).toHaveTextContent('Esta cuenta tiene un saldo de $ 250.000.')
    expect(dialog).toHaveTextContent('Al archivarla, deja de contar en tus totales.')
    await expectNoAxeViolations(container)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Archivar cuenta' }))
    expect(await screen.findByText('Archivamos Billetera.')).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.headers(`POST /accounts/${BILLETERA.id}/archive`)[0]?.['X-CSRF-Token']).toBe(
      'csrf-activa',
    )
    await waitFor(() => {
      expect(available()).toBe('$ 1.000')
    })
    const liquid = screen.getByRole('region', { name: 'Cuentas y efectivo' })
    expect(within(liquid).queryByText('Billetera')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cuentas archivadas' })).toHaveTextContent(
      'Billetera',
    )
  })

  it('sin saldo no muestra el aviso', async () => {
    setup([VACIA])
    await choose('Vacía', 'Archivar')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('tiene un saldo')
  })

  it('Cancelar no archiva', async () => {
    const { api } = setup([BILLETERA])
    await choose('Billetera', 'Archivar')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.bodies(`POST /accounts/${BILLETERA.id}/archive`)).toEqual([])
  })

  it('si falla, el error se muestra dentro del diálogo', async () => {
    setup([BILLETERA], {
      [`POST /accounts/${BILLETERA.id}/archive`]: () =>
        problem(500, 'internal_error', 'Algo salió mal de nuestro lado.'),
    })
    await choose('Billetera', 'Archivar')
    await userEvent.click(screen.getByRole('button', { name: 'Archivar cuenta' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Algo salió mal de nuestro lado.',
    )
  })
})

describe('reactivar (RF-ACC-08)', () => {
  it('desde Archivadas, sin confirmación, y vuelve a contar', async () => {
    const { api } = setup([NOMINA, { ...BILLETERA, archived: true }])
    const archived = await screen.findByRole('region', { name: 'Cuentas archivadas' }, SLOW)
    await userEvent.click(within(archived).getByText('Archivadas (1)', { exact: false }))
    await userEvent.click(within(archived).getByRole('button', { name: 'Acciones de Billetera' }))
    const items = within(archived)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(items).toEqual(['', 'Reactivar', 'Eliminar'])
    await userEvent.click(within(archived).getByRole('button', { name: 'Reactivar' }))

    expect(await screen.findByText('Reactivamos Billetera.')).toBeVisible()
    expect(api.bodies(`POST /accounts/${BILLETERA.id}/restore`)).toHaveLength(1)
    await waitFor(() => {
      expect(available()).toBe('$ 251.000')
    })
    expect(screen.queryByRole('region', { name: 'Cuentas archivadas' })).not.toBeInTheDocument()
  })
})

describe('eliminar (CA-ACC-05)', () => {
  it('confirma y la cuenta desaparece por completo', async () => {
    const { api, container } = setup([NOMINA, VACIA])
    await choose('Vacía', 'Eliminar')
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar Vacía?' })
    expect(dialog).toHaveAccessibleDescription(
      'La cuenta se borrará definitivamente. Esta acción no se puede deshacer.',
    )
    // "Cancelar" va primero.
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cancelar', 'Eliminar cuenta'])
    await expectNoAxeViolations(container)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar cuenta' }))

    expect(await screen.findByText('Eliminamos Vacía.')).toBeVisible()
    expect(api.bodies(`DELETE /accounts/${VACIA.id}`)).toEqual([{}])
    await waitFor(() => {
      expect(screen.queryByText('Vacía')).not.toBeInTheDocument()
    })
  })

  it('VAL-ACC-08: con movimientos, ofrece archivarla', async () => {
    const { api } = setup([BILLETERA], {
      [`DELETE /accounts/${BILLETERA.id}`]: () =>
        problem(
          409,
          'account_has_movements',
          'Esta cuenta tiene movimientos. Puedes archivarla para ocultarla sin perder su historial.',
        ),
    })
    await choose('Billetera', 'Eliminar')
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta' }))
    const dialog = await screen.findByRole('dialog', { name: 'No podemos eliminar Billetera' })
    expect(dialog).toHaveAccessibleDescription(
      'Esta cuenta tiene movimientos. Puedes archivarla para ocultarla sin perder su historial.',
    )
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archivar cuenta' }))
    expect(await screen.findByText('Archivamos Billetera.')).toBeVisible()
    expect(api.bodies(`POST /accounts/${BILLETERA.id}/archive`)).toHaveLength(1)
  })

  it('VAL-ACC-08 en una archivada: solo informa', async () => {
    setup([{ ...BILLETERA, archived: true }], {
      [`DELETE /accounts/${BILLETERA.id}`]: () =>
        problem(
          409,
          'account_has_movements',
          'Esta cuenta tiene movimientos. Puedes archivarla para ocultarla sin perder su historial.',
        ),
    })
    const archived = await screen.findByRole('region', { name: 'Cuentas archivadas' }, SLOW)
    await userEvent.click(within(archived).getByText('Archivadas (1)', { exact: false }))
    await userEvent.click(within(archived).getByRole('button', { name: 'Acciones de Billetera' }))
    await userEvent.click(within(archived).getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta' }))
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar Billetera?' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Esta cuenta tiene movimientos.',
    )
    expect(within(dialog).queryByRole('button', { name: 'Archivar cuenta' })).toBeNull()
  })

  it('404: cierra el diálogo, avisa y recarga', async () => {
    const { api } = setup([NOMINA], {
      [`DELETE /accounts/${NOMINA.id}`]: () =>
        problem(404, 'account_not_found', 'No encontramos esa cuenta.'),
    })
    await choose('Nómina', 'Eliminar')
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos esa cuenta.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(api.bodies('GET /accounts').length).toBeGreaterThan(1)
    })
  })
})
