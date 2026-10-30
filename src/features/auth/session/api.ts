import type { QueryClient } from '@tanstack/react-query'

import { apiRequest, type Schema, setCsrfToken } from '../../../lib/api/index.ts'

export type SessionInfo = Schema<'SessionResponse'>
export type SessionStage = NonNullable<SessionInfo['stage']>

export const sessionQueryKey = ['auth', 'session'] as const

/** Sesión sin iniciar; conserva si Google está disponible. */
export function anonymousSession(googleEnabled: boolean): SessionInfo {
  return { stage: null, csrf_token: null, google_enabled: googleEnabled, user: null }
}

/** `GET /auth/session`: siempre 200; sin sesión, `stage` es `null`. */
export async function fetchSession(signal?: AbortSignal): Promise<SessionInfo> {
  const session = await apiRequest<SessionInfo>('/auth/session', { signal })
  setCsrfToken(session.csrf_token)
  return session
}

/** Vuelve a pedir la sesión (tras iniciarla o cambiar de etapa) y actualiza la caché. */
export function refreshSession(client: QueryClient): Promise<SessionInfo> {
  return client.query({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => fetchSession(signal),
    staleTime: 0,
  })
}

/**
 * Deja el navegador sin sesión y sin datos del usuario en memoria (cierre de sesión,
 * eliminación de la cuenta). Conserva si Google está disponible para el inicio de sesión.
 */
export function clearLocalSession(client: QueryClient): void {
  const previous = client.getQueryData<SessionInfo>(sessionQueryKey)
  setCsrfToken(null)
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionQueryKey[0] })
  client.setQueryData(sessionQueryKey, anonymousSession(previous?.google_enabled ?? false))
}
