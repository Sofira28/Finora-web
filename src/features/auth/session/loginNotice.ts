/**
 * Aviso de un solo uso para la página de inicio de sesión cuando se llega por perder la
 * sesión: `session_expired` (VAL-AUTH-10, lo marca el cliente API ante un `401`) o
 * `account_deleted` (tras eliminar la cuenta). No viaja en el estado de navegación porque
 * `ProtectedRoute` también redirige al quedar sin sesión y lo reemplazaría.
 */

export type LoginNotice = 'session_expired' | 'account_deleted'

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión terminó. Inicia sesión de nuevo.'

let pending: LoginNotice | null = null

export function markLoginNotice(notice: LoginNotice): void {
  pending = notice
}

/** El aviso pendiente, sin limpiarlo (seguro aunque React renderice dos veces). */
export function peekLoginNotice(): LoginNotice | null {
  return pending
}

export function clearLoginNotice(): void {
  pending = null
}

/** Devuelve el aviso pendiente y lo limpia. */
export function consumeLoginNotice(): LoginNotice | null {
  const value = pending
  pending = null
  return value
}
