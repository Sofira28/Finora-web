import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Alert, AuthLayout, Button, PasswordField, TextField } from '../../../components/index.ts'
import { ApiError } from '../../../lib/api/index.ts'
import {
  clearLoginNotice,
  type LoginRedirectState,
  peekLoginNotice,
  refreshSession,
  SESSION_EXPIRED_MESSAGE,
} from '../session/index.ts'
import styles from '../shared/AuthForm.module.css'
import { errorMessage } from '../shared/formErrors.ts'
import { GoogleSection } from '../shared/GoogleSection.tsx'
import { MESSAGES } from '../shared/messages.ts'
import { ResendVerificationForm } from '../shared/ResendVerificationForm.tsx'
import { login } from './api.ts'

// Solo se exige que haya algo escrito: un correo mal formado recibe el mismo 401 genérico.
const schema = z.object({
  email: z.string().trim().min(1, MESSAGES.emailRequired),
  password: z.string().min(1, MESSAGES.passwordRequired),
})
type Values = z.infer<typeof schema>

const GOOGLE_ERRORS: Record<string, string> = {
  google: MESSAGES.googleFailed, // VAL-AUTH-13
  google_unverified: MESSAGES.googleUnverified, // VAL-AUTH-12
}

/** Avisos con los que se llega a la página (una sola vez, aunque React renderice dos veces). */
function useArrivalNotice(): { variant: 'success' | 'info' | 'error'; text: string } | null {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [lostSession] = useState(peekLoginNotice)
  useEffect(() => {
    clearLoginNotice()
  }, [])

  const googleError = searchParams.get('error')
  if (googleError)
    return { variant: 'error', text: GOOGLE_ERRORS[googleError] ?? MESSAGES.googleFailed }
  const state = location.state as LoginRedirectState | null
  if (state?.emailVerified) return { variant: 'success', text: MESSAGES.emailVerified }
  if (state?.passwordReset) return { variant: 'success', text: MESSAGES.passwordReset }
  if (lostSession === 'session_expired') return { variant: 'info', text: SESSION_EXPIRED_MESSAGE }
  if (lostSession === 'account_deleted') return { variant: 'info', text: MESSAGES.accountDeleted }
  return null
}

/** Inicio de sesión con correo y contraseña o con Google (HU-02, HU-04). */
export function LoginPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = useArrivalNotice()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })
  const { errors } = form.formState
  const submit = useMutation({
    mutationFn: (values: Values) => login(values.email, values.password),
    onSuccess: async (result) => {
      // La sesión nueva trae otro token anti-CSRF. Si queda activa, GuestRoute lleva a la
      // página que se quería abrir; si falta el código, se pasa a pedirlo.
      await refreshSession(client)
      if (result.next === 'mfa') {
        void navigate('/iniciar-sesion/codigo', { state: location.state as unknown })
      }
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    submit.mutate(values)
  })

  const unverified = submit.error instanceof ApiError && submit.error.code === 'email_not_verified'

  return (
    <AuthLayout
      title="Inicia sesión"
      description="Tu dinero, más claro."
      footer={
        <>
          ¿No tienes una cuenta? <Link to="/registro">Regístrate</Link>
        </>
      }
    >
      {notice && !submit.isError && <Alert variant={notice.variant}>{notice.text}</Alert>}
      {submit.isError && <Alert variant="error">{errorMessage(submit.error)}</Alert>}
      {unverified && <ResendVerificationForm email={form.getValues('email').trim()} />}
      <form
        className={styles.form}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
      >
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <PasswordField
          label="Contraseña"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register('password')}
        />
        <p className={styles.note}>
          <Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>
        </p>
        <Button type="submit" fullWidth loading={submit.isPending}>
          Iniciar sesión
        </Button>
      </form>
      <GoogleSection />
    </AuthLayout>
  )
}
