import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'

import { Alert, AuthLayout, Button, TextField } from '../../../components/index.ts'
import styles from '../shared/AuthForm.module.css'
import { applyFieldErrors, errorMessage } from '../shared/formErrors.ts'
import { MESSAGES } from '../shared/messages.ts'
import { forgotPassword } from './api.ts'

const schema = z.object({ email: z.string().trim().pipe(z.email(MESSAGES.invalidEmail)) })
type Values = z.infer<typeof schema>

/**
 * Solicitud del enlace de recuperación (HU-05). Si la cuenta solo usa Google, el mismo enlace
 * crea su primera contraseña (RF-AUTH-18). La respuesta no revela si el correo existe.
 */
export function ForgotPasswordPage() {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const emailError = form.formState.errors.email
  const submit = useMutation({
    mutationFn: (values: Values) => forgotPassword(values.email),
    onError: (error) => {
      applyFieldErrors(error, form.setError, { email: MESSAGES.invalidEmail })
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    submit.mutate(values)
  })

  return (
    <AuthLayout
      title="Recupera tu contraseña"
      description="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva. Vence en una hora."
      footer={<Link to="/iniciar-sesion">Volver al inicio de sesión</Link>}
    >
      {submit.isSuccess ? (
        <>
          <Alert variant="success">{submit.data.message}</Alert>
          <p>Revisa también la carpeta de correo no deseado.</p>
        </>
      ) : (
        <>
          {submit.isError && !emailError && (
            <Alert variant="error">{errorMessage(submit.error)}</Alert>
          )}
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
              autoComplete="email"
              error={emailError?.message}
              {...form.register('email')}
            />
            <Button type="submit" fullWidth loading={submit.isPending}>
              Enviar enlace
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
