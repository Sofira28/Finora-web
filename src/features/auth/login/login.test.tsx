import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../../lib/api/index.ts'
import { ANONYMOUS, json, mockApi, problem, renderApp } from '../../../test/app.tsx'
import { expectNoAxeViolations } from '../../../test/axe.ts'
import type { SessionInfo } from '../session/index.ts'
import { consumeLoginNotice } from '../session/index.ts'

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: false,
  user: { name: 'Ana', email: 'ana@correo.com' },
}
const MFA: SessionInfo = { ...ANONYMOUS, stage: 'mfa_pending', csrf_token: 'csrf-mfa' }
const LINK: SessionInfo = { ...ANONYMOUS, stage: 'link_pending', csrf_token: 'csrf-link' }

/** La sesión que devuelve GET /auth/session cambia según lo que ocurre en la prueba. */
function sessionState(initial: SessionInfo) {
  let current = initial
  return {
    handler: () => json(200, current),
    set(next: SessionInfo) {
      current = next
    },
  }
}

beforeEach(() => {
  setCsrfToken(null)
  consumeLoginNotice()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillLogin(email = 'ana@correo.com', password = 'una clave larga y segura') {
  await userEvent.type(await screen.findByLabelText('Correo electrónico'), email)
  await userEvent.click(screen.getByLabelText('Contraseña'))
  await userEvent.paste(password)
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

describe('/iniciar-sesion (HU-02)', () => {
  it('inicia sesión y lleva al inicio', async () => {
    const session = sessionState(ANONYMOUS)
    const api = mockApi({
      'GET /auth/session': session.handler,
      'POST /auth/login': () => {
        session.set(ACTIVE)
        return json(200, { next: 'app' })
      },
    })
    const { router } = renderApp('/iniciar-sesion')
    await fillLogin(' ana@correo.com ')
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(api.bodies('POST /auth/login')).toEqual([
      { email: 'ana@correo.com', password: 'una clave larga y segura' },
    ])
  })

  it('vuelve a la página protegida que se quería abrir', async () => {
    const session = sessionState(ANONYMOUS)
    mockApi({
      'GET /auth/session': session.handler,
      'POST /auth/login': () => {
        session.set(ACTIVE)
        return json(200, { next: 'app' })
      },
    })
    const { router } = renderApp('/perfil')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/iniciar-sesion')
    })
    await fillLogin()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/perfil')
    })
  })

  it('no redirige fuera de FINORA aunque se manipule el destino', async () => {
    const session = sessionState(ANONYMOUS)
    mockApi({
      'GET /auth/session': session.handler,
      'POST /auth/login': () => {
        session.set(ACTIVE)
        return json(200, { next: 'app' })
      },
    })
    const { router } = renderApp('/iniciar-sesion', { from: '//sitio.malo/robar' })
    await fillLogin()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })

  it('con MFA pide el código y después entra (HU-02 + RF-AUTH-12)', async () => {
    const session = sessionState(ANONYMOUS)
    const api = mockApi({
      'GET /auth/session': session.handler,
      'POST /auth/login': () => {
        session.set(MFA)
        return json(200, { next: 'mfa' })
      },
      'POST /auth/login/mfa': (body) => {
        if ((body as { code: string }).code !== '123456')
          return problem(401, 'invalid_credentials', 'El código no es correcto.')
        session.set(ACTIVE)
        return json(200, { next: 'app' })
      },
    })
    const { router, container } = renderApp('/iniciar-sesion', { from: '/perfil' })
    await fillLogin()
    const code = await screen.findByLabelText('Código o código de recuperación')
    expect(router.state.location.pathname).toBe('/iniciar-sesion/codigo')
    await expectNoAxeViolations(container)

    // VAL-AUTH-08: el error queda en el campo.
    await userEvent.type(code, '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(await screen.findByText('El código no es correcto.')).toBeInTheDocument()
    expect(code).toHaveAttribute('aria-invalid', 'true')

    await userEvent.clear(code)
    await userEvent.type(code, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/perfil')
    })
    // La petición del código usa el token anti-CSRF de la sesión pendiente.
    expect(api.headers('POST /auth/login/mfa').at(-1)?.['X-CSRF-Token']).toBe('csrf-mfa')
  })

  it('credenciales incorrectas: mensaje genérico (VAL-AUTH-05)', async () => {
    mockApi({
      'POST /auth/login': () =>
        problem(401, 'invalid_credentials', 'El correo o la contraseña no son correctos.'),
    })
    const { container } = renderApp('/iniciar-sesion')
    await fillLogin()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El correo o la contraseña no son correctos.',
    )
    await expectNoAxeViolations(container)
  })

  it('correo sin verificar: ofrece reenviar el enlace (VAL-AUTH-06)', async () => {
    const api = mockApi({
      'POST /auth/login': () =>
        problem(
          403,
          'email_not_verified',
          'Confirma tu correo para continuar. ¿Te enviamos el enlace de nuevo?',
        ),
      'POST /auth/verify-email/resend': () =>
        json(202, {
          message: 'Si tu cuenta está pendiente de confirmar, te enviamos un nuevo enlace.',
        }),
    })
    renderApp('/iniciar-sesion')
    await fillLogin()
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirma tu correo para continuar.')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar un nuevo enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent('te enviamos un nuevo enlace')
    expect(api.bodies('POST /auth/verify-email/resend')).toEqual([{ email: 'ana@correo.com' }])
  })

  it('cuenta bloqueada (VAL-AUTH-07)', async () => {
    mockApi({
      'POST /auth/login': () =>
        problem(429, 'too_many_attempts', 'Demasiados intentos. Intenta de nuevo en unos minutos.'),
    })
    renderApp('/iniciar-sesion')
    await fillLogin()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Intenta de nuevo en unos minutos.',
    )
  })

  it('pide los campos vacíos sin llamar a la API', async () => {
    const api = mockApi({})
    renderApp('/iniciar-sesion')
    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument()
    expect(api.bodies('POST /auth/login')).toEqual([])
  })

  it('tras confirmar el correo lo anuncia', async () => {
    mockApi({})
    renderApp('/iniciar-sesion', { emailVerified: true })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Tu correo quedó confirmado. Ya puedes iniciar sesión.',
    )
  })

  it('si la sesión venció lo dice una vez (VAL-AUTH-10)', async () => {
    // La sesión parecía activa, pero la primera petición del perfil recibe el 401.
    mockApi({
      'GET /auth/session': () => json(200, ACTIVE),
      'GET /me': () =>
        problem(401, 'session_expired', 'Tu sesión terminó. Inicia sesión de nuevo.'),
    })
    const { router } = renderApp('/perfil')
    expect(
      await screen.findByText('Tu sesión terminó. Inicia sesión de nuevo.'),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/iniciar-sesion')
    expect(router.state.location.state).toEqual({ from: '/perfil' })
    expect(consumeLoginNotice()).toBeNull() // ya se consumió
  })

  it.each([
    ['google', 'No pudimos iniciar sesión con Google. Intenta de nuevo.'], // VAL-AUTH-13
    ['google_unverified', 'Tu cuenta de Google no tiene el correo verificado.'], // VAL-AUTH-12
    ['otro', 'No pudimos iniciar sesión con Google. Intenta de nuevo.'],
  ])('error de Google "%s"', async (code, message) => {
    mockApi({})
    renderApp(`/iniciar-sesion?error=${code}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('ofrece Google solo si está configurado (HU-04)', async () => {
    mockApi({ 'GET /auth/session': () => json(200, { ...ANONYMOUS, google_enabled: true }) })
    const { container } = renderApp('/iniciar-sesion')
    expect(await screen.findByRole('link', { name: 'Continuar con Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google/start?intent=login&privacy_policy_version=0',
    )
    await expectNoAxeViolations(container)
  })

  it('sin Google configurado no hay botón', async () => {
    mockApi({})
    renderApp('/iniciar-sesion')
    await screen.findByRole('heading', { name: 'Inicia sesión' })
    expect(screen.queryByRole('link', { name: 'Continuar con Google' })).not.toBeInTheDocument()
  })

  it('con sesión iniciada lleva al inicio', async () => {
    mockApi({ 'GET /auth/session': () => json(200, ACTIVE) })
    const { router } = renderApp('/iniciar-sesion')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })
})

describe('/iniciar-sesion/vincular-google (RF-AUTH-17)', () => {
  it('pide la contraseña de FINORA y entra', async () => {
    const session = sessionState(LINK)
    const api = mockApi({
      'GET /auth/session': session.handler,
      'POST /auth/google/link': (body) => {
        if ((body as { password: string }).password !== 'la clave correcta')
          return problem(401, 'invalid_credentials', 'El correo o la contraseña no son correctos.')
        session.set(ACTIVE)
        return json(200, { next: 'app' })
      },
    })
    const { router, container } = renderApp('/iniciar-sesion/vincular-google')
    const password = await screen.findByLabelText('Contraseña de FINORA')
    await expectNoAxeViolations(container)

    await userEvent.type(password, 'otra')
    await userEvent.click(screen.getByRole('button', { name: 'Vincular y continuar' }))
    expect(
      await screen.findByText('El correo o la contraseña no son correctos.'),
    ).toBeInTheDocument()
    expect(password).toHaveAttribute('aria-invalid', 'true')

    await userEvent.clear(password)
    await userEvent.type(password, 'la clave correcta')
    await userEvent.click(screen.getByRole('button', { name: 'Vincular y continuar' }))
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(api.bodies('POST /auth/google/link')).toHaveLength(2)
  })

  it('con MFA, tras vincular pide el código', async () => {
    const session = sessionState(LINK)
    mockApi({
      'GET /auth/session': session.handler,
      'POST /auth/google/link': () => {
        session.set(MFA)
        return json(200, { next: 'mfa' })
      },
    })
    const { router } = renderApp('/iniciar-sesion/vincular-google')
    await userEvent.type(await screen.findByLabelText('Contraseña de FINORA'), 'clave')
    await userEvent.click(screen.getByRole('button', { name: 'Vincular y continuar' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/iniciar-sesion/codigo')
    })
  })
})

describe('inicio provisional y cierre de sesión (RF-AUTH-06)', () => {
  it('cierra la sesión, limpia los datos y lleva al inicio de sesión', async () => {
    const api = mockApi({
      'GET /auth/session': () => json(200, ACTIVE),
      'POST /auth/logout': () => json(204, null),
    })
    const { router, client, container } = renderApp('/')
    await screen.findByRole('heading', { name: 'Hola, Ana' })
    await expectNoAxeViolations(container)
    client.setQueryData(['datos', 'del', 'usuario'], { saldo: '1000' })

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/iniciar-sesion')
    })
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(client.getQueryData(['datos', 'del', 'usuario'])).toBeUndefined()
    expect(api.headers('POST /auth/logout')[0]?.['X-CSRF-Token']).toBe('csrf-activa')
  })
})
