import { ACCOUNTING_TIME_ZONE } from '../../lib/format/index.ts'

/**
 * Periodos del filtro de Movimientos (RF-TRX-05). Son meses calendario en hora de Colombia:
 * "Últimos 3 meses" es el mes actual y los dos anteriores. La API recibe `from`/`to`
 * inclusivos (plan §14); "Todo el historial" no envía ninguno.
 */
export type PeriodKey = 'this_month' | 'last_month' | 'last_3_months' | 'all'

export const PERIODS: readonly { key: PeriodKey; label: string }[] = [
  { key: 'this_month', label: 'Este mes' },
  { key: 'last_month', label: 'Mes anterior' },
  { key: 'last_3_months', label: 'Últimos 3 meses' },
  { key: 'all', label: 'Todo el historial' },
]

export interface DateRange {
  from?: string
  to?: string
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ACCOUNTING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Fecha de hoy en hora de Colombia (`AAAA-MM-DD`), sin depender de la zona del navegador. */
export function todayInColombia(now: Date = new Date()): string {
  const parts = dayFormatter.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** `AAAA-MM-DD` de un día en UTC (solo se usa como calendario, sin hora). */
function isoDay(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10)
}

/** Rango de un periodo: del primer día del mes inicial al último del mes actual o anterior. */
export function periodRange(period: PeriodKey, now: Date = new Date()): DateRange {
  if (period === 'all') return {}
  const [year, month] = todayInColombia(now).split('-').map(Number) as [number, number]
  const monthIndex = month - 1
  // `Date.UTC` normaliza meses negativos (p. ej. enero − 1 = diciembre del año anterior) y el
  // día 0 es el último día del mes anterior.
  switch (period) {
    case 'this_month':
      return { from: isoDay(year, monthIndex, 1), to: isoDay(year, monthIndex + 1, 0) }
    case 'last_month':
      return { from: isoDay(year, monthIndex - 1, 1), to: isoDay(year, monthIndex, 0) }
    case 'last_3_months':
      return { from: isoDay(year, monthIndex - 2, 1), to: isoDay(year, monthIndex + 1, 0) }
  }
}
