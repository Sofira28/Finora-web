import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { TextField } from './TextField.tsx'

describe('TextField', () => {
  it('asocia etiqueta, ayuda y error al campo', () => {
    render(
      <TextField
        label="Correo"
        type="email"
        autoComplete="email"
        hint="Te enviaremos un enlace."
        error="Ingresa un correo válido."
      />,
    )
    const input = screen.getByLabelText('Correo')
    expect(input).toHaveAttribute('autocomplete', 'email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Te enviaremos un enlace. Ingresa un correo válido.')
  })

  it('sin error no se marca como inválido', () => {
    render(<TextField label="Nombre" />)
    const input = screen.getByLabelText('Nombre')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('se puede escribir y pegar', async () => {
    render(<TextField label="Nombre" />)
    const input = screen.getByLabelText('Nombre')
    await userEvent.type(input, 'Ana')
    await userEvent.paste(' María')
    expect(input).toHaveValue('Ana María')
  })

  it('reenvía la referencia al input (React Hook Form)', () => {
    let element: HTMLInputElement | null = null
    render(
      <TextField
        label="Nombre"
        name="name"
        ref={(node) => {
          element = node
        }}
      />,
    )
    expect(element).toBe(screen.getByLabelText('Nombre'))
  })

  it('sin violaciones de accesibilidad', async () => {
    const { container } = render(
      <form>
        <TextField label="Correo" hint="Ayuda" error="Error" required />
        <TextField label="Nombre" />
      </form>,
    )
    await expectNoAxeViolations(container)
  })
})
