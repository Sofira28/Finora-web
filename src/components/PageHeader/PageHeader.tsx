import type { ReactNode } from 'react'

import styles from './PageHeader.module.css'

export interface PageHeaderProps {
  /** Título de la página: único `h1`. */
  title: string
  description?: ReactNode
  /** Acciones principales de la página (p. ej. "Nueva cuenta"). */
  actions?: ReactNode
}

/** Encabezado de las páginas dentro de `AppShell`. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
