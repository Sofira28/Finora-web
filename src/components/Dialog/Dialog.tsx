import { type ReactNode, useEffect, useId, useRef } from 'react'

import styles from './Dialog.module.css'

export interface DialogProps {
  open: boolean
  title: string
  description?: ReactNode
  children: ReactNode
  /** Al cerrar con Esc o con el botón de cerrar. */
  onClose: () => void
}

/**
 * Diálogo modal sobre `<dialog>` nativo: el navegador atrapa el foco, lo devuelve al cerrar
 * y cierra con Esc.
 */
export function Dialog({ open, title, description, children, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Esc: el estado lo controla quien abre el diálogo.
        event.preventDefault()
        onClose()
      }}
    >
      {open && (
        <div className={styles.body}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
          </header>
          {children}
        </div>
      )}
    </dialog>
  )
}
