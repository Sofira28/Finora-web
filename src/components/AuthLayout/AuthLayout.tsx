import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { FinoraLogo } from '../icons/index.ts'
import styles from './AuthLayout.module.css'

export interface AuthLayoutProps {
  /** Título de la pantalla: único `h1` de la página. */
  title: string
  description?: ReactNode
  children: ReactNode
  /** Enlaces al pie (p. ej. "¿No tienes cuenta? Regístrate"). */
  footer?: ReactNode
}

/** Marco común de las pantallas de autenticación (CD-04: derivado de los tokens). */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.brand} aria-label="FINORA, ir al inicio">
          <FinoraLogo />
          <span aria-hidden="true">FINORA</span>
        </Link>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </header>
        <div className={styles.content}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </main>
  )
}
