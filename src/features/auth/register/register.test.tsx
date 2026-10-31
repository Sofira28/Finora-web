import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { ANONYMOUS, json, mockApi, problem, renderApp } from '../../../test/app.tsx'
import { expectNoAxeViolations } from '../../../test/axe.ts'

const CLAVE = 'caballo correcto batería grapa'
const SENT = { message: 'Te enviamos un correo para confirmar tu cuenta.' }

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fill(
  options: { name?: string; email?: string; password?: string; accept?: boolean } = {},
) {
  const { name = 'Ana', email = 'ana@correo.com', password = CLAVE, accept = true } = options
  if (name) await userEvent.type(screen.getByLabelText('Nombre'), name)
  if (email) await userEvent.type(screen.getByLabelText('Correo electrónico'), email)
  if (password) {
    // Se pega, como lo haría un gestor de contraseñas (WCAG 3.3.8).
    await userEvent.click(screen.getByLabelText('Contraseña'))
    await userEvent.paste(password)
  }
  if (accept) await userEvent.click(screen.getByRole('checkbox'))
}

async function submit() {
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('/registro (HU-01)', () => {
  it('registra y lleva a "Revisa tu correo"', async () => {
    const api = mockApi({ 'POST /auth/register': () => json(202, SENT) })
    const { router } = renderApp('/registro')
    await fill({ email: '  ana@correo.com ' })
    await submit()

    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/registro/revisa-tu-correo')
    expect(screen.getByText('ana@correo.com')).toBeInTheDocument()
    expect(api.bodies('POST /auth/register')).toEqual([
      { email: 'ana@correo.com', name: 'Ana', password: CLAVE, privacy_policy_version: '0' },
    ])
  })

  it('valida antes de enviar, con los textos de la spec', async () => {
    const api = mockApi({})
    renderApp('/registro')
    await fill({ name: '   ', email: 'ana@', password: 'corta', accept: false })
    await submit()

    expect(await screen.findByText('Ingresa tu nombre.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa un correo electrónico válido.')).toBeInTheDocument()
    expect(screen.getByText('La contraseña debe tener al menos 12 caracteres.')).toBeInTheDocument()
    expect(
      screen.getByText('Acepta la política de tratamiento de datos para crear tu cuenta.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
    expect(api.bodies('POST /auth/register')).toEqual([])
  })

  it('muestra en el campo la regla que rechazó el backend (VAL-AUTH-02)', async () => {
    mockApi({
      'POST /auth/register': () =>
        problem(422, 'validation_failed', 'Los datos no son válidos.', {
          errors: [
            {
              loc: ['body', 'password'],
              type: 'too_common',
              message: 'Esta contraseña es muy común. Elige otra.',
            },
          ],
        }),
    })
    renderApp('/registro')
    await fill()
    await submit()
    expect(await screen.findByText('Esta contraseña es muy común. Elige otra.')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un error de formato del backend usa el texto de la spec (VAL-AUTH-01)', async () => {
    mockApi({
      'POST /auth/register': () =>
        problem(422, 'validation_failed', 'Los datos no son válidos.', {
          errors: [{ loc: ['body', 'email'], type: 'value_error' }],
        }),
    })
    renderApp('/registro')
    await fill()
    await submit()
    expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeInTheDocument()
  })

  it('si cambió la versión de la política pide recargar', async () => {
    mockApi({
      'POST /auth/register': () =>
        problem(422, 'validation_failed', 'Los datos no son válidos.', {
          errors: [
            {
              loc: ['body', 'privacy_policy_version'],
              type: 'policy_not_accepted',
              message: 'Debes aceptar la política vigente.',
            },
          ],
        }),
    })
    renderApp('/registro')
    await fill()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La política de tratamiento de datos cambió. Recarga la página para revisarla y aceptarla.',
    )
  })

  it('demasiados intentos (429)', async () => {
    mockApi({
      'POST /auth/register': () =>
        problem(429, 'too_many_attempts', 'Demasiados intentos. Intenta de nuevo en unos minutos.'),
    })
    renderApp('/registro')
    await fill()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Intenta de nuevo en unos minutos.',
    )
  })

  it('el enlace a la política abre una pestaña nueva y lo anuncia', async () => {
    mockApi({})
    renderApp('/registro')
    await screen.findByRole('heading', { name: 'Crea tu cuenta' })
    const link = await screen.findByRole('link', {
      name: 'Política de tratamiento de datos personales (se abre en una pestaña nueva)',
    })
    expect(link).toHaveAttribute('href', '/politica-de-datos')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('ofrece Google con el aviso de la política solo si está configurado', async () => {
    mockApi({ 'GET /auth/session': () => json(200, { ...ANONYMOUS, google_enabled: true }) })
    renderApp('/registro')
    const google = await screen.findByRole('link', { name: 'Continuar con Google' })
    expect(google).toHaveAttribute(
      'href',
      '/api/v1/auth/google/start?intent=login&privacy_policy_version=0',
    )
    expect(screen.getByText(/Al continuar con Google aceptas la/)).toBeInTheDocument()
  })

  it('sin Google configurado no hay botón', async () => {
    const api = mockApi({})
    renderApp('/registro')
    await waitFor(() => {
      expect(api.fetchMock).toHaveBeenCalled()
    })
    expect(screen.queryByRole('link', { name: 'Continuar con Google' })).not.toBeInTheDocument()
  })

  it('con sesión iniciada lleva al inicio', async () => {
    mockApi({
      'GET /auth/session': () =>
        json(200, {
          stage: 'active',
          csrf_token: 't',
          google_enabled: false,
          user: { name: 'Ana', email: 'ana@correo.com' },
        }),
    })
    const { router } = renderApp('/registro')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })

  it('sin violaciones de accesibilidad, también con errores', async () => {
    mockApi({})
    const { container } = renderApp('/registro')
    await expectNoAxeViolations(container)
    await submit()
    await screen.findByText('Ingresa tu nombre.')
    await expectNoAxeViolations(container)
  })
})

describe('/registro/revisa-tu-correo', () => {
  const RESENT = {
    message: 'Si tu cuenta está pendiente de confirmar, te enviamos un nuevo enlace.',
  }

  it('reenvía el enlace al correo recién registrado', async () => {
    const api = mockApi({ 'POST /auth/verify-email/resend': () => json(202, RESENT) })
    renderApp('/registro/revisa-tu-correo', { email: 'ana@correo.com' })
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar un nuevo enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent(RESENT.message)
    expect(api.bodies('POST /auth/verify-email/resend')).toEqual([{ email: 'ana@correo.com' }])
  })

  it('si se llega sin el correo, lo pide', async () => {
    const api = mockApi({ 'POST /auth/verify-email/resend': () => json(202, RESENT) })
    const { container } = renderApp('/registro/revisa-tu-correo')
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar un nuevo enlace' }))
    await screen.findByText(RESENT.message)
    expect(api.bodies('POST /auth/verify-email/resend')).toEqual([{ email: 'ana@correo.com' }])
    await expectNoAxeViolations(container)
  })
})
