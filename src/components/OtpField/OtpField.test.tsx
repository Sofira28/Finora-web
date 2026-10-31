import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { OtpField } from './OtpField.tsx'

describe('OtpField', () => {
  it('es un solo campo numérico que el sistema puede autocompletar', () => {
    render(<OtpField />)
    const input = screen.getByLabelText('Código de verificación')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('autocomplete', 'one-time-code')
    expect(input).toHaveAttribute('type', 'text')
  })

  it('permite pegar el código completo', async () => {
    render(<OtpField />)
    await userEvent.click(screen.getByLabelText('Código de verificación'))
    await userEvent.paste('123 456')
    expect(screen.getByLabelText('Código de verificación')).toHaveValue('123 456')
  })

  it('con códigos de recuperación admite letras', async () => {
    render(<OtpField label="Código o código de recuperación" allowRecoveryCode />)
    const input = screen.getByLabelText('Código o código de recuperación')
    expect(input).toHaveAttribute('inputmode', 'text')
    await userEvent.click(input)
    await userEvent.paste('ABCDE-FGHIJ')
    expect(input).toHaveValue('ABCDE-FGHIJ')
  })

  it('sin violaciones de accesibilidad', async () => {
    const { container } = render(<OtpField error="El código no es correcto." />)
    await expectNoAxeViolations(container)
  })
})
