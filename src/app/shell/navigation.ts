import type { ComponentType, SVGProps } from 'react'

import { BankIcon, HomeIcon } from '../../components/icons/index.ts'

export interface NavItem {
  label: string
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

/**
 * Secciones de la navegación principal. Solo las implementadas (plan de accounts §3.1); cada
 * feature nueva agrega la suya aquí.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', to: '/', icon: HomeIcon },
  { label: 'Cuentas', to: '/cuentas', icon: BankIcon },
]
