/**
 * Cliente HTTP de la API de FINORA (specs/api-contracts.md §4).
 *
 * - Mismo origen (proxy de Vite en desarrollo) y `credentials: 'same-origin'`: la cookie de
 *   sesión es HttpOnly y nunca la toca JavaScript.
 * - Los métodos que modifican datos llevan `X-CSRF-Token` (VAL-AUTH-11).
 * - Los errores `application/problem+json` (RFC 9457) se convierten en `ApiError`.
 * - Un `401 session_expired` avisa a la aplicación para volver al inicio de sesión (VAL-AUTH-10).
 */

export const API_BASE = '/api/v1'

/** Error de un campo, como lo devuelve el backend en los `422`. */
export interface FieldError {
  loc: (string | number)[]
  type: string
  message?: string
}

/** Cuerpo RFC 9457 con el `code` estable de FINORA. */
export interface Problem {
  type: string
  title: string
  status: number
  code?: string
  instance?: string
  errors?: FieldError[]
}

const UNEXPECTED_TITLE = 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'
const NETWORK_TITLE = 'No pudimos conectar con FINORA. Revisa tu conexión e intenta de nuevo.'

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem

  constructor(problem: Problem) {
    super(problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.problem = problem
  }

  get code(): string | undefined {
    return this.problem.code
  }

  /** Mensaje del primer error del campo indicado (p. ej. `password`), si lo hay. */
  fieldMessage(field: string): string | undefined {
    return this.problem.errors?.find((e) => e.loc.at(-1) === field)?.message
  }
}

export interface ApiEventHandlers {
  /** La sesión venció o no existe en una petición que la exige (VAL-AUTH-10). */
  onSessionExpired?: () => void
  /** El token anti-CSRF no fue aceptado (VAL-AUTH-11): conviene pedir uno nuevo. */
  onCsrfFailed?: () => void
}

let csrfToken: string | null = null
let handlers: ApiEventHandlers = {}

/** Token anti-CSRF de la sesión actual (llega en `GET /auth/session`). */
export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export function setApiEventHandlers(next: ApiEventHandlers): void {
  handlers = next
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

function isProblem(value: unknown): value is Problem {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Problem).title === 'string' &&
    typeof (value as Problem).status === 'number'
  )
}

async function toApiError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes('json')) {
    try {
      const body: unknown = await response.json()
      if (isProblem(body)) return new ApiError(body)
    } catch {
      // Cuerpo ilegible: se usa el error genérico.
    }
  }
  return new ApiError({ type: 'about:blank', title: UNEXPECTED_TITLE, status: response.status })
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  // El backend exige JSON en todo método que modifica datos, aunque no haya cuerpo.
  if (UNSAFE_METHODS.has(method)) {
    headers['Content-Type'] = 'application/json'
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  }
  const body = UNSAFE_METHODS.has(method) ? JSON.stringify(options.body ?? {}) : undefined

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError({ type: 'about:blank', title: NETWORK_TITLE, status: 0 })
  }

  if (!response.ok) {
    const error = await toApiError(response)
    if (error.status === 401 && error.code === 'session_expired') handlers.onSessionExpired?.()
    if (error.status === 403 && error.code === 'csrf_failed') handlers.onCsrfFailed?.()
    throw error
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
