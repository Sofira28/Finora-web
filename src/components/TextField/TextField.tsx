import { type InputHTMLAttributes, type ReactNode, type Ref, useId } from 'react'

import { ErrorIcon } from '../icons/index.ts'
import styles from './TextField.module.css'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Etiqueta visible; siempre presente (WCAG 3.3.2). */
  label: string
  hint?: ReactNode
  /** Mensaje de error del campo; marca el campo como inválido. */
  error?: string
  /** Control a la derecha dentro del campo (p. ej. mostrar u ocultar la contraseña). */
  trailing?: ReactNode
  /** Clase adicional del `input` (la de `className` va al contenedor). */
  inputClassName?: string
  ref?: Ref<HTMLInputElement>
  /** id del campo; si falta se genera uno. */
  id?: string
}

/**
 * Campo de texto con etiqueta, ayuda y error asociados por `aria-describedby`. Compatible con
 * `register` de React Hook Form (recibe `ref`, `name`, `onChange` y `onBlur`).
 */
export function TextField({
  label,
  hint,
  error,
  trailing,
  id,
  className,
  inputClassName,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-ayuda` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={[styles.control, error && styles.invalid].filter(Boolean).join(' ')}>
        <input
          id={inputId}
          className={[styles.input, inputClassName].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          <ErrorIcon />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
