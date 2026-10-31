import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { EditIcon, TrashIcon } from '../icons/index.ts'
import { ActionsMenu } from './ActionsMenu.tsx'

function renderMenu() {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const view = render(
    <>
      <ActionsMenu
        label="Acciones de Nómina"
        items={[
          { label: 'Editar', icon: EditIcon, onSelect: onEdit },
          { label: 'Eliminar', icon: TrashIcon, onSelect: onDelete, danger: true },
        ]}
      />
      <button type="button">Fuera</button>
    </>,
  )
  return { onEdit, onDelete, ...view }
}

describe('ActionsMenu', () => {
  it('despliega las acciones y ejecuta la elegida', async () => {
    const { onDelete, container } = renderMenu()
    const button = screen.getByRole('button', { name: 'Acciones de Nómina' })
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
  })

  it('con teclado: Enter abre, Tab recorre y Esc cierra', async () => {
    const { onEdit } = renderMenu()
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Editar' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Acciones de Nómina' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('se cierra con clic fuera o al salir con Tab', async () => {
    renderMenu()
    const button = screen.getByRole('button', { name: 'Acciones de Nómina' })
    await userEvent.click(button)
    await userEvent.click(screen.getByRole('button', { name: 'Fuera' }))
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(button)
    await userEvent.tab() // Editar
    await userEvent.tab() // Eliminar
    await userEvent.tab() // Fuera
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})
