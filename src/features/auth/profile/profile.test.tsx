import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../../lib/api/index.ts'
import { json, mockApi, problem, renderApp } from '../../../test/app.tsx'
import { expectNoAxeViolations } from '../../../test/axe.ts'
import type { SessionInfo } from '../session/index.ts'
import type { Profile } from './api.ts'

const SESSION: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: true,
  user: { name: 'Ana', email: 'ana@correo.com' },
}
const PROFILE: Profile = {
  name: 'Ana',
  email: 'ana@correo.com',
  has_password: true,
  google_linked: false,
  mfa_enabled: false,
}
const REAUTH_REQUIRED = () =>
  problem(403, 'reauthentication_required', 'Confirma tu identidad para continuar.')
const CODES = Array.from({ length: 10 }, (_, i) => `ABCDE-0000${String(i)}`)

type Handlers = Parameters<typeof mockApi>[0]
interface BackendState {
  profile: Profile
  reauthenticated: boolean
}

/** Simula el backend con estado: perfil y ventana de reautenticación de la sesión. */
function backend(
  initial: Partial<Profile> = {},
  handlers: (
    state: BackendState,
    sensitive: (action: () => Response) => () => Response,
  ) => Handlers = () => ({}),
) {
  const state: BackendState = { profile: { ...PROFILE, ...initial }, reauthenticated: false }
  // Acción con reautenticación reciente (RF-AUTH-21): sin ella, 403.
  const sensitive = (action: () => Response) => () =>
    state.reauthenticated ? action() : REAUTH_REQUIRED()
  const api = mockApi({
    'GET /auth/session': () => json(200, SESSION),
    'GET /me': () => json(200, state.profile),
    'POST /auth/reauthenticate': (body) => {
      const { password, code } = body as { password?: string; code?: string }
      const okPassword = !state.profile.has_password || password === 'clave actual correcta'
      const okCode = !state.profile.mfa_enabled || code === '111111'
      if (!okPassword || !okCode)
        return problem(401, 'invalid_credentials', 'La contraseña o el código no son correctos.')
      state.reauthenticated = true
      return json(204, null)
    },
    ...handlers(state, sensitive),
  })
  return { state, api }
}

async function openProfile(url = '/perfil') {
  const view = renderApp(url)
  await screen.findByRole('heading', { name: 'Tus datos' }, { timeout: 3000 })
  return view
}

const INVALID_CODE_422 = () =>
  problem(422, 'validation_failed', 'Los datos no son válidos.', {
    errors: [{ loc: ['body', 'code'], type: 'invalid_code', message: 'El código no es correcto.' }],
  })

const MFA_SETUP = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauth_uri: 'otpauth://totp/FINORA:ana%40correo.com?secret=JBSWY3DPEHPK3PXP&issuer=FINORA',
}

