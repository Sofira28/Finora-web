import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Alert, AuthLayout, Button, PasswordField } from '../../../components/index.ts'
import { ApiError } from '../../../lib/api/index.ts'
import { type LoginRedirectState, refreshSession } from '../session/index.ts'
import styles from '../shared/AuthForm.module.css'
import { applyFieldErrors, errorMessage } from '../shared/formErrors.ts'
import { MESSAGES } from '../shared/messages.ts'
import { resetPassword } from './api.ts'

const schema = z.object({
  new_password: z.string().min(12, MESSAGES.passwordTooShort).max(128, MESSAGES.passwordTooLong),
})
type Values = z.infer<typeof schema>

/**
 * Crea la contraseña nueva con el token del enlace (HU-05); también la primera de una cuenta
 * que solo usa Google (RF-AUTH-18). El token se retira de la barra de direcciones y la página
 * no envía `Referer`. El backend valida la contraseña antes de gastar el enlace.
 */
export function ResetPasswordPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [token] = useState(() => searchParams.get('token'))
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: '' },
  })
  const passwordError = form.formState.errors.new_password

  useEffect(() => {
    if (searchParams.has('token')) void navigate('.', { replace: true })
  }, [searchParams, navigate])

  const submit = useMutation({
    mutationFn: (values: Values) => resetPassword(token ?? '', values.new_password),
    onSuccess: async () => {
      // RF-AUTH-09: el backend cerró todas las sesiones, también la de este navegador.
      await refreshSession(client).catch(() => undefined)
      const state: LoginRedirectState = { passwordReset: true }
      void navigate('/iniciar-sesion', { replace: true, state })
    },
    onError: (error) => {
      applyFieldErrors(error, form.setError, { new_password: MESSAGES.passwordTooShort })
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    submit.mutate(values)
  })

  const invalid =
    token === null || (submit.error instanceof ApiError && submit.error.code === 'invalid_token')

  return (
    <AuthLayout
      title="Crea tu nueva contraseña"
      footer={<Link to="/iniciar-sesion">Volver al inicio de sesión</Link>}
    >
      <meta name="referrer" content="no-referrer" />
      {invalid ? (
        <>
          <Alert variant="error">{MESSAGES.invalidLink}</Alert>
          <Link to="/recuperar-contrasena">Solicitar un enlace nuevo</Link>
        </>
      ) : (
        <>
          {submit.isError && !passwordError && (
            <Alert variant="error">{errorMessage(submit.error)}</Alert>
          )}
          <form
            className={styles.form}
            onSubmit={(event) => {
              void onSubmit(event)
            }}
            noValidate
          >
            <PasswordField
              label="Contraseña nueva"
              autoComplete="new-password"
              hint="Mínimo 12 caracteres. Al guardarla se cerrarán tus sesiones abiertas."
              error={passwordError?.message}
              {...form.register('new_password')}
            />
            <Button type="submit" fullWidth loading={submit.isPending}>
              Guardar contraseña
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
