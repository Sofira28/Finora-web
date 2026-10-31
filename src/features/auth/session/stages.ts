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
 * (`//sitio.malo`, `/\sitio.malo`, `https://…`) si alguien manipula el estado de
 * navegación. Los navegadores tratan `\` como `/`, así que se rechaza en cualquier
 * parte, igual que los caracteres de control (que el navegador descarta al resolver).
 */
export function safeRedirect(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/'
  // eslint-disable-next-line no-control-regex -- se buscan justamente caracteres de control
  return /[\\\u0000-\u001f]/.test(from) ? '/' : from
}
