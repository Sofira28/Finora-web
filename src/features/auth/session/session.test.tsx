import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, type RouteObject, useLocation } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectNoAxeViolations } from '../../../test/axe.ts'

import { connectApiEvents, createQueryClient } from '../../../app/queryClient.ts'
import { apiRequest, setApiEventHandlers, setCsrfToken } from '../../../lib/api/index.ts'
import type { SessionInfo } from './api.ts'
import { ProtectedRoute } from './ProtectedRoute.tsx'
import { consumeLoginNotice } from './loginNotice.ts'

const fetchMock = vi.fn<typeof fetch>()

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: true,
  user: { name: 'Ana', email: 'ana@correo.com' },
}
const ANONYMOUS: SessionInfo = { stage: null, csrf_token: null, google_enabled: true, user: null }

function respond(session: SessionInfo): void {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(session), { headers: { 'Content-Type': 'application/json' } }),
  )
}

function Where() {
  const location = useLocation()
  return (
    <p data-testid="where">
      {location.pathname}|{JSON.stringify(location.state)}
    </p>
  )
}

const routes: RouteObject[] = [
  {
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <h1>Inicio</h1> },
      { path: 'perfil', element: <h1>Perfil</h1> },
    ],
  },
  {
    element: <ProtectedRoute stage="mfa_pending" />,
    children: [{ path: 'iniciar-sesion/codigo', element: <h1>Código</h1> }],
  },
  { path: '*', element: <Where /> },
]

function renderAt(path: string) {
  const client = createQueryClient()
  connectApiEvents(client)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { client, router, ...view }
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  setCsrfToken(null)
  consumeLoginNotice()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  setApiEventHandlers({})
})

describe('ProtectedRoute', () => {
  it('con sesión activa muestra la ruta', async () => {
    respond(ACTIVE)
    renderAt('/perfil')
    expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/auth/session')
  })

  it('sin sesión lleva al inicio de sesión recordando a dónde iba', async () => {
    respond(ANONYMOUS)
    renderAt('/perfil?tab=seguridad')
    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/iniciar-sesion|{"from":"/perfil?tab=seguridad"}',
    )
  })

  it('con el código MFA pendiente lleva a la página del código', async () => {
    respond({ ...ACTIVE, stage: 'mfa_pending', user: null })
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Código' })).toBeInTheDocument()
  })

  it('con vinculación de Google pendiente lleva a esa página', async () => {
    respond({ ...ACTIVE, stage: 'link_pending', user: null })
    renderAt('/')
    expect(await screen.findByTestId('where')).toHaveTextContent('/iniciar-sesion/vincular-google|')
  })

  it('una página de etapa parcial con sesión activa vuelve al inicio', async () => {
    respond(ACTIVE)
    renderAt('/iniciar-sesion/codigo')
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('muestra la carga de forma accesible', async () => {
    fetchMock.mockReturnValue(new Promise(() => undefined))
    const { container } = renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    await expectNoAxeViolations(container)
  })

  it('si no hay conexión permite reintentar', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/')
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(
      'No pudimos conectar con FINORA.',
    )
    respond(ACTIVE)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })
})

describe('estado de sesión compartido con el cliente API', () => {
  it('guarda el token anti-CSRF de la sesión para las escrituras', async () => {
    respond(ACTIVE)
    renderAt('/')
    await screen.findByRole('heading', { name: 'Inicio' })
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await apiRequest('/auth/logout', { method: 'POST' })
    const headers = fetchMock.mock.calls.at(-1)?.[1]?.headers as Record<string, string>
    expect(headers['X-CSRF-Token']).toBe('csrf-activa')
  })

  it('VAL-AUTH-10: un 401 en plena sesión lleva al inicio de sesión', async () => {
    respond(ACTIVE)
    const { client } = renderAt('/perfil')
    await screen.findByRole('heading', { name: 'Perfil' })
    client.setQueryData(['datos', 'del', 'usuario'], { saldo: '1000' })

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'about:blank',
          title: 'Tu sesión terminó. Inicia sesión de nuevo.',
          status: 401,
          code: 'session_expired',
        }),
        { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    )
    await act(async () => {
      await apiRequest('/me').catch(() => undefined)
    })

    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/iniciar-sesion|{"from":"/perfil"}',
    )
    expect(consumeLoginNotice()).toBe('session_expired')
    expect(client.getQueryData(['datos', 'del', 'usuario'])).toBeUndefined()
    // Se conserva si Google está disponible para la página de inicio de sesión.
    expect(client.getQueryData<SessionInfo>(['auth', 'session'])?.google_enabled).toBe(true)
  })
})
