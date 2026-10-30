import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alert, Button, TextField } from '../../../components/index.ts'
import { resendVerification } from './api.ts'
import styles from './AuthForm.module.css'
import { applyFieldErrors, errorMessage } from './formErrors.ts'
import { MESSAGES } from './messages.ts'

const schema = z.object({ email: z.string().trim().pipe(z.email(MESSAGES.invalidEmail)) })
type Values = z.infer<typeof schema>

interface ResendVerificationFormProps {
  /** Correo conocido (p. ej. recién registrado): no se pide de nuevo. */
  email?: string
}

/** Pide un nuevo enlace de verificación; la respuesta es la misma exista o no la cuenta. */
export function ResendVerificationForm({ email }: ResendVerificationFormProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: email ?? '' },
  })
  const resend = useMutation({ mutationFn: (values: Values) => resendVerification(values.email) })

  const onSubmit = form.handleSubmit((values) => {
    resend.mutate(values, {
      onError: (error) => {
        applyFieldErrors(error, form.setError, { email: MESSAGES.invalidEmail })
      },
    })
  })

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        void onSubmit(event)
      }}
      noValidate
    >
      {resend.isSuccess && <Alert variant="success">{resend.data.message}</Alert>}
      {resend.isError && !form.formState.errors.email && (
        <Alert variant="error">{errorMessage(resend.error)}</Alert>
      )}
      {email === undefined && (
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
      )}
      <Button type="submit" variant="secondary" fullWidth loading={resend.isPending}>
        Enviar un nuevo enlace
      </Button>
    </form>
  )
}
