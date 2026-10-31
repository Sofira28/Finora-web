import type { ButtonHTMLAttributes, MouseEvent } from 'react'

import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  fullWidth?: boolean
  /** Mientras se envía: no responde, con indicador, `aria-disabled` y `aria-busy`. */
  loading?: boolean
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  type = 'button',
  className,
  onClick,
  children,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth && styles.fullWidth, className]
  return (
    <button
      type={type}
      className={classes.filter(Boolean).join(' ')}
      // Al cargar no se usa `disabled`: el navegador sacaría el foco del botón (lo dejaría en
      // <body>) y quien usa teclado o lector de pantalla perdería su lugar (WCAG 2.4.3).
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        // También bloquea el envío implícito del formulario (Enter en un campo).
        if (loading) event.preventDefault()
        else onClick?.(event)
      }}
      {...props}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  )
}
