import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import { Alert } from '../../components/index.ts'
import { LogoutIcon, UserIcon } from '../../components/icons/index.ts'
import { useLogout } from '../../features/auth/login/useLogout.ts'
import { useSession } from '../../features/auth/session/index.ts'
import { errorMessage } from '../../features/auth/shared/formErrors.ts'
import styles from './AppShell.module.css'
import { initials } from './initials.ts'

/**
 * Menú de perfil del encabezado: botón que despliega "Mi perfil" y "Cerrar sesión" (patrón
 * de divulgación). Se cierra con Esc (el foco vuelve al botón), al hacer clic fuera o al
 * elegir una opción.
 */
export function ProfileMenu() {
  const session = useSession()
  const logout = useLogout()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const user = session.data?.user

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

  if (!user) return null

  return (
    <div
      ref={containerRef}
      className={styles.profile}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          buttonRef.current?.focus()
        }
      }}
      onBlur={(event) => {
        // Al salir con Tab del menú, se cierra.
        if (open && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.avatarButton}
        aria-label="Menú de perfil"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials(user.name)}
        </span>
      </button>
      {open && (
        <div id={panelId} className={styles.menu}>
          <div className={styles.menuUser}>
            <span className={styles.menuName}>{user.name}</span>
            <span className={styles.menuEmail}>{user.email}</span>
          </div>
          {logout.isError && <Alert variant="error">{errorMessage(logout.error)}</Alert>}
          <ul className={styles.menuList}>
            <li>
              <Link
                to="/perfil"
                className={styles.menuItem}
                onClick={() => {
                  setOpen(false)
                }}
              >
                <UserIcon />
                Mi perfil
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={styles.menuItem}
                aria-disabled={logout.isPending || undefined}
                aria-busy={logout.isPending || undefined}
                onClick={() => {
                  if (!logout.isPending) logout.mutate()
                }}
              >
                <LogoutIcon />
                {logout.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
