import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ANONYMOUS, json, mockApi, problem, renderApp } from '../../../test/app.tsx'
import { expectNoAxeViolations } from '../../../test/axe.ts'
import type { SessionInfo } from '../session/index.ts'

const FORGOT =
  'Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.'
const INVALID = 'Este enlace ya no es válido. Solicita uno nuevo.'
const CLAVE = 'caballo correcto batería grapa'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function typePassword(value: string) {
  await userEvent.click(await screen.findByLabelText('Contraseña nueva'))
  await userEvent.paste(value)
  await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
}

describe('/recuperar-contrasena (HU-05)', () => {
  it('pide el enlace y muestra la respuesta genérica', async () => {
    const api = mockApi({ 'POST /auth/password/forgot': () => json(202, { message: FORGOT }) })
    const { container } = renderApp('/recuperar-contrasena')
    await expectNoAxeViolations(container)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), ' ana@correo.com ')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent(FORGOT)
    expect(api.bodies('POST /auth/password/forgot')).toEqual([{ email: 'ana@correo.com' }])
    await expectNoAxeViolations(container)
  })

  it('valida el correo antes de enviar', async () => {
    const api = mockApi({})
    renderApp('/recuperar-contrasena')
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeInTheDocument()
    expect(api.bodies('POST /auth/password/forgot')).toEqual([])
  })

  it('demasiadas solicitudes (429)', async () => {
    mockApi({
      'POST /auth/password/forgot': () =>
        problem(429, 'too_many_attempts', 'Demasiados intentos. Intenta de nuevo en unos minutos.'),
    })
    renderApp('/recuperar-contrasena')
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos.')
  })
})

describe('/restablecer-contrasena (HU-05, RF-AUTH-18)', () => {
  it('retira el token, guarda la contraseña y lleva al inicio de sesión', async () => {
    const api = mockApi({ 'POST /auth/password/reset': () => json(204, null) })
    const { router, container } = renderApp('/restablecer-contrasena?token=abc123')
    await waitFor(() => {
      expect(router.state.location.search).toBe('')
    })
    expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute(
      'content',
      'no-referrer',
    )
    await expectNoAxeViolations(container)
    await typePassword(CLAVE)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Tu contraseña quedó guardada. Inicia sesión con ella.',
    )
    expect(router.state.location.pathname).toBe('/iniciar-sesion')
    expect(api.bodies('POST /auth/password/reset')).toEqual([
      { token: 'abc123', new_password: CLAVE },
    ])
  })

  it('cierra también la sesión de este navegador (RF-AUTH-09)', async () => {
    const active: SessionInfo = {
      stage: 'active',
      csrf_token: 't',
      google_enabled: false,
      user: { name: 'Ana', email: 'ana@correo.com' },
    }
    let session = active
    mockApi({
      'GET /auth/session': () => json(200, session),
      'POST /auth/password/reset': () => {
        session = ANONYMOUS
        return json(204, null)
      },
    })
    const { router, client } = renderApp('/restablecer-contrasena?token=abc123')
    await typePassword(CLAVE)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/iniciar-sesion')
    })
    // Sin sesión, la página de inicio de sesión no redirige al inicio.
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(client.getQueryData<SessionInfo>(['auth', 'session'])?.stage).toBeNull()
  })

  it('valida la longitud antes de enviar', async () => {
    const api = mockApi({})
    renderApp('/restablecer-contrasena?token=abc123')
    await typePassword('corta')
    expect(
      await screen.findByText('La contraseña debe tener al menos 12 caracteres.'),
    ).toBeInTheDocument()
    expect(api.bodies('POST /auth/password/reset')).toEqual([])
  })

  it('una contraseña rechazada se corrige con el mismo enlace (RN-AUTH-02)', async () => {
    let calls = 0
    const api = mockApi({
      'POST /auth/password/reset': () => {
        calls += 1
        if (calls === 1)
          return problem(422, 'validation_failed', 'Los datos no son válidos.', {
            errors: [
              {
                loc: ['body', 'new_password'],
                type: 'too_common',
                message: 'Esta contraseña es muy común. Elige otra.',
              },
            ],
          })
        return json(204, null)
      },
    })
    const { router } = renderApp('/restablecer-contrasena?token=abc123')
    await typePassword('contraseña123')
    expect(await screen.findByText('Esta contraseña es muy común. Elige otra.')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña nueva')).toHaveFocus()

    await userEvent.clear(screen.getByLabelText('Contraseña nueva'))
    await typePassword(CLAVE)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/iniciar-sesion')
    })
    expect(api.bodies('POST /auth/password/reset').at(-1)).toEqual({
      token: 'abc123',
      new_password: CLAVE,
    })
  })

  it('enlace vencido o usado: lo dice y ofrece pedir otro (VAL-AUTH-09)', async () => {
    mockApi({ 'POST /auth/password/reset': () => problem(400, 'invalid_token', INVALID) })
    const { router, container } = renderApp('/restablecer-contrasena?token=usado')
    await typePassword(CLAVE)
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID)
    await expectNoAxeViolations(container)
    await userEvent.click(screen.getByRole('link', { name: 'Solicitar un enlace nuevo' }))
    expect(router.state.location.pathname).toBe('/recuperar-contrasena')
  })

  it('sin token muestra que el enlace no es válido', async () => {
    mockApi({})
    renderApp('/restablecer-contrasena')
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID)
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument()
  })
})
