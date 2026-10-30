import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { GoogleButton } from './GoogleButton.tsx'

const HREF = '/api/v1/auth/google/start?privacy_policy_version=0'

describe('GoogleButton', () => {
  it('es un enlace de navegación al backend', () => {
    render(<GoogleButton href={HREF} />)
    expect(screen.getByRole('link', { name: 'Continuar con Google' })).toHaveAttribute('href', HREF)
  })

  it('admite otro texto', () => {
    render(<GoogleButton href={HREF}>Confirmar con Google</GoogleButton>)
    expect(screen.getByRole('link', { name: 'Confirmar con Google' })).toBeInTheDocument()
  })

  it('sin violaciones de accesibilidad', async () => {
    const { container } = render(<GoogleButton href={HREF} />)
    await expectNoAxeViolations(container)
  })
})
