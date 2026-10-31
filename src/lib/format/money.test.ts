import { describe, expect, it } from 'vitest'

import { formatMoney, parseMoneyInput, toMoneyInput } from './money.ts'

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

describe('parseMoneyInput', () => {
  it.each([
    ['1250000', '1250000'],
    ['1.250.000', '1250000'],
    ['1250000,5', '1250000.5'],
    ['1.250.000,50', '1250000.50'],
    [`$ 1.250.000`, '1250000'],
    [`$${nbsp}1.250.000`, '1250000'],
    ['$1.250.000', '1250000'],
    ['  2.800.000  ', '2800000'],
    ['0', '0'],
    ['0,10', '0.10'],
    ['-150.000', '-150000'],
    ['− 150.000', '-150000'],
    [`−$${nbsp}30.000`, '-30000'], // lo que muestra formatMoney
    ['-0', '0'],
    ['007', '7'],
    ['1.250', '1250'], // el punto es de miles
    ['999.999.999.999.999,99', '999999999999999.99'],
    ['123.456.789.012.345,67', '123456789012345.67'], // más que Number.MAX_SAFE_INTEGER, exacto
  ])('convierte %j en %j', (text, expected) => {
    expect(parseMoneyInput(text)).toBe(expected)
  })

  it.each([
    '',
    '   ',
    'abc',
    '1,250,000', // coma de miles (formato en inglés)
    '1250000.5', // punto decimal
    '1.25', // grupo de miles incompleto
    '12.5000',
    '1.250.000,123', // tres decimales
    '1,',
    ',5',
    '1e6',
    '--5',
    '+5',
    '$',
    '1 250 000',
    '1234567890123456', // 16 dígitos enteros
  ])('rechaza %j', (text) => {
    expect(parseMoneyInput(text)).toBeNull()
  })
})

describe('toMoneyInput', () => {
  it.each([
    ['2800000.00', '2.800.000'],
    ['2800000.50', '2.800.000,5'],
    ['0.10', '0,1'],
    ['1250.25', '1.250,25'],
    ['999', '999'],
    ['-150000.00', '-150.000'],
    ['0.0000', '0'],
  ])('muestra %j como %j', (amount, expected) => {
    expect(toMoneyInput(amount)).toBe(expected)
  })

  it.each([
    ['2800000.00', '2800000'],
    ['2800000.50', '2800000.5'],
    ['-150000.00', '-150000'],
    ['0.10', '0.1'],
    ['1250.25', '1250.25'],
  ])('vuelve a leerse como el mismo monto: %s', (amount, parsed) => {
    expect(parseMoneyInput(toMoneyInput(amount))).toBe(parsed)
  })

  it('rechaza lo que no es una cadena decimal', () => {
    expect(() => toMoneyInput('1.250.000')).toThrow(RangeError)
  })
})
