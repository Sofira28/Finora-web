import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Alert, AuthLayout, Button } from '../../../components/index.ts'
import { ApiError } from '../../../lib/api/index.ts'
import type { LoginRedirectState } from '../session/index.ts'
import { verifyEmail } from '../shared/api.ts'
import { errorMessage } from '../shared/formErrors.ts'
import { MESSAGES } from '../shared/messages.ts'
import { ResendVerificationForm } from '../shared/ResendVerificationForm.tsx'

/**
 * Confirma el correo con el token del enlace (HU-03). El token se retira de la barra de
 * direcciones al cargar y la página no envía `Referer` (plan de authentication §3).
 */
export function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [token] = useState(() => searchParams.get('token'))
  const started = useRef(false)
  const verify = useMutation({
    mutationFn: verifyEmail,
    onSuccess: () => {
      const state: LoginRedirectState = { emailVerified: true }
      void navigate('/iniciar-sesion', { replace: true, state })
    },
  })
  const { mutate } = verify

  useEffect(() => {
    if (token === null || started.current) return
    // Una sola vez aunque React monte el efecto dos veces (StrictMode): el token es de un uso.
    started.current = true
    void navigate('.', { replace: true })
    mutate(token)
  }, [token, navigate, mutate])

  const invalid =
    token === null || (verify.error instanceof ApiError && verify.error.code === 'invalid_token')

  return (
    <AuthLayout title="Confirma tu correo">
      <meta name="referrer" content="no-referrer" />
      {invalid ? (
        <>
          <Alert variant="error">{MESSAGES.invalidLink}</Alert>
          <p>Escribe tu correo y te enviaremos un enlace nuevo.</p>
          <ResendVerificationForm />
        </>
      ) : verify.isError ? (
        <>
          <Alert variant="error">{errorMessage(verify.error)}</Alert>
          <Button
            fullWidth
            onClick={() => {
              mutate(token)
            }}
          >
            Intentar de nuevo
          </Button>
        </>
      ) : (
        <p role="status">Confirmando tu correo…</p>
      )}
      <p>
        <Link to="/iniciar-sesion">Ir al inicio de sesión</Link>
      </p>
    </AuthLayout>
  )
}