beforeEach(() => {
  setCsrfToken(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/perfil: datos y contraseña (RF-AUTH-14, 15 y 18)', () => {
  it('muestra los datos y cambia el nombre', async () => {
    const { api } = backend({ google_linked: true }, (state) => ({
      'PATCH /me': (body) => {
        state.profile = { ...state.profile, name: (body as { name: string }).name }
        return json(200, state.profile)
      },
    }))
    const { container } = await openProfile()
    expect(screen.getByText('ana@correo.com')).toBeInTheDocument()
    expect(screen.getByText('Contraseña y Google')).toBeInTheDocument()
    await expectNoAxeViolations(container)

    const name = screen.getByLabelText('Nombre')
    await userEvent.clear(name)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(await screen.findByText('Ingresa tu nombre.')).toBeInTheDocument()

    await userEvent.type(name, '  Ana María ')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(await screen.findByText('Guardamos tu nombre.')).toBeInTheDocument()
    expect(api.bodies('PATCH /me')).toEqual([{ name: 'Ana María' }])
  }, 15000)

  it('cambia la contraseña con la actual', async () => {
    const { api } = backend({}, () => ({
      'POST /me/password': (body) =>
        (body as { current_password: string }).current_password === 'clave actual correcta'
          ? json(204, null)
          : problem(401, 'invalid_credentials', 'La contraseña actual no es correcta.'),
    }))
    await openProfile()
    const current = screen.getByLabelText('Contraseña actual')
    await userEvent.type(current, 'otra')
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'una clave nueva y larga')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument()
    expect(current).toHaveFocus()

    await userEvent.clear(current)
    await userEvent.type(current, 'clave actual correcta')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(
      await screen.findByText(
        'Tu contraseña se actualizó. Cerramos tus sesiones en otros dispositivos.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('')
    expect(api.bodies('POST /me/password').at(-1)).toEqual({
      current_password: 'clave actual correcta',
      new_password: 'una clave nueva y larga',
    })
  })

  it('una contraseña nueva rechazada se muestra en su campo (RN-AUTH-02)', async () => {
    backend({}, () => ({
      'POST /me/password': () =>
        problem(422, 'validation_failed', 'Los datos no son válidos.', {
          errors: [
            {
              loc: ['body', 'new_password'],
              type: 'matches_email',
              message: 'La contraseña no puede ser igual a tu correo.',
            },
          ],
        }),
    }))
    await openProfile()
    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'clave actual correcta')
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'ana@correo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(
      await screen.findByText('La contraseña no puede ser igual a tu correo.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('aria-invalid', 'true')
  })

  it('una cuenta solo con Google pide el enlace para crear contraseña', async () => {
    const message = 'Te enviamos un enlace a tu correo para crear tu contraseña.'
    backend({ has_password: false, google_linked: true }, () => ({
      'POST /me/password/setup': () => json(202, { message }),
    }))
    await openProfile()
    expect(screen.getByText('Google')).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña actual')).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Enviar enlace para crear contraseña' }),
    )
    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})

describe('/perfil: verificación en dos pasos (RF-AUTH-10, 11, 13, 20 y 21)', () => {
  it('activa: reautentica, escanea, confirma y muestra los códigos una vez', async () => {
    const { api } = backend({}, (state, sensitive) => ({
      'POST /me/mfa/setup': sensitive(() => json(200, MFA_SETUP)),
      'POST /me/mfa/confirm': (body) => {
        if ((body as { code: string }).code !== '123456') return INVALID_CODE_422()
        state.profile = { ...state.profile, mfa_enabled: true }
        return json(200, { recovery_codes: CODES })
      },
    }))
    const { container } = await openProfile()
    await userEvent.click(screen.getByRole('button', { name: 'Activar verificación en dos pasos' }))

    // Sin reautenticación reciente: diálogo con la contraseña (sin MFA no pide código).
    const dialog = await screen.findByRole('dialog', { name: 'Confirma que eres tú' })
    expect(within(dialog).queryByLabelText(/Código/)).not.toBeInTheDocument()
    await expectNoAxeViolations(container)
    const password = within(dialog).getByLabelText('Contraseña')
    await userEvent.type(password, 'mala')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    expect(
      await within(dialog).findByText('La contraseña o el código no son correctos.'),
    ).toBeInTheDocument()
    await userEvent.clear(password)
    await userEvent.type(password, 'clave actual correcta')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    // Se repite la activación sola: QR, clave manual y advertencia RF-AUTH-20.
    const qr = await screen.findByRole('img', {
      name: 'Código QR para agregar FINORA a tu aplicación de autenticación',
    })
    expect(qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Si pierdes tu teléfono y tus códigos de recuperación, no podrás recuperar tu cuenta.',
      ),
    ).toBeInTheDocument()
    expect(api.bodies('POST /me/mfa/setup')).toHaveLength(2)
    await expectNoAxeViolations(container)

    const code = screen.getByLabelText('Código de la aplicación')
    await userEvent.type(code, '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y activar' }))
    expect(await screen.findByText('El código no es correcto.')).toBeInTheDocument()
    await userEvent.clear(code)
    await userEvent.type(code, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y activar' }))

    const list = await screen.findByRole('list', { name: 'Códigos de recuperación' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    await expectNoAxeViolations(container)

    // RF-AUTH-20: hay que confirmar que se guardaron.
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(screen.getByText('Confirma que guardaste tus códigos.')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'Guardé mis códigos de recuperación en un lugar seguro.',
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(await screen.findByText('Activa')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Códigos de recuperación' })).not.toBeInTheDocument()
  }, 15000)

  it('copia los códigos de recuperación', async () => {
    const user = userEvent.setup() // con portapapeles simulado
    const { state } = backend({}, () => ({
      'POST /me/mfa/setup': () => json(200, MFA_SETUP),
      'POST /me/mfa/confirm': () => json(200, { recovery_codes: CODES }),
    }))
    state.reauthenticated = true
    await openProfile()
    await user.click(screen.getByRole('button', { name: 'Activar verificación en dos pasos' }))
    await user.type(await screen.findByLabelText('Código de la aplicación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }))
    await user.click(await screen.findByRole('button', { name: 'Copiar códigos' }))
    expect(await screen.findByText('Copiamos los códigos.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(CODES.join('\n'))
  })

  it('desactiva: tras reautenticar pide un código nuevo (no se reutiliza)', async () => {
    const { api } = backend({ mfa_enabled: true }, (state, sensitive) => ({
      'POST /me/mfa/disable': sensitive(() => {
        state.profile = { ...state.profile, mfa_enabled: false }
        return json(204, null)
      }),
    }))
    await openProfile()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Código de tu aplicación'), '111111')
    await userEvent.click(
      screen.getByRole('button', { name: 'Desactivar verificación en dos pasos' }),
    )

    const dialog = await screen.findByRole('dialog', { name: 'Confirma que eres tú' })
    await userEvent.type(within(dialog).getByLabelText('Contraseña'), 'clave actual correcta')
    await userEvent.type(within(dialog).getByLabelText('Código o código de recuperación'), '111111')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    expect(
      await screen.findByText(/Escribe el siguiente código de tu aplicación/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Código de tu aplicación')).toHaveValue('')
    expect(api.bodies('POST /me/mfa/disable')).toHaveLength(1) // no reintenta solo

    await userEvent.type(screen.getByLabelText('Código de tu aplicación'), '222222')
    await userEvent.click(
      screen.getByRole('button', { name: 'Desactivar verificación en dos pasos' }),
    )
    expect(await screen.findByText('Estado: Inactiva')).toBeInTheDocument()
    expect(api.bodies('POST /me/mfa/disable').at(-1)).toEqual({ code: '222222' })
  })

  it('Cancelar cierra el diálogo sin reautenticar', async () => {
    const { api } = backend({}, (_, sensitive) => ({
      'POST /me/mfa/setup': sensitive(() => json(200, MFA_SETUP)),
    }))
    await openProfile()
    await userEvent.click(screen.getByRole('button', { name: 'Activar verificación en dos pasos' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.bodies('POST /auth/reauthenticate')).toEqual([])
  })
})

describe('/perfil: reautenticación con Google (RF-AUTH-21)', () => {
  it('una cuenta sin contraseña se reautentica pasando por Google', async () => {
    backend({ has_password: false, google_linked: true }, (_, sensitive) => ({
      'DELETE /me': sensitive(() => json(204, null)),
    }))
    await openProfile()
    await userEvent.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'ELIMINAR')
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirma que eres tú' })
    expect(within(dialog).getByRole('link', { name: 'Continuar con Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google/start?intent=reauth',
    )
    expect(within(dialog).queryByLabelText('Contraseña')).not.toBeInTheDocument()
  })

  it('al volver con reauth=codigo pide solo el código', async () => {
    const { api } = backend({ has_password: false, google_linked: true, mfa_enabled: true })
    const { router } = await openProfile('/perfil?reauth=codigo')
    await waitFor(() => {
      expect(router.state.location.search).toBe('')
    })
    const dialog = await screen.findByRole('dialog', { name: 'Confirma que eres tú' })
    expect(within(dialog).queryByLabelText('Contraseña')).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Código o código de recuperación'), '111111')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/Confirmaste tu identidad/)).toBeInTheDocument()
    expect(api.bodies('POST /auth/reauthenticate')).toEqual([{ code: '111111' }])
  })

  it.each([
    ['ok', 'Confirmaste tu identidad. Tienes 5 minutos para repetir la acción que querías hacer.'],
    ['error', 'No pudimos confirmar tu identidad con Google. Intenta de nuevo.'],
  ])('al volver con reauth=%s lo anuncia', async (result, message) => {
    backend({ has_password: false, google_linked: true })
    await openProfile(`/perfil?reauth=${result}`)
    expect(screen.getByText(message)).toBeInTheDocument()
  })
})

describe('/perfil: eliminación de la cuenta (RF-AUTH-16, CA-AUTH-10)', () => {
  it('exige escribir ELIMINAR', async () => {
    const { api } = backend()
    await openProfile()
    await userEvent.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'eliminar')
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
    expect(await screen.findByText('Escribe ELIMINAR para confirmar.')).toBeInTheDocument()
    expect(api.bodies('DELETE /me')).toEqual([])
  })

  it('reautentica, elimina, borra los datos locales y lo anuncia', async () => {
    const { api } = backend({}, (_, sensitive) => ({
      'DELETE /me': sensitive(() => json(204, null)),
    }))
    const { router, client } = await openProfile()
    await userEvent.type(screen.getByLabelText('Escribe ELIMINAR para confirmar'), 'ELIMINAR')
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Contraseña'), 'clave actual correcta')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Eliminamos tu cuenta y todos tus datos.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/iniciar-sesion')
    expect(api.bodies('DELETE /me')).toEqual([
      { confirmation: 'ELIMINAR' },
      { confirmation: 'ELIMINAR' },
    ])
    expect(client.getQueryData(['me'])).toBeUndefined()
    expect(client.getQueryData<SessionInfo>(['auth', 'session'])?.stage).toBeNull()
  })
})

describe('/perfil: protección', () => {
  it('sin sesión lleva al inicio de sesión', async () => {
    mockApi({})
    const { router } = renderApp('/perfil')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/iniciar-sesion')
    })
  })
})
