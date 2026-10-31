import {
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react'

import { ErrorIcon } from '../../components/icons/index.ts'
import styles from './TransactionForm.module.css'

interface FieldShellProps {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}

/** Etiqueta, ayuda y error como en `TextField`, para `select` y `textarea`. */
function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-ayuda`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          <ErrorIcon />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  return (
    [hint ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  )
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string
  ref?: Ref<HTMLSelectElement>
}

/** Lista desplegable compatible con `register` de React Hook Form. */
export function SelectField({ label, hint, error, children, ...props }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={[styles.control, error && styles.invalid].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  label: string
  hint?: ReactNode
  error?: string
  ref?: Ref<HTMLTextAreaElement>
}

export function TextAreaField({ label, hint, error, ...props }: TextAreaFieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        className={[styles.control, styles.textarea, error && styles.invalid]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </FieldShell>
  )
}
