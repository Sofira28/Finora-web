import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Sin violaciones de axe. jsdom no renderiza, así que el contraste de color se verifica en
 * un navegador real (Playwright, T-AUTH-QA-02).
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
  expect(results.violations).toEqual([])
}
