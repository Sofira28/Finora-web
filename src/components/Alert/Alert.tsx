import type { ReactNode } from 'react'

import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from '../icons/index.ts'
import styles from './Alert.module.css'

export type AlertVariant = 'error' | 'success' | 'info' | 'warning'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children?: ReactNode
  className?: string
}

const ICONS = { error: ErrorIcon, success: SuccessIcon, info: InfoIcon, warning: WarningIcon }

/**
 * Mensaje destacado. Los errores usan `role="alert"` (se anuncian de inmediato); los demás,
 * `role="status"` (se anuncian sin interrumpir).
 */
export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const Icon = ICONS[variant]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={[styles.alert, styles[variant], className].filter(Boolean).join(' ')}
    >
      <Icon />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.content}>{children}</div>}
      </div>
    </div>
  )
}
