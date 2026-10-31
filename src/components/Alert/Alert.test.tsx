import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { Alert } from './Alert.tsx'

describe('Alert', () => {
  it('los errores se anuncian de inmediato', () => {
    render(
      <Alert variant="error" title="No pudimos iniciar sesión">
        El correo o la contraseña no son correctos.
      </Alert>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos iniciar sesiónEl correo o la contraseña no son correctos.',
    )
  })

  it.each(['success', 'info', 'warning'] as const)('%s se anuncia sin interrumpir', (variant) => {
    render(<Alert variant={variant}>Mensaje</Alert>)
    expect(screen.getByRole('status')).toHaveTextContent('Mensaje')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sin violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <Alert variant="error" title="Error" />
        <Alert variant="success">Listo.</Alert>
        <Alert variant="info">Información.</Alert>
        <Alert variant="warning">Cuidado.</Alert>
      </>,
    )
    await expectNoAxeViolations(container)
  })
})
