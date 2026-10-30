import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { json, mockApi, problem, renderApp } from '../../../test/app.tsx'
import { expectNoAxeViolations } from '../../../test/axe.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const INVALID = 'Este enlace ya no es válido. Solicita uno nuevo.'

describe('/verificar-correo (HU-03)', () => {
  it('confirma una sola vez, retira el token de la URL y lleva al inicio de sesión', async () => {
    let urlWhileVerifying = ''
    const { router, ...rest } = (() => {
      const api = mockApi({
        'POST /auth/verify-email': () => {
          urlWhileVerifying = `${view.router.state.location.pathname}${view.router.state.location.search}`
          return json(204, null)
        },
      })
      const view = renderApp('/verificar-correo?token=abc123')
      return { ...view, api }
    })()

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/iniciar-sesion')
    })
    expect(router.state.location.state).toEqual({ emailVerified: true })
    // StrictMode monta el efecto dos veces: el token (de un solo uso) se envía una vez.
    expect(rest.api.bodies('POST /auth/verify-email')).toEqual([{ token: 'abc123' }])
    expect(urlWhileVerifying).toBe('/verificar-correo')
  })

  it('no envía Referer', () => {
    mockApi({ 'POST /auth/verify-email': () => new Promise<Response>(() => undefined) })
    renderApp('/verificar-correo?token=abc123')
    expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute(
      'content',
      'no-referrer',
    )
  })

  it('mientras confirma lo anuncia', async () => {
    mockApi({ 'POST /auth/verify-email': () => new Promise<Response>(() => undefined) })
    const { container } = renderApp('/verificar-correo?token=abc123')
    expect(await screen.findByRole('status')).toHaveTextContent('Confirmando tu correo…')
    await expectNoAxeViolations(container)
  })

  it('enlace vencido o usado: lo dice y ofrece uno nuevo (VAL-AUTH-09)', async () => {
    const api = mockApi({
      'POST /auth/verify-email': () => problem(400, 'invalid_token', INVALID),
      'POST /auth/verify-email/resend': () =>
        json(202, {
          message: 'Si tu cuenta está pendiente de confirmar, te enviamos un nuevo enlace.',
        }),
    })
    const { container } = renderApp('/verificar-correo?token=usado')
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID)
    await expectNoAxeViolations(container)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar un nuevo enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent('te enviamos un nuevo enlace')
    expect(api.bodies('POST /auth/verify-email/resend')).toEqual([{ email: 'ana@correo.com' }])
  })

  it('sin token muestra que el enlace no es válido, sin llamar a la API', async () => {
    const api = mockApi({})
    renderApp('/verificar-correo')
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID)
    expect(api.bodies('POST /auth/verify-email')).toEqual([])
  })

  it('sin conexión permite intentar de nuevo con el mismo enlace', async () => {
    let calls = 0
    const { router } = (() => {
      mockApi({
        'POST /auth/verify-email': () => {
          calls += 1
          if (calls === 1) throw new TypeError('Failed to fetch')
          return json(204, null)
        },
      })
      return renderApp('/verificar-correo?token=abc123')
    })()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con FINORA.')
    await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/iniciar-sesion')
    })
  })
})
