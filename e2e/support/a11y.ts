import { createRequire } from 'node:module'

import { expect, type Locator, type Page } from '@playwright/test'
import type { AxeResults } from 'axe-core'

// axe-core ya es dependencia de las pruebas de Vitest: se inyecta en la página tal cual.
const AXE_SCRIPT = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

/** Reglas de WCAG 2.0, 2.1 y 2.2 en niveles A y AA (RNF-AUTH-07), incluido el contraste. */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

export async function expectNoAxeViolations(page: Page, where: string) {
  const loaded = await page.evaluate(() => 'axe' in window)
  if (!loaded) await page.addScriptTag({ path: AXE_SCRIPT })
  const violations = await page.evaluate(async (tags) => {
    const { axe } = window as unknown as {
      axe: { run: (...args: unknown[]) => Promise<AxeResults> }
    }
    const results = await axe.run(document, { runOnly: { type: 'tag', values: tags } })
    return results.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    }))
  }, WCAG_AA)
  expect(violations, `violaciones de axe en ${where}`).toEqual([])
}

/** WCAG 1.4.10 (reflow): a 320 px de ancho no hay desplazamiento horizontal. */
export async function expectReflow(page: Page, where: string) {
  const viewport = page.viewportSize()
  await page.setViewportSize({ width: 320, height: 640 })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `desplazamiento horizontal a 320 px en ${where}`).toBeLessThanOrEqual(0)
  if (viewport) await page.setViewportSize(viewport)
}

/** Nombre del elemento con el foco y si su indicador de foco es visible (WCAG 2.4.7). */
async function focusedElement(page: Page): Promise<{ name: string; visible: boolean }> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (!(element instanceof HTMLElement) || element === document.body)
      return { name: '', visible: false }
    const label =
      element.getAttribute('aria-label') ??
      (element instanceof HTMLInputElement ? element.labels?.[0]?.textContent : null) ??
      element.textContent
    // El contorno puede estar en el propio control o en su contenedor (`:focus-within`).
    let visible = false
    for (
      let node: HTMLElement | null = element, i = 0;
      node && i < 3;
      node = node.parentElement, i++
    ) {
      const style = getComputedStyle(node)
      if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) visible = true
    }
    return { name: label.replace(/\s+/g, ' ').trim(), visible }
  })
}

/**
 * Pulsa Tab hasta llegar al elemento cuyo nombre empieza por `name`, comprobando que cada
 * parada muestra el foco. Devuelve los nombres recorridos.
 */
export async function tabTo(page: Page, name: string, maxStops = 25): Promise<string[]> {
  const visited: string[] = []
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab')
    const focused = await focusedElement(page)
    visited.push(focused.name)
    expect(focused.visible, `foco visible en "${focused.name}"`).toBe(true)
    if (focused.name.startsWith(name)) return visited
  }
  throw new Error(`No se llegó a "${name}" con Tab. Recorrido: ${visited.join(' → ')}`)
}

/** Pega `text` en `field` como lo haría un gestor de contraseñas (WCAG 3.3.8). */
export async function pasteInto(page: Page, field: Locator, text: string) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text)
  await field.focus()
  await page.keyboard.press('ControlOrMeta+V')
  await expect(field).toHaveValue(text)
}
