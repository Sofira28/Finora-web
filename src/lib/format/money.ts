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

/**
 * Monto escrito por el usuario (es-CO) → cadena decimal para la API (FEAT-ACC, FE-01).
 *
 * Acepta `1250000`, `1.250.000`, `1250000,5`, `1.250.000,50`, `$ 1.250.000` y negativos con
 * `-` o `−`. El punto solo separa miles (grupos de 3) y la coma solo decimales (hasta 2).
 * Devuelve `null` si el texto no es un monto válido. Nunca pasa por `number`.
 */
export function parseMoneyInput(text: string): string | null {
  const match = MONEY_INPUT_PATTERN.exec(text.trim())
  if (!match) return null
  const [, sign, integer = '', decimals] = match
  const digits = integer.replaceAll('.', '').replace(/^0+(?=\d)/, '')
  if (digits.length > MAX_INTEGER_DIGITS) return null
  const isZero = /^0*$/.test(digits + (decimals ?? ''))
  const negative = sign !== undefined && !isZero
  return `${negative ? '-' : ''}${digits}${decimals ? `.${decimals}` : ''}`
}

/**
 * Cadena decimal de la API → texto es-CO para editar (`"2800000.50"` → `"2.800.000,5"`),
 * sin símbolo y sin decimales en cero, de modo que `parseMoneyInput` lo lea igual.
 */
export function toMoneyInput(amount: string): string {
  const match = DECIMAL_PARTS_PATTERN.exec(amount)
  if (!match) throw new RangeError(`Monto inválido: ${JSON.stringify(amount)}`)
  const [, sign = '', integer = '', decimals = ''] = match
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fraction = decimals.replace(/0+$/, '')
  return `${sign}${grouped}${fraction ? `,${fraction}` : ''}`
}

// Igual que el backend: 15 dígitos enteros caben en NUMERIC(19,4).
const MAX_INTEGER_DIGITS = 15

// signo · símbolo opcional · entero (con o sin puntos de miles) · coma y 1–2 decimales.
const MONEY_INPUT_PATTERN = /^([-−])?\s*(?:\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/

const DECIMAL_PARTS_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/
