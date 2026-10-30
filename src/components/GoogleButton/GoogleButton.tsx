import { GoogleIcon } from '../icons/index.ts'
import styles from './GoogleButton.module.css'

export interface GoogleButtonProps {
  /** URL de `GET /api/v1/auth/google/start` con su `intent` y, si aplica, la política. */
  href: string
  children?: string
}

/**
 * Inicio con Google. Es un enlace, no un botón: el flujo es una navegación completa al
 * backend, que redirige a Google (ADR-0002); ningún token pasa por JavaScript.
 */
export function GoogleButton({ href, children = 'Continuar con Google' }: GoogleButtonProps) {
  return (
    <a className={styles.google} href={href}>
      <span className={styles.logo}>
        <GoogleIcon />
      </span>
      {children}
    </a>
  )
}
