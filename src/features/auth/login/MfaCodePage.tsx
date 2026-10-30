import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'

import { Alert, AuthLayout, Button, OtpField } from '../../../components/index.ts'
import { ApiError } from '../../../lib/api/index.ts'
import { refreshSession } from '../session/index.ts'
import styles from '../shared/AuthForm.module.css'
import { errorMessage } from '../shared/formErrors.ts'
import { MESSAGES } from '../shared/messages.ts'
import { loginMfa } from './api.ts'

const schema = z.object({ code: z.string().trim().min(1, MESSAGES.codeRequired) })
type Values = z.infer<typeof schema>

/** Segundo paso del inicio de sesión, también con Google (RF-AUTH-12, RF-AUTH-19). */
export function MfaCodePage() {
  const client = useQueryClient()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '' } })
  const submit = useMutation({
    mutationFn: (values: Values) => loginMfa(values.code),
    // Con la sesión activa, ProtectedRoute lleva a la página que se quería abrir.
    onSuccess: () => refreshSession(client),
    onError: (error) => {
      // VAL-AUTH-08: el código incorrecto se muestra en el campo.
      if (error instanceof ApiError && error.code === 'invalid_credentials') {
        form.setError('code', { type: 'server', message: error.message }, { shouldFocus: true })
      }
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    submit.mutate(values)
  })
  const codeError = form.formState.errors.code

  return (
    <AuthLayout
      title="Verificación en dos pasos"
      description="Escribe el código de 6 dígitos de tu aplicación de autenticación. Si no tienes tu teléfono, usa uno de tus códigos de recuperación."
      footer={<Link to="/iniciar-sesion">Volver al inicio de sesión</Link>}
    >
      {submit.isError && !codeError && <Alert variant="error">{errorMessage(submit.error)}</Alert>}
      <form
        className={styles.form}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
      >
        <OtpField
          label="Código o código de recuperación"
          allowRecoveryCode
          autoFocus
          error={codeError?.message}
          {...form.register('code')}
        />
        <Button type="submit" fullWidth loading={submit.isPending}>
          Verificar
        </Button>
      </form>
    </AuthLayout>
  )
}
