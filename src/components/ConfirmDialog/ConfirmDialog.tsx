import type { ReactNode } from 'react'

import { Alert } from '../Alert/Alert.tsx'
import { Button } from '../Button/Button.tsx'
import { Dialog } from '../Dialog/Dialog.tsx'
import styles from './ConfirmDialog.module.css'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  /** Texto del botón que confirma; debe decir la acción ("Eliminar cuenta"), no "Aceptar". */
  confirmLabel: string
  cancelLabel?: string
  /** `danger` para acciones definitivas. */
  variant?: 'primary' | 'danger'
  /** Mientras se ejecuta la acción. */
  loading?: boolean
  /** Error de la acción, dentro del diálogo para no perder el contexto. */
  error?: string
  /** Avisos o detalles adicionales (p. ej. "esta cuenta tiene saldo"). */
  children?: ReactNode
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirmación de una acción (archivar, eliminar…). "Cancelar" va primero y recibe el foco
 * al abrir: Enter o Esc por accidente no ejecutan nada.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  error,
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose}>
      {children}
      {error && <Alert variant="error">{error}</Alert>}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={variant} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
