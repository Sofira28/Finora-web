import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest, setApiEventHandlers, setCsrfToken } from './client.ts'

const fetchMock = vi.fn<typeof fetch>()

function json(status: number, body: unknown, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })
}

function problem(status: number, code: string, title: string, extra: object = {}): Response {
  return json(
    status,
    { type: 'about:blank', title, status, code, ...extra },
    'application/problem+json',
  )
}

function lastInit(): RequestInit {
  const call = fetchMock.mock.calls.at(-1)
  if (!call?.[1]) throw new Error('fetch no fue llamado con opciones')
  return call[1]
}

function lastHeaders(): Record<string, string> {
  return lastInit().headers as Record<string, string>
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  setCsrfToken(null)
  setApiEventHandlers({})
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('pide al mismo origen con la cookie de sesión', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }))
    await expect(apiRequest('/auth/session')).resolves.toEqual({ ok: true })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/auth/session')
    expect(lastInit()).toMatchObject({ method: 'GET', credentials: 'same-origin' })
    expect(lastInit().body).toBeUndefined()
  })

  it('las lecturas no llevan token anti-CSRF', async () => {
    setCsrfToken('csrf-123')
    fetchMock.mockResolvedValue(json(200, {}))
    await apiRequest('/me')
    expect(lastHeaders()).not.toHaveProperty('X-CSRF-Token')
  })

  it('las escrituras llevan JSON y el token anti-CSRF (VAL-AUTH-11)', async () => {
    setCsrfToken('csrf-123')
    fetchMock.mockResolvedValue(json(200, { name: 'Ana' }))
    await apiRequest('/me', { method: 'PATCH', body: { name: 'Ana' } })
    expect(lastHeaders()).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'csrf-123',
    })
    expect(lastInit().body).toBe('{"name":"Ana"}')
  })

  it('sin cuerpo envía un objeto JSON vacío (el backend exige JSON)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
    expect(lastInit().body).toBe('{}')
    expect(lastHeaders()).not.toHaveProperty('X-CSRF-Token') // sin sesión no hay token
  })

  it('convierte problem+json en ApiError tipado', async () => {
    fetchMock.mockResolvedValue(
      problem(422, 'validation_failed', 'Los datos no son válidos.', {
        errors: [
          {
            loc: ['body', 'password'],
            type: 'too_short',
            message: 'La contraseña debe tener al menos 12 caracteres.',
          },
        ],
      }),
    )
    const error = await apiRequest('/auth/register', { method: 'POST' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(422)
    expect(apiError.code).toBe('validation_failed')
    expect(apiError.message).toBe('Los datos no son válidos.')
    expect(apiError.fieldMessage('password')).toBe(
      'La contraseña debe tener al menos 12 caracteres.',
    )
    expect(apiError.fieldMessage('email')).toBeUndefined()
  })

  it('un error sin cuerpo RFC 9457 da un mensaje genérico', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }))
    await expect(apiRequest('/me')).rejects.toMatchObject({
      status: 502,
      message: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
    })
  })

  it('un fallo de red da un ApiError con estado 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiRequest('/me')).rejects.toMatchObject({
      status: 0,
      message: 'No pudimos conectar con FINORA. Revisa tu conexión e intenta de nuevo.',
    })
  })

  it('una cancelación se propaga tal cual', async () => {
    fetchMock.mockRejectedValue(new DOMException('cancelada', 'AbortError'))
    await expect(apiRequest('/me')).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('avisos a la aplicación', () => {
  it('401 session_expired avisa que la sesión terminó (VAL-AUTH-10)', async () => {
    const onSessionExpired = vi.fn()
    setApiEventHandlers({ onSessionExpired })
    fetchMock.mockResolvedValue(
      problem(401, 'session_expired', 'Tu sesión terminó. Inicia sesión de nuevo.'),
    )
    await expect(apiRequest('/me')).rejects.toMatchObject({ code: 'session_expired' })
    expect(onSessionExpired).toHaveBeenCalledOnce()
  })

  it('401 de credenciales incorrectas no es una sesión vencida', async () => {
    const onSessionExpired = vi.fn()
    setApiEventHandlers({ onSessionExpired })
    fetchMock.mockResolvedValue(
      problem(401, 'invalid_credentials', 'El correo o la contraseña no son correctos.'),
    )
    await expect(apiRequest('/auth/login', { method: 'POST' })).rejects.toBeInstanceOf(ApiError)
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('403 csrf_failed avisa para renovar el token (VAL-AUTH-11)', async () => {
    const onCsrfFailed = vi.fn()
    setApiEventHandlers({ onCsrfFailed })
    fetchMock.mockResolvedValue(
      problem(
        403,
        'csrf_failed',
        'No pudimos completar la acción. Recarga la página e intenta de nuevo.',
      ),
    )
    await expect(apiRequest('/me', { method: 'PATCH' })).rejects.toMatchObject({
      message: 'No pudimos completar la acción. Recarga la página e intenta de nuevo.',
    })
    expect(onCsrfFailed).toHaveBeenCalledOnce()
  })
})
