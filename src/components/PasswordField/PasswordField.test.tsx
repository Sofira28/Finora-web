import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { PasswordField } from './PasswordField.tsx'

describe('PasswordField', () => {
  it('oculta la contraseña y declara el autocompletado para gestores de claves', () => {
    render(<PasswordField label="Contraseña" autoComplete="new-password" />)
    const input = screen.getByLabelText('Contraseña')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toHaveAttribute('spellcheck', 'false')
  })

  it('permite pegar la contraseña (WCAG 3.3.8)', async () => {
    render(<PasswordField label="Contraseña" autoComplete="current-password" />)
    const input = screen.getByLabelText('Contraseña')
    await userEvent.click(input)
    await userEvent.paste('caballo correcto batería grapa')
    expect(input).toHaveValue('caballo correcto batería grapa')
  })

  it('muestra y oculta la contraseña', async () => {
    render(<PasswordField label="Contraseña" autoComplete="current-password" />)
    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(toggle)
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('el botón no envía el formulario', async () => {
    let submitted = false
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitted = true
        }}
      >
        <PasswordField label="Contraseña" autoComplete="current-password" />
      </form>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(submitted).toBe(false)
  })

  it('sin violaciones de accesibilidad', async () => {
    const { container } = render(
      <PasswordField
        label="Contraseña"
        autoComplete="new-password"
        hint="Mínimo 12 caracteres."
        error="La contraseña debe tener al menos 12 caracteres."
      />,
    )
    await expectNoAxeViolations(container)
  })
})
