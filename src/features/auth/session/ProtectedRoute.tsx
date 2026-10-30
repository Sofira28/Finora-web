import { Navigate, Outlet, useLocation } from 'react-router'

import type { SessionStage } from './api.ts'
import { homeForStage, safeRedirect } from './stages.ts'
import styles from './ProtectedRoute.module.css'
import { useSession } from './useSession.ts'

/** Estado de navegación que recibe la página de inicio de sesión. */
export interface LoginRedirectState {
  /** Ruta protegida a la que se quería entrar; se vuelve a ella tras iniciar sesión. */
  from?: string
  /** Se acaba de confirmar el correo (viene de /verificar-correo). */
  emailVerified?: boolean
  /** Se acaba de restablecer la contraseña (viene de /restablecer-contrasena). */
  passwordReset?: boolean
}

interface ProtectedRouteProps {
  /** Etapa que exige la ruta; por defecto, sesión completa. */
  stage?: SessionStage
}

/**
 * Muestra las rutas hijas solo si la sesión está en la etapa indicada; si no, redirige a
 * donde corresponde a la sesión actual (plan de authentication §3).
 */
export function ProtectedRoute({ stage = 'active' }: ProtectedRouteProps) {
  const location = useLocation()
  const session = useSession()

  if (session.isPending) {
    return (
      <div className={styles.status} role="status">
        Cargando…
      </div>
    )
  }
  if (session.isError) {
    return (
      <div className={styles.status} role="alert">
        <p>{session.error.message}</p>
        <button
          className={styles.retry}
          type="button"
          onClick={() => {
            void session.refetch()
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  const current = session.data.stage
  if (current === stage) return <Outlet />

  if (current === null) {
    const state: LoginRedirectState = { from: `${location.pathname}${location.search}` }
    return <Navigate to={homeForStage(null)} replace state={state} />
  }
  // Entre etapas se conserva el destino original (p. ej. del código MFA a /perfil).
  const state = location.state as LoginRedirectState | null
  const target = current === 'active' ? safeRedirect(state?.from) : homeForStage(current)
  return <Navigate to={target} replace state={state} />
}
