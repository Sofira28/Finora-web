import type { SessionStage } from './api.ts'

/** Ruta a la que pertenece cada etapa de sesión; `null` es sin sesión. */
export function homeForStage(stage: SessionStage | null): string {
  switch (stage) {
    case 'active':
      return '/'
    case 'mfa_pending':
      return '/iniciar-sesion/codigo'
    case 'link_pending':
      return '/iniciar-sesion/vincular-google'
    case null:
      return '/iniciar-sesion'
  }
}

/**
 * Destino tras iniciar sesión: solo rutas internas. Evita redirecciones abiertas
 * (`//sitio.malo`, `https://…`) si alguien manipula el estado de navegación.
 */
export function safeRedirect(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}
