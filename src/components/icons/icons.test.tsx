import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import * as icons from './index.ts'

describe('íconos', () => {
  it.each(Object.entries(icons))('%s es decorativo y no recibe el foco', (_name, IconComponent) => {
    const { container } = render(<IconComponent />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
  })
})
