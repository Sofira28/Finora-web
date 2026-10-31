import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { vi } from 'vitest'

import { connectApiEvents, createQueryClient } from '../app/queryClient.ts'
import { routes } from '../app/routes.tsx'
import type { SessionInfo } from '../features/auth/session/index.ts'

/** Recibe el cuerpo enviado y la URL completa (para revisar la query). */
type Handler = (body: unknown, url: URL) => Response | Promise<Response>

/** "MÉTODO /ruta" de una llamada a fetch, sin /api/v1 ni query. */
function routeKey(input: RequestInfo | URL, init?: RequestInit): string {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const path = url.replace('/api/v1', '').split('?')[0] ?? ''
  return `${init?.method ?? 'GET'} ${path}`
}

function parseBody(init?: RequestInit): unknown {
  return typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
}

export const ANONYMOUS: SessionInfo = {
  stage: null,
  csrf_token: null,
  google_enabled: false,
  user: null,
}

export function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function problem(status: number, code: string, title: string, extra: object = {}) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, code, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

/**
 * Simula la API por "MÉTODO /ruta" (sin /api/v1 ni query). Una petición sin simulación falla
 * la prueba. Por defecto no hay sesión.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const all: Record<string, Handler> = {
    'GET /auth/session': () => json(200, ANONYMOUS),
    ...handlers,
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = routeKey(input, init)
    const handler = all[key]
    if (!handler) throw new Error(`Petición sin simulación: ${key}`)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return handler(parseBody(init), new URL(url, 'http://localhost'))
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    fetchMock,
    /** Cuerpos enviados a "MÉTODO /ruta". */
    bodies(key: string): unknown[] {
      return fetchMock.mock.calls
        .filter(([input, init]) => routeKey(input, init) === key)
        .map(([, init]) => parseBody(init))
    },
    /** Cabeceras de las llamadas a "MÉTODO /ruta". */
    headers(key: string): Record<string, string>[] {
      return fetchMock.mock.calls
        .filter(([input, init]) => routeKey(input, init) === key)
        .map(([, init]) => (init?.headers ?? {}) as Record<string, string>)
    },
  }
}

/** Monta la aplicación real (rutas, QueryClient, StrictMode) en una URL. */
export function renderApp(url: string, state?: unknown) {
  const client = createQueryClient()
  connectApiEvents(client)
  const [pathname = '/', search = ''] = url.split('?')
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname, search: search ? `?${search}` : '', state }],
  })
  const view = render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
  return { router, client, ...view }
}
