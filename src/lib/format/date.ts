/**
 * Formato de fechas para mostrar (FEAT-SETUP, RF-SETUP-08): DD/MM/AAAA.
 * La API usa ISO 8601 (DP-API-04).
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

// Zona en la que se interpreta el día contable (DP-DB-07).
export const ACCOUNTING_TIME_ZONE = 'America/Bogota'

const instantFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: ACCOUNTING_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Fecha contable (`DATE`, p. ej. `2026-10-29`): no depende de la zona del navegador. */
export function formatDate(isoDate: string): string {
  const match = DATE_PATTERN.exec(isoDate)
  if (!match) throw new RangeError(`Fecha inválida: ${JSON.stringify(isoDate)}`)
  const [, year, month, day] = match as unknown as [string, string, string, string]
  // Valida que el día exista (p. ej. rechaza 2026-02-30).
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (check.getUTCMonth() !== Number(month) - 1 || check.getUTCDate() !== Number(day)) {
    throw new RangeError(`Fecha inválida: ${JSON.stringify(isoDate)}`)
  }
  return `${day}/${month}/${year}`
}

/** Instante (`timestamptz` en ISO 8601): se muestra el día en America/Bogota. */
export function formatInstantDate(isoInstant: string): string {
  const date = new Date(isoInstant)
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Instante inválido: ${JSON.stringify(isoInstant)}`)
  }
  return instantFormatter.format(date)
}
