import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'

import { ChevronLeftIcon, FinoraLogo } from '../../components/icons/index.ts'
import { NAV_ITEMS } from './navigation.ts'
import { ProfileMenu } from './ProfileMenu.tsx'
import { readSidebarCollapsed, writeSidebarCollapsed } from './sidebarPreference.ts'
import { useMediaQuery } from './useMediaQuery.ts'
import styles from './AppShell.module.css'

// Rangos de docs/guides/claude-design.md §3.
const DESKTOP = '(min-width: 1200px)'

/**
 * Estructura de las rutas con sesión (plan de accounts §3.1): barra lateral (escritorio,
 * contraíble; tablet, contraída), barra inferior en móvil, encabezado con el menú de perfil y
 * `main` con la página. La misma `nav` cambia de forma con CSS según el ancho.
 */
export function AppShell() {
  const isDesktop = useMediaQuery(DESKTOP)
  const [preferCollapsed, setPreferCollapsed] = useState(readSidebarCollapsed)
  const collapsed = !isDesktop || preferCollapsed
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const firstRender = useRef(true)

  // Al cambiar de sección, el foco pasa al contenido nuevo (como al cargar una página).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus()
  }, [pathname])

  const toggle = () => {
    const next = !preferCollapsed
    setPreferCollapsed(next)
    writeSidebarCollapsed(next)
  }
  const toggleLabel = preferCollapsed ? 'Expandir menú' : 'Contraer menú'

  return (
    <div className={styles.shell} data-collapsed={collapsed || undefined}>
      <a href="#contenido" className={styles.skipLink}>
        Saltar al contenido
      </a>

      <nav className={styles.nav} aria-label="Navegación principal">
        {/* El nombre es el texto visible, eslogan incluido (WCAG 2.5.3). */}
        <Link to="/" className={styles.brand}>
          <FinoraLogo />
          <span className={styles.brandText}>
            <span className={styles.brandName}>FINORA</span>{' '}
            <span className={styles.brandTagline}>Tu dinero, más claro</span>
          </span>
        </Link>
        <ul className={styles.navList}>
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={styles.navItem}
                title={collapsed ? label : undefined}
              >
                <Icon className={styles.navIcon} />
                <span className={styles.navLabel}>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        {isDesktop && (
          <button
            type="button"
            className={styles.collapseButton}
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={toggle}
          >
            <ChevronLeftIcon className={styles.collapseIcon} />
            <span className={styles.navLabel} aria-hidden="true">
              Contraer menú
            </span>
          </button>
        )}
      </nav>

      <div className={styles.column}>
        <header className={styles.header}>
          <Link to="/" className={styles.headerBrand} aria-label="FINORA, ir al inicio">
            <FinoraLogo width={30} height={30} />
            <span aria-hidden="true">FINORA</span>
          </Link>
          <ProfileMenu />
        </header>
        <main id="contenido" ref={mainRef} tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
