import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { Dialog } from './Dialog.tsx'

describe('Dialog', () => {
  it('abierto es un diálogo modal con nombre y descripción', async () => {
    const { container } = render(
      <Dialog open title="Confirma tu identidad" description="Por seguridad." onClose={vi.fn()}>
        <button type="button">Confirmar</button>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Confirma tu identidad' })
    expect(dialog).toHaveAccessibleDescription('Por seguridad.')
    expect(dialog).toHaveAttribute('open')
    await expectNoAxeViolations(container)
  })

  it('cerrado no muestra el contenido', () => {
    render(
      <Dialog open={false} title="Confirma tu identidad" onClose={vi.fn()}>
        <button type="button">Confirmar</button>
      </Dialog>,
    )
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  it('Esc avisa para cerrar', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open title="Confirma tu identidad" onClose={onClose}>
        <input aria-label="Contraseña" />
      </Dialog>,
    )
    await userEvent.click(screen.getByLabelText('Contraseña'))
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
