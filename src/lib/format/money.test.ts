import { describe, expect, it } from 'vitest'

import { formatMoney } from './money.ts'

// Intl separa el símbolo con un espacio sin ruptura (U+00A0).
const nbsp = ' '

describe('formatMoney (COP)', () => {
  it.each([
    ['1234567.5', `$${nbsp}1.234.568`], // CA-SETUP-04
    ['1234566.5', `$${nbsp}1.234.566`], // punto medio hacia el par
    ['2.5', `$${nbsp}2`],
    ['3.5', `$${nbsp}4`],
    ['125000.00', `$${nbsp}125.000`],
    ['0', `$${nbsp}0`],
  ])('formatea %s como %s', (amount, expected) => {
    expect(formatMoney(amount, 'COP')).toBe(expected)
  })

  it('usa el signo menos tipográfico en negativos', () => {
    expect(formatMoney('-30000', 'COP')).toBe(`−$${nbsp}30.000`)
  })

  it('no muestra signo cuando el negativo redondea a cero', () => {
    expect(formatMoney('-0.4', 'COP')).toBe(`$${nbsp}0`)
  })

  it('conserva la precisión en montos mayores que Number.MAX_SAFE_INTEGER', () => {
    expect(formatMoney('9007199254740993', 'COP')).toBe(`$${nbsp}9.007.199.254.740.993`)
  })

  it.each(['', 'abc', '1,5', '1e6', ' 10', '10.', '.5', 'NaN', '--1'])(
    'rechaza la cadena inválida %j',
    (amount) => {
      expect(() => formatMoney(amount, 'COP')).toThrow(RangeError)
    },
  )
})
