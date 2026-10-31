import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionInfo } from '../../features/auth/session/index.ts'
import { setCsrfToken } from '../../lib/api/index.ts'
import { json, mockApi, renderApp } from '../../test/app.tsx'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { initials } from './initials.ts'

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: false,
  user: { name: 'Ana María Gómez', email: 'ana@correo.com' },
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
  localStorage.clear()
  setViewport(1440)
})

afterEach(() => {
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

// La página Cuentas pide su listado; aquí basta con que no tenga cuentas.
const NO_ACCOUNTS = {
  accounts: [],
  totals: { available_balance: '0.00', net_worth: '0.00', credit_card_debt: '0.00' },
}

async function renderShell(url = '/') {
  mockApi({
    'GET /auth/session': () => json(200, ACTIVE),
    'GET /accounts': () => json(200, NO_ACCOUNTS),
  })
  const view = renderApp(url)
  await screen.findByRole('navigation', { name: 'Navegación principal' })
  return view
}

describe('AppShell (T-ACC-FE-02)', () => {
  it('tiene enlace para saltar al contenido, navegación, encabezado y main', async () => {
    const { container } = await renderShell()
    const skip = screen.getByRole('link', { name: 'Saltar al contenido' })
    expect(skip).toHaveAttribute('href', '#contenido')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenido')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Ana María Gómez' })).toBeVisible()
    await expectNoAxeViolations(container)
  })

  it('solo muestra las secciones implementadas y marca la actual', async () => {
    await renderShell('/cuentas')
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    const names = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(names).toEqual(['FINORA Tu dinero, más claro', 'Inicio', 'Cuentas'])
    expect(within(nav).getByRole('link', { name: 'Cuentas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Cuentas y tarjetas' },
        { timeout: 5000 },
      ),
    ).toBeVisible()
  })

  it('navega entre secciones y lleva el foco al contenido', async () => {
    const { router } = await renderShell()
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    await userEvent.click(within(nav).getByRole('link', { name: 'Cuentas' }))
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Cuentas y tarjetas' },
        { timeout: 5000 },
      ),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/cuentas')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('el perfil vive dentro de la estructura', async () => {
    mockApi({
      'GET /auth/session': () => json(200, ACTIVE),
      'GET /me': () => new Promise<Response>(() => undefined),
    })
    renderApp('/perfil')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tu perfil' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
  })
})

describe('barra lateral', () => {
  it('en escritorio se contrae y recuerda la preferencia', async () => {
    const { unmount } = await renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Contraer menú' }))
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument()
    // Contraída, cada sección conserva su nombre y lo muestra como sugerencia.
    expect(screen.getByRole('link', { name: 'Cuentas' })).toHaveAttribute('title', 'Cuentas')
    expect(localStorage.getItem('finora.sidebar.collapsed')).toBe('true')

    unmount()
    await renderShell()
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument()
  })

  it('en tablet y móvil no ofrece contraerla', async () => {
    setViewport(1024)
    await renderShell()
    expect(screen.queryByRole('button', { name: /menú$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cuentas' })).toBeInTheDocument()
  })

  it('funciona sin almacenamiento disponible', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    await renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Contraer menú' }))
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})

describe('menú de perfil', () => {
  it('muestra los datos del usuario y sus opciones', async () => {
    const { container } = await renderShell()
    const button = screen.getByRole('button', { name: 'Menú de perfil' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveTextContent('AG')

    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('ana@correo.com')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/perfil')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
    await expectNoAxeViolations(container)
  })

  it('Esc lo cierra y devuelve el foco al botón', async () => {
    await renderShell()
    const button = screen.getByRole('button', { name: 'Menú de perfil' })
    await userEvent.click(button)
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('link', { name: 'Mi perfil' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('se cierra al hacer clic fuera o al salir con Tab', async () => {
    await renderShell()
    const button = screen.getByRole('button', { name: 'Menú de perfil' })
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('main'))
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(button)
    await userEvent.tab() // Mi perfil
    await userEvent.tab() // Cerrar sesión
    await userEvent.tab() // fuera del menú
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('"Mi perfil" lleva al perfil y cierra el menú', async () => {
    mockApi({
      'GET /auth/session': () => json(200, ACTIVE),
      'GET /me': () => new Promise<Response>(() => undefined),
    })
    const { router } = renderApp('/')
    await userEvent.click(await screen.findByRole('button', { name: 'Menú de perfil' }))
    await userEvent.click(screen.getByRole('link', { name: 'Mi perfil' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/perfil')
    })
    expect(screen.getByRole('button', { name: 'Menú de perfil' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})

describe('initials', () => {
  it.each([
    ['Ana', 'A'],
    ['Ana María Gómez', 'AG'],
    ['  luis   pérez ', 'LP'],
    ['Ángela', 'Á'],
    ['Óscar ñuñez', 'ÓÑ'],
  ])('%j → %j', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })
})
