import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'

import { Alert, AuthLayout, Button, PasswordField } from '../../../components/index.ts'
import { ApiError } from '../../../lib/api/index.ts'
import { refreshSession } from '../session/index.ts'
import styles from '../shared/AuthForm.module.css'
import { errorMessage } from '../shared/formErrors.ts'
import { MESSAGES } from '../shared/messages.ts'
import { linkGoogle } from './api.ts'

const schema = z.object({ password: z.string().min(1, MESSAGES.passwordRequired) })
type Values = z.infer<typeof schema>

/**
 * RF-AUTH-17 / CA-AUTH-13: el correo de Google ya tiene una cuenta con contraseña. Se pide la
 * contraseña de FINORA antes de vincular; si hay MFA, después se pide el código.
 */
export function LinkGooglePage() {
  const client = useQueryClient()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '' } })
  const submit = useMutation({
    mutationFn: (values: Values) => linkGoogle(values.password),
    // La sesión pasa a activa o a pendiente del código; ProtectedRoute redirige.
    onSuccess: () => refreshSession(client),
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'invalid_credentials') {
        form.setError('password', { type: 'server', message: error.message }, { shouldFocus: true })
      }
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    submit.mutate(values)
  })
  const passwordError = form.formState.errors.password

  return (
    <AuthLayout
      title="Vincula tu cuenta de Google"
      description="Ya tienes una cuenta en FINORA con este correo. Escribe tu contraseña de FINORA para vincular Google; después podrás entrar con cualquiera de los dos."
      footer={<Link to="/iniciar-sesion">Cancelar</Link>}
    >
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
          label="Contraseña de FINORA"
          autoComplete="current-password"
          autoFocus
          error={passwordError?.message}
          {...form.register('password')}
        />
        <p className={styles.note}>
          <Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>
        </p>
        <Button type="submit" fullWidth loading={submit.isPending}>
          Vincular y continuar
        </Button>
      </form>
    </AuthLayout>
  )
}
