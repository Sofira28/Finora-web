import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { AuthLayout } from './AuthLayout.tsx'

function renderLayout() {
  return render(
    <MemoryRouter>
      <AuthLayout
        title="Inicia sesión"
        description="Tu dinero, más claro."
        footer={<a href="/registro">Crear una cuenta</a>}
      >
        <p>Formulario</p>
      </AuthLayout>
    </MemoryRouter>,
  )
}

describe('AuthLayout', () => {
  it('tiene un único h1, la marca y el contenido dentro de main', () => {
    renderLayout()
    expect(screen.getByRole('main')).toHaveTextContent('Formulario')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Inicia sesión')
    expect(screen.getByRole('link', { name: 'FINORA, ir al inicio' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Crear una cuenta' })).toBeInTheDocument()
  })

  it('sin violaciones de accesibilidad', async () => {
    const { container } = renderLayout()
    await expectNoAxeViolations(container)
  })
})
