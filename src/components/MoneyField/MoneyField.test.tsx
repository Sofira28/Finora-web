import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { MoneyField } from './MoneyField.tsx'

describe('MoneyField', () => {
  it('es un campo de texto con teclado decimal y la moneda visible', async () => {
    const { container } = render(<MoneyField label="Saldo inicial" hint="Ej.: 1.250.000" />)
    const input = screen.getByRole('textbox', { name: 'Saldo inicial' })
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAccessibleDescription('Ej.: 1.250.000')
    expect(container).toHaveTextContent('COP')
    await expectNoAxeViolations(container)
  })

  it('conserva lo escrito tal cual, con puntos y coma', async () => {
    render(<MoneyField label="Saldo inicial" />)
    const input = screen.getByRole('textbox', { name: 'Saldo inicial' })
    await userEvent.type(input, '1.250.000,50')
    expect(input).toHaveValue('1.250.000,50')
  })

  it('muestra el error asociado al campo', async () => {
    const { container } = render(
      <MoneyField label="Cupo" error="Escribe un monto válido, p. ej. 1.250.000." />,
    )
    const input = screen.getByRole('textbox', { name: 'Cupo' })
    expect(input).toBeInvalid()
    expect(input).toHaveAccessibleDescription('Escribe un monto válido, p. ej. 1.250.000.')
    await expectNoAxeViolations(container)
  })
})
