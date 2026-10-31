import { Navigate, Outlet, useLocation } from 'react-router'

import type { LoginRedirectState } from './ProtectedRoute.tsx'
import { safeRedirect } from './stages.ts'

import { useSession } from './useSession.ts'

/** Páginas para quien no ha iniciado sesión (registro, inicio de sesión): con sesión, al inicio. */
export function GuestRoute() {
  const session = useSession()
  const state = useLocation().state as LoginRedirectState | null
  // Tras iniciar sesión, vuelve a la página protegida que se quería abrir.
  if (session.data?.stage === 'active') return <Navigate to={safeRedirect(state?.from)} replace />
  // Mientras carga o si falla la consulta se muestra la página: no hay datos que proteger.
  return <Outlet />
}
