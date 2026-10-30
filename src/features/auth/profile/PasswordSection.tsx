import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alert, Button, PasswordField } from '../../../components/index.ts'
import { ApiError } from '../../../lib/api/index.ts'
import formStyles from '../shared/AuthForm.module.css'
import { applyFieldErrors, errorMessage } from '../shared/formErrors.ts'
import { MESSAGES } from '../shared/messages.ts'
import { changePassword, type Profile, requestPasswordSetup } from './api.ts'
import styles from './Profile.module.css'
import { Section } from './Section.tsx'

const schema = z.object({
  current_password: z.string().min(1, MESSAGES.passwordRequired),
  new_password: z.string().min(12, MESSAGES.passwordTooShort).max(128, MESSAGES.passwordTooLong),
})
type Values = z.infer<typeof schema>

/** Cambio de contraseña (RF-AUTH-15) o creación de la primera (RF-AUTH-18). */
export function PasswordSection({ profile }: { profile: Profile }) {
  return profile.has_password ? <ChangePassword /> : <CreatePassword />
}

function ChangePassword() {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', new_password: '' },
  })
  const { errors } = form.formState
  const save = useMutation({
    mutationFn: (values: Values) => changePassword(values.current_password, values.new_password),
    onSuccess: () => {
      form.reset()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'invalid_credentials') {
        form.setError(
          'current_password',
          { type: 'server', message: error.message },
          { shouldFocus: true },
        )
        return
      }
      applyFieldErrors(error, form.setError, { new_password: MESSAGES.passwordTooShort })
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    save.mutate(values)
  })
  const fieldError = Boolean(errors.current_password ?? errors.new_password)

  return (
    <Section
      title="Contraseña"
      description="Al cambiarla cerraremos tus sesiones en otros dispositivos."
    >
      {save.isSuccess && (
        <Alert variant="success">
          Tu contraseña se actualizó. Cerramos tus sesiones en otros dispositivos.
        </Alert>
      )}
      {save.isError && !fieldError && <Alert variant="error">{errorMessage(save.error)}</Alert>}
      <form
        className={formStyles.form}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
      >
        <PasswordField
          label="Contraseña actual"
          autoComplete="current-password"
          error={errors.current_password?.message}
          {...form.register('current_password')}
        />
        <PasswordField
          label="Contraseña nueva"
          autoComplete="new-password"
          hint="Mínimo 12 caracteres."
          error={errors.new_password?.message}
          {...form.register('new_password')}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="secondary" loading={save.isPending}>
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </Section>
  )
}

function CreatePassword() {
  const send = useMutation({ mutationFn: requestPasswordSetup })
  return (
    <Section
      title="Contraseña"
      description="Entras con Google. Si quieres, crea también una contraseña de FINORA: te enviaremos un enlace a tu correo."
    >
      {send.isSuccess && <Alert variant="success">{send.data.message}</Alert>}
      {send.isError && <Alert variant="error">{errorMessage(send.error)}</Alert>}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          loading={send.isPending}
          onClick={() => {
            send.mutate()
          }}
        >
          Enviar enlace para crear contraseña
        </Button>
      </div>
    </Section>
  )
}
