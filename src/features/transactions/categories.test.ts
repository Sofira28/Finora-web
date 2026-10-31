import { describe, expect, it } from 'vitest'

import { CATEGORIES, CATEGORIES_BY_TYPE, isCategoryAllowed } from './categories.ts'

describe('catálogo de categorías (RN-TRX-07)', () => {
  it('cada clave tiene nombre es-CO y un token de color del diseño', () => {
    for (const info of Object.values(CATEGORIES)) {
      expect(info.label).not.toBe('')
      expect(info.color).toMatch(/^var\(--c-[a-z_]+\)$/)
    }
    expect(CATEGORIES.utilities.label).toBe('Servicios')
    expect(CATEGORIES.other_income.label).toBe('Otros ingresos')
    expect(CATEGORIES.uncategorized.label).toBe('Sin categoría')
  })

  it('gastos e ingresos cubren todo el catálogo y solo comparten "Sin categoría"', () => {
    const { expense, income } = CATEGORIES_BY_TYPE
    expect(new Set([...expense, ...income])).toEqual(new Set(Object.keys(CATEGORIES)))
    expect(expense.filter((category) => income.includes(category))).toEqual(['uncategorized'])
    expect(income).toEqual(['salary', 'freelance', 'other_income', 'uncategorized'])
  })

  it('un gasto solo lleva categorías de gasto y un ingreso solo de ingreso', () => {
    expect(isCategoryAllowed('expense', 'groceries')).toBe(true)
    expect(isCategoryAllowed('expense', 'salary')).toBe(false)
    expect(isCategoryAllowed('income', 'salary')).toBe(true)
    expect(isCategoryAllowed('income', 'housing')).toBe(false)
    expect(isCategoryAllowed('income', 'uncategorized')).toBe(true)
  })

  it('transferencias y ajustes no llevan categoría', () => {
    expect(isCategoryAllowed('transfer', 'uncategorized')).toBe(false)
    expect(isCategoryAllowed('adjustment', 'uncategorized')).toBe(false)
  })
})
