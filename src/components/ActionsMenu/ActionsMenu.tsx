import {
  type ComponentType,
  type SVGProps,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { MoreIcon } from '../icons/index.ts'
import styles from './ActionsMenu.module.css'

export interface ActionItem {
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  onSelect: () => void
  /** Acción destructiva (p. ej. eliminar): se distingue por color y por el texto. */
  danger?: boolean
}

export interface ActionsMenuProps {
  /** Nombre accesible del botón; debe decir de qué son las acciones ("Acciones de Nómina"). */
  label: string
  items: ActionItem[]
}

/**
 * Botón "más acciones" que despliega una lista de botones (patrón de divulgación, como el menú
 * de perfil). Se cierra con Esc (el foco vuelve al botón), al hacer clic fuera, al salir con
 * Tab o al elegir una acción.
 */
export function ActionsMenu({ label, items }: ActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const panelRef = useRef<HTMLUListElement>(null)

  // Si no cabe debajo (p. ej. sobre la barra inferior del móvil), se abre hacia arriba. Se
  // mide antes de pintar y se marca en el DOM, sin otro render.
  useLayoutEffect(() => {
    const panel = panelRef.current
    const trigger = buttonRef.current?.getBoundingClientRect()
    if (!open || !panel || !trigger) return
    // Lo que quede por debajo del botón y tape el menú (la barra inferior en móvil).
    const bar = document.querySelector('[data-bottom-bar]')?.getBoundingClientRect()
    const limit = bar && bar.top > trigger.bottom ? bar.top : window.innerHeight
    const height = panel.getBoundingClientRect().height + 8
    panel.dataset.placement =
      height > limit - trigger.bottom && trigger.top > height ? 'top' : 'bottom'
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          buttonRef.current?.focus()
        }
      }}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <MoreIcon />
      </button>
      {open && (
        <ul ref={panelRef} id={panelId} className={styles.menu}>
          {items.map(({ label: itemLabel, icon: Icon, onSelect, danger }) => (
            <li key={itemLabel}>
              <button
                type="button"
                className={styles.item}
                data-danger={danger || undefined}
                onClick={() => {
                  setOpen(false)
                  // El foco vuelve al botón: el diálogo que abra la acción lo devolverá ahí.
                  buttonRef.current?.focus()
                  onSelect()
                }}
              >
                <Icon />
                {itemLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
