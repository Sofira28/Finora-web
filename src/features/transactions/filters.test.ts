import { describe, expect, it } from 'vitest'

import {
  clearFilters,
  DEFAULT_FILTERS,
  isRestricted,
  parseFilters,
  toApiQuery,
  toSearchParams,
} from './filters.ts'

const NOW = new Date('2026-10-31T15:00:00Z')
const ACCOUNT = '0193f2a4-0000-7000-8000-000000000001'
const params = (search: string) => new URLSearchParams(search)

describe('filtros en la URL (RF-TRX-05)', () => {
  it('sin parámetros: este mes, por fecha descendente', () => {
    expect(parseFilters(params(''))).toEqual(DEFAULT_FILTERS)
    expect(toApiQuery(DEFAULT_FILTERS, NOW)).toEqual({
      sort: 'date_desc',
      from: '2026-10-01',
      to: '2026-10-31',
    })
  })

  it('lee todos los filtros con las claves del contrato', () => {
    const filters = parseFilters(
      params(
        `q=%20caf%C3%A9%20&periodo=last_month&tipo=expense&categoria=groceries&cuenta=${ACCOUNT}&orden=amount_asc`,
      ),
    )
    expect(filters).toEqual({
      q: 'café',
      period: 'last_month',
      type: 'expense',
      category: 'groceries',
      accountId: ACCOUNT,
      sort: 'amount_asc',
    })
    expect(toApiQuery(filters, NOW)).toEqual({
      q: 'café',
      from: '2026-09-01',
      to: '2026-09-30',
      type: 'expense',
      category: 'groceries',
      account_id: ACCOUNT,
      sort: 'amount_asc',
    })
  })

  it('ignora valores inválidos', () => {
    expect(
      parseFilters(
        params('periodo=siempre&tipo=pendiente&categoria=viajes&cuenta=nomina&orden=nombre'),
      ),
    ).toEqual(DEFAULT_FILTERS)
  })

  it('recorta la búsqueda a 100 caracteres', () => {
    expect(parseFilters(params(`q=${'a'.repeat(150)}`)).q).toHaveLength(100)
  })

  it('"Todo el historial" no envía fechas', () => {
    expect(toApiQuery({ ...DEFAULT_FILTERS, period: 'all' }, NOW)).toEqual({ sort: 'date_desc' })
  })

  it('no escribe los valores por defecto y conserva el resto (ida y vuelta)', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('')
    const filters = {
      ...DEFAULT_FILTERS,
      q: 'mercado',
      period: 'all' as const,
      type: 'income' as const,
    }
    const search = toSearchParams(filters)
    expect(search.toString()).toBe('q=mercado&periodo=all&tipo=income')
    expect(parseFilters(search)).toEqual(filters)
  })
})

describe('Limpiar filtros (SUP-TRX-08)', () => {
  it('quita todos los filtros, también el periodo, y conserva el orden', () => {
    const filters = {
      q: 'x',
      period: 'last_month' as const,
      type: 'expense' as const,
      category: 'health' as const,
      accountId: ACCOUNT,
      sort: 'amount_desc' as const,
    }
    expect(clearFilters(filters)).toEqual({
      ...DEFAULT_FILTERS,
      period: 'all',
      sort: 'amount_desc',
    })
  })

  it('este mes ya limita el resultado; todo el historial sin más filtros no', () => {
    expect(isRestricted(DEFAULT_FILTERS)).toBe(true)
    expect(isRestricted({ ...DEFAULT_FILTERS, period: 'all' })).toBe(false)
    expect(isRestricted({ ...DEFAULT_FILTERS, period: 'all', sort: 'amount_asc' })).toBe(false)
    expect(isRestricted({ ...DEFAULT_FILTERS, period: 'all', q: 'x' })).toBe(true)
  })
})
