import { QueryClient } from '@tanstack/react-query'

import {
  anonymousSession,
  markLoginNotice,
  type SessionInfo,
  sessionQueryKey,
} from '../features/auth/session/index.ts'
import { ApiError, setApiEventHandlers, setCsrfToken } from '../lib/api/index.ts'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Un 4xx no mejora reintentando; un fallo de red o un 5xx se reintenta una vez.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 1,
      },
    },
  })
}

function isSessionQuery(key: readonly unknown[]): boolean {
  return (
    key.length === sessionQueryKey.length && key.every((part, i) => part === sessionQueryKey[i])
  )
}

/** Conecta los avisos del cliente API con el estado de sesión de la aplicación. */
export function connectApiEvents(client: QueryClient): void {
  setApiEventHandlers({
    onSessionExpired: () => {
      const previous = client.getQueryData<SessionInfo>(sessionQueryKey)
      markLoginNotice('session_expired')
      setCsrfToken(null)
      // Ningún dato del usuario queda en memoria. La consulta de sesión se conserva (la
      // observa ProtectedRoute) y pasa a "sin sesión", lo que lleva al inicio de sesión.
      client.removeQueries({ predicate: (query) => !isSessionQuery(query.queryKey) })
      client.getMutationCache().clear()
      client.setQueryData(sessionQueryKey, anonymousSession(previous?.google_enabled ?? false))
    },
    onCsrfFailed: () => {
      void client.invalidateQueries({ queryKey: sessionQueryKey })
    },
  })
}
