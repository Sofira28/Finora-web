import type { Category, Sort, TransactionQuery, TransactionType } from './api.ts'
import { CATEGORIES } from './categories.ts'
import { type PeriodKey, PERIODS, periodRange } from './periods.ts'

/**
 * Filtros de Movimientos (RF-TRX-05). Viven en la URL (plan §3.1) para que Atrás y los enlaces
 * conserven la búsqueda: `?q=&periodo=&tipo=&categoria=&cuenta=&orden=`, con las claves del
 * contrato como valores. Un valor inválido se ignora; los valores por defecto no se escriben.
 */
export interface TransactionFilters {
  q: string
  period: PeriodKey
  type: TransactionType | null
  category: Category | null
  accountId: string | null
  sort: Sort
}

export const SEARCH_MAX = 100

/** Al entrar sin filtros: este mes, de la más reciente a la más antigua (RF-TRX-05). */
export const DEFAULT_FILTERS: TransactionFilters = {
  q: '',
  period: 'this_month',
  type: null,
  category: null,
  accountId: null,
  sort: 'date_desc',
}

export const SORTS: readonly { key: Sort; label: string }[] = [
  { key: 'date_desc', label: 'Fecha: más reciente' },
  { key: 'date_asc', label: 'Fecha: más antigua' },
  { key: 'amount_desc', label: 'Monto: mayor a menor' },
  { key: 'amount_asc', label: 'Monto: menor a mayor' },
]

const TYPES: readonly TransactionType[] = ['expense', 'income', 'transfer', 'adjustment']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

export function parseFilters(params: URLSearchParams): TransactionFilters {
  const account = params.get('cuenta')
  return {
    q: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX),
    period:
      oneOf(
        params.get('periodo'),
        PERIODS.map((period) => period.key),
      ) ?? DEFAULT_FILTERS.period,
    type: oneOf(params.get('tipo'), TYPES),
    category: oneOf(params.get('categoria'), Object.keys(CATEGORIES) as Category[]),
    accountId: account && UUID.test(account) ? account.toLowerCase() : null,
    sort:
      oneOf(
        params.get('orden'),
        SORTS.map((sort) => sort.key),
      ) ?? DEFAULT_FILTERS.sort,
  }
}

export function toSearchParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.period !== DEFAULT_FILTERS.period) params.set('periodo', filters.period)
  if (filters.type) params.set('tipo', filters.type)
  if (filters.category) params.set('categoria', filters.category)
  if (filters.accountId) params.set('cuenta', filters.accountId)
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('orden', filters.sort)
  return params
}

/** Parámetros de la API; el periodo se convierte a `from`/`to` en hora de Colombia. */
export function toApiQuery(filters: TransactionFilters, now: Date = new Date()): TransactionQuery {
  const query: TransactionQuery = { sort: filters.sort, ...periodRange(filters.period, now) }
  if (filters.q) query.q = filters.q
  if (filters.type) query.type = filters.type
  if (filters.category) query.category = filters.category
  if (filters.accountId) query.account_id = filters.accountId
  return query
}

/** Si algo limita el resultado; "Todo el historial" sin más filtros no limita nada. */
export function isRestricted(filters: TransactionFilters): boolean {
  return Boolean(
    filters.q || filters.type || filters.category || filters.accountId || filters.period !== 'all',
  )
}

/** "Limpiar filtros" quita todos, también el periodo, y conserva el orden (SUP-TRX-08). */
export function clearFilters(filters: TransactionFilters): TransactionFilters {
  return { ...DEFAULT_FILTERS, period: 'all', sort: filters.sort }
}
