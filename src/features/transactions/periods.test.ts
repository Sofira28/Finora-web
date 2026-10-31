import { describe, expect, it } from 'vitest'

import { PERIODS, periodRange, todayInColombia } from './periods.ts'

// Colombia está en UTC−5 todo el año (sin horario de verano).
const at = (iso: string) => new Date(iso)

describe('todayInColombia', () => {
  it('usa el día de Colombia, no el de UTC', () => {
    // 01/11/2026 03:00 UTC = 31/10/2026 22:00 en Bogotá.
    expect(todayInColombia(at('2026-11-01T03:00:00Z'))).toBe('2026-10-31')
  })

  it('cambia de día a la medianoche de Colombia', () => {
    expect(todayInColombia(at('2026-11-01T04:59:59Z'))).toBe('2026-10-31')
    expect(todayInColombia(at('2026-11-01T05:00:00Z'))).toBe('2026-11-01')
  })
})

describe('periodRange (RF-TRX-05)', () => {
  const now = at('2026-10-31T15:00:00Z')

  it('ofrece los cuatro periodos en orden', () => {
    expect(PERIODS.map((period) => period.label)).toEqual([
      'Este mes',
      'Mes anterior',
      'Últimos 3 meses',
      'Todo el historial',
    ])
  })

  it('este mes: del primer al último día del mes', () => {
    expect(periodRange('this_month', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('mes anterior: el mes calendario completo', () => {
    expect(periodRange('last_month', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('últimos 3 meses: el mes actual y los dos anteriores', () => {
    expect(periodRange('last_3_months', now)).toEqual({ from: '2026-08-01', to: '2026-10-31' })
  })

  it('todo el historial no limita fechas', () => {
    expect(periodRange('all', now)).toEqual({})
  })

  it('cruza el cambio de año', () => {
    const january = at('2027-01-15T12:00:00Z')
    expect(periodRange('this_month', january)).toEqual({ from: '2027-01-01', to: '2027-01-31' })
    expect(periodRange('last_month', january)).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(periodRange('last_3_months', january)).toEqual({
      from: '2026-11-01',
      to: '2027-01-31',
    })
    const february = at('2027-02-10T12:00:00Z')
    expect(periodRange('last_3_months', february)).toEqual({
      from: '2026-12-01',
      to: '2027-02-28',
    })
  })

  it('respeta febrero en años bisiestos', () => {
    const march = at('2028-03-05T12:00:00Z')
    expect(periodRange('last_month', march)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('a medianoche de Colombia el mes es el de Bogotá, no el de UTC', () => {
    // 01/11/2026 04:30 UTC: en UTC ya es noviembre, en Bogotá sigue siendo octubre.
    const lateOctober = at('2026-11-01T04:30:00Z')
    expect(periodRange('this_month', lateOctober)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
    // 05:00 UTC: medianoche en Bogotá, empieza noviembre.
    const novemberStart = at('2026-11-01T05:00:00Z')
    expect(periodRange('this_month', novemberStart)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    })
    expect(periodRange('last_month', novemberStart)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
  })

  it('el 31 de diciembre a las 23:59 de Colombia sigue en diciembre', () => {
    const newYearsEve = at('2027-01-01T04:59:00Z')
    expect(periodRange('this_month', newYearsEve)).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
  })
})
