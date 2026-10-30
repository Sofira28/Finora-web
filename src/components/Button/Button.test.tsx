import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { expectNoAxeViolations } from '../../test/axe.ts'
import { Button } from './Button.tsx'

describe('Button', () => {
  it('por defecto no envía formularios', () => {
    render(<Button>Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button')
  })

  it('responde al clic', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Guardar</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('mientras carga no responde, lo anuncia y no envía el formulario', async () => {
    const onClick = vi.fn()
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Correo" />
        <Button type="submit" loading onClick={onClick}>
          Entrando…
        </Button>
      </form>,
    )
    const button = screen.getByRole('button', { name: 'Entrando…' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    await userEvent.type(screen.getByLabelText('Correo'), 'a{Enter}')
    expect(onClick).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('al empezar a cargar conserva el foco (WCAG 2.4.3)', async () => {
    const { rerender } = render(<Button>Guardar</Button>)
    const button = screen.getByRole('button', { name: 'Guardar' })
    await userEvent.tab()
    expect(button).toHaveFocus()
    rerender(<Button loading>Guardar</Button>)
    expect(button).toHaveFocus()
  })

  it('sin violaciones de accesibilidad en todas sus variantes', async () => {
    const { container } = render(
      <>
        <Button>Primario</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="ghost">Sutil</Button>
        <Button variant="danger">Eliminar</Button>
        <Button loading>Cargando</Button>
      </>,
    )
    await expectNoAxeViolations(container)
  })
})
