import type { Category, TransactionType } from './api.ts'

/** Tipos de movimiento que llevan categoría (RN-TRX-07). */
export type CategorizedType = Extract<TransactionType, 'expense' | 'income'>

interface CategoryInfo {
  /** Nombre en es-CO (`api-contracts.md` §6.2). */
  label: string
  /** Token de color del diseño (`docs/guides/claude-design.md`, colores de categoría). */
  color: string
}

/** Catálogo fijo de RN-TRX-07 (CD-10). */
export const CATEGORIES: Record<Category, CategoryInfo> = {
  housing: { label: 'Vivienda', color: 'var(--c-vivienda)' },
  groceries: { label: 'Mercado', color: 'var(--c-mercado)' },
  transport: { label: 'Transporte', color: 'var(--c-transporte)' },
  restaurants: { label: 'Restaurantes', color: 'var(--c-restaurantes)' },
  utilities: { label: 'Servicios', color: 'var(--c-servicios)' },
  health: { label: 'Salud', color: 'var(--c-salud)' },
  entertainment: { label: 'Entretenimiento', color: 'var(--c-entretenimiento)' },
  subscriptions: { label: 'Suscripciones', color: 'var(--c-suscripciones)' },
  debts: { label: 'Deudas', color: 'var(--c-deudas)' },
  salary: { label: 'Salario', color: 'var(--c-salario)' },
  freelance: { label: 'Freelance', color: 'var(--c-freelance)' },
  other_income: { label: 'Otros ingresos', color: 'var(--c-otros_ing)' },
  uncategorized: { label: 'Sin categoría', color: 'var(--c-sin)' },
}

/** Categorías permitidas por tipo, en el orden del contrato; "Sin categoría" va al final. */
export const CATEGORIES_BY_TYPE: Record<CategorizedType, readonly Category[]> = {
  expense: [
    'housing',
    'groceries',
    'transport',
    'restaurants',
    'utilities',
    'health',
    'entertainment',
    'subscriptions',
    'debts',
    'uncategorized',
  ],
  income: ['salary', 'freelance', 'other_income', 'uncategorized'],
}

/** Si una categoría es válida para el tipo (un gasto solo lleva categorías de gasto). */
export function isCategoryAllowed(type: TransactionType, category: Category): boolean {
  if (type !== 'expense' && type !== 'income') return false
  return CATEGORIES_BY_TYPE[type].includes(category)
}
