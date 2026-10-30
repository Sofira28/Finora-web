/**
 * Formato de montos para mostrar (FEAT-SETUP, RF-SETUP-08).
 * El monto llega de la API como cadena decimal y nunca se convierte a `number`:
 * Intl.NumberFormat formatea la cadena de forma exacta.
 */

export type Currency = 'COP'

// Cadena decimal tal como la envía la API (DP-API-03).
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

// COP se muestra sin decimales (PA-SETUP-02), con redondeo bancario solo para mostrar.
const formatters: Record<Currency, Intl.NumberFormat> = {
  COP: new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    roundingMode: 'halfEven',
    signDisplay: 'negative',
  }),
}

export function formatMoney(amount: string, currency: Currency): string {
  if (!DECIMAL_PATTERN.test(amount)) {
    throw new RangeError(`Monto inválido: ${JSON.stringify(amount)}`)
  }
  // Intl acepta cadenas decimales exactas; el tipo de TS solo declara number | bigint.
  const text = formatters[currency].format(amount as `${number}`)
  // El diseño usa el signo menos tipográfico (U+2212).
  return text.replace('-', '−')
}
