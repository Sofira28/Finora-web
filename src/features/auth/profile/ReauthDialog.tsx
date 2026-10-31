import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  Alert,
  Button,
  Dialog,
  GoogleButton,
  OtpField,
  PasswordField,
} from '../../../components/index.ts'
import { ApiError } from '../../../lib/api/index.ts'
import styles from '../shared/AuthForm.module.css'
import { errorMessage } from '../shared/formErrors.ts'
import { googleStartUrl } from '../shared/google.ts'
import { MESSAGES } from '../shared/messages.ts'
import { type Profile, reauthenticate } from './api.ts'

/** `code`: segundo paso tras volver de Google con la MFA activa (`/perfil?reauth=codigo`). */
export type ReauthMode = 'full' | 'code'

interface ReauthDialogProps {
  open: boolean
  mode: ReauthMode
  profile: Profile
  onSuccess: () => void
  onClose: () => void
}

const schema = z.object({ password: z.string(), code: z.string().trim() })
type Values = z.infer<typeof schema>

/**
 * Reautenticación reciente para acciones sensibles (RF-AUTH-21): contraseña si la cuenta la
 * tiene o, si solo usa Google, volver a pasar por Google; más el código si la MFA está activa.
 */
export function ReauthDialog({ open, mode, profile, onSuccess, onClose }: ReauthDialogProps) {
  const needsPassword = mode === 'full' && profile.has_password
  const needsCode = profile.mfa_enabled
  const withGoogle = mode === 'full' && !profile.has_password

  const form = useForm<Values>({
    resolver: zodResolver(
      schema.superRefine((values, ctx) => {
        if (needsPassword && !values.password)
          ctx.addIssue({ code: 'custom', path: ['password'], message: MESSAGES.passwordRequired })
        if (needsCode && !values.code)
          ctx.addIssue({ code: 'custom', path: ['code'], message: MESSAGES.codeRequired })
      }),
    ),
    defaultValues: { password: '', code: '' },
  })
  const { errors } = form.formState

  const submit = useMutation({
    mutationFn: (values: Values) =>
      reauthenticate({
        ...(needsPassword ? { password: values.password } : {}),
        ...(needsCode ? { code: values.code } : {}),
      }),
    onSuccess: () => {
      form.reset()
      onSuccess()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'invalid_credentials') {
        form.setError(
          needsPassword ? 'password' : 'code',
          { type: 'server', message: error.message },
          {
            shouldFocus: true,
          },
        )
      }
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    submit.mutate(values)
  })
  const close = () => {
    form.reset()
    submit.reset()
    onClose()
  }
  const fieldError = Boolean(errors.password ?? errors.code)

  return (
    <Dialog
      open={open}
      title="Confirma que eres tú"
      description={
        withGoogle
          ? 'Por seguridad, vuelve a entrar con Google. Después regresarás a tu perfil y tendrás 5 minutos para completar la acción.'
          : 'Por seguridad, confirma tu identidad para continuar. Valdrá durante 5 minutos.'
      }
      onClose={close}
    >
      {withGoogle ? (
        <>
          <GoogleButton href={googleStartUrl('reauth')} />
          <Button variant="ghost" fullWidth onClick={close}>
            Cancelar
          </Button>
        </>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            void onSubmit(event)
          }}
          noValidate
        >
          {submit.isError && !fieldError && (
            <Alert variant="error">{errorMessage(submit.error)}</Alert>
          )}
          {needsPassword && (
            <PasswordField
              label="Contraseña"
              autoComplete="current-password"
              autoFocus
              error={errors.password?.message}
              {...form.register('password')}
            />
          )}
          {needsCode && (
            <OtpField
              label="Código o código de recuperación"
              allowRecoveryCode
              autoFocus={!needsPassword}
              error={errors.code?.message}
              {...form.register('code')}
            />
          )}
          <Button type="submit" fullWidth loading={submit.isPending}>
            Confirmar
          </Button>
          <Button variant="ghost" fullWidth onClick={close}>
            Cancelar
          </Button>
        </form>
      )}
    </Dialog>
  )
}
