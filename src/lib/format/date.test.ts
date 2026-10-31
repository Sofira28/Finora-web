import { describe, expect, it } from 'vitest'

import { formatDate, formatInstantDate } from './date.ts'

describe('formatDate', () => {
  it('formatea una fecha contable como DD/MM/AAAA', () => {
    expect(formatDate('2026-10-29')).toBe('29/10/2026') // CA-SETUP-04
  })

  it('acepta el 29 de febrero en año bisiesto', () => {
    expect(formatDate('2028-02-29')).toBe('29/02/2028')
  })

  it.each(['2026-02-30', '2026-13-01', '2027-02-29', '29/10/2026', '2026-10-29T00:00:00Z', ''])(
    'rechaza %j',
    (value) => {
      expect(() => formatDate(value)).toThrow(RangeError)
    },
  )
})

describe('formatInstantDate', () => {
  it('muestra el día en America/Bogota, no en UTC', () => {
    // 03:00 UTC del 29 = 22:00 del 28 en Bogotá (UTC−5).
    expect(formatInstantDate('2026-10-29T03:00:00Z')).toBe('28/10/2026')
    expect(formatInstantDate('2026-10-29T05:00:00Z')).toBe('29/10/2026')
  })

  it('rechaza un instante inválido', () => {
    expect(() => formatInstantDate('no-es-fecha')).toThrow(RangeError)
  })
})
