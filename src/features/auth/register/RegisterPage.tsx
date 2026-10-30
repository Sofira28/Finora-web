import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

import { Alert, AuthLayout, Button, PasswordField, TextField } from '../../../components/index.ts'
import { ApiError } from '../../../lib/api/index.ts'
import { PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from '../privacy/policy.ts'
import { register } from '../shared/api.ts'
import styles from '../shared/AuthForm.module.css'
import { applyFieldErrors, errorMessage } from '../shared/formErrors.ts'
import { GoogleSection } from '../shared/GoogleSection.tsx'
import { MESSAGES } from '../shared/messages.ts'

const POLICY_REQUIRED = 'Acepta la política de tratamiento de datos para crear tu cuenta.'
const POLICY_CHANGED =
  'La política de tratamiento de datos cambió. Recarga la página para revisarla y aceptarla.'

// Ayuda al usuario; las reglas las decide el backend (RN-AUTH-02 y RN-AUTH-03).
const schema = z.object({
  name: z.string().trim().min(1, MESSAGES.nameRequired).max(100, MESSAGES.nameTooLong),
  email: z.string().trim().pipe(z.email(MESSAGES.invalidEmail)),
  password: z.string().min(12, MESSAGES.passwordTooShort).max(128, MESSAGES.passwordTooLong),
  acceptPolicy: z.boolean().refine((accepted) => accepted, POLICY_REQUIRED),
})
type Values = z.infer<typeof schema>

export interface CheckEmailState {
  email?: string
}

function policyRejected(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.problem.errors ?? []).some((e) => e.type === 'policy_not_accepted')
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', acceptPolicy: false },
  })
  const { errors } = form.formState
  const submit = useMutation({
    mutationFn: (values: Values) =>
      register({
        email: values.email,
        name: values.name,
        password: values.password,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
      }),
  })

  const onSubmit = form.handleSubmit((values) => {
    submit.mutate(values, {
      onSuccess: () => {
        const state: CheckEmailState = { email: values.email }
        void navigate('/registro/revisa-tu-correo', { state })
      },
      onError: (error) => {
        applyFieldErrors(error, form.setError, {
          email: MESSAGES.invalidEmail,
          name: MESSAGES.nameRequired,
          password: MESSAGES.passwordTooShort,
        })
      },
    })
  })

  const fieldErrorShown = Boolean(errors.email ?? errors.name ?? errors.password)
  const policyErrorId = 'politica-error'

  return (
    <AuthLayout
      title="Crea tu cuenta"
      description="Tu dinero, más claro."
      footer={
        <>
          ¿Ya tienes una cuenta? <Link to="/iniciar-sesion">Inicia sesión</Link>
        </>
      }
    >
      {submit.isError && policyRejected(submit.error) && (
        <Alert variant="error">{POLICY_CHANGED}</Alert>
      )}
      {submit.isError && !policyRejected(submit.error) && !fieldErrorShown && (
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
          label="Nombre"
          autoComplete="name"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <PasswordField
          label="Contraseña"
          autoComplete="new-password"
          hint="Mínimo 12 caracteres. Puedes usar una frase fácil de recordar."
          error={errors.password?.message}
          {...form.register('password')}
        />
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            aria-invalid={errors.acceptPolicy ? true : undefined}
            aria-describedby={errors.acceptPolicy ? policyErrorId : undefined}
            {...form.register('acceptPolicy')}
          />
          <span>
            Acepto la{' '}
            <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener">
              Política de tratamiento de datos personales{' '}
              <span className="visually-hidden">(se abre en una pestaña nueva)</span>
            </a>
            .
          </span>
        </label>
        {errors.acceptPolicy && (
          <p id={policyErrorId} className={styles.checkboxError}>
            {errors.acceptPolicy.message}
          </p>
        )}
        <Button type="submit" fullWidth loading={submit.isPending}>
          Crear cuenta
        </Button>
      </form>
      <GoogleSection />
    </AuthLayout>
  )
}
