import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { ConfirmDialog } from './ConfirmDialog.tsx'

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <ConfirmDialog
      open
      title="¿Eliminar la cuenta Nómina?"
      description="Esta acción no se puede deshacer."
      confirmLabel="Eliminar cuenta"
      variant="danger"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  )
  return { onConfirm, onClose, ...view }
}

describe('ConfirmDialog', () => {
  it('es un diálogo con título, descripción y las dos acciones', async () => {
    const { container } = renderDialog()
    const dialog = screen.getByRole('dialog', { name: '¿Eliminar la cuenta Nómina?' })
    expect(dialog).toHaveAccessibleDescription('Esta acción no se puede deshacer.')
    const botones = screen.getAllByRole('button').map((b) => b.textContent)
    expect(botones).toEqual(['Cancelar', 'Eliminar cuenta']) // Cancelar primero
    await expectNoAxeViolations(container)
  })

  it('confirma o cancela', async () => {
    const { onConfirm, onClose } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar cuenta' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Esc cancela', async () => {
    const { onClose, onConfirm } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    onClose.mockClear()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('mientras se ejecuta no confirma dos veces', async () => {
    const { onConfirm } = renderDialog({ loading: true })
    const confirmar = screen.getByRole('button', { name: 'Eliminar cuenta' })
    expect(confirmar).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(confirmar)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('muestra el error y los detalles dentro del diálogo', () => {
    renderDialog({
      error: 'No pudimos conectar con FINORA.',
      children: <p>Esta cuenta tiene saldo.</p>,
    })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Esta cuenta tiene saldo.')
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectar con FINORA.')
  })
})
