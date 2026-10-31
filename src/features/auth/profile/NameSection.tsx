import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alert, Button, TextField } from '../../../components/index.ts'
import { sessionQueryKey } from '../session/index.ts'
import formStyles from '../shared/AuthForm.module.css'
import { applyFieldErrors, errorMessage } from '../shared/formErrors.ts'
import { MESSAGES } from '../shared/messages.ts'
import { type Profile, profileQueryKey, renameProfile } from './api.ts'
import styles from './Profile.module.css'
import { Section } from './Section.tsx'

const schema = z.object({
  name: z.string().trim().min(1, MESSAGES.nameRequired).max(100, MESSAGES.nameTooLong),
})
type Values = z.infer<typeof schema>

function accessMethod(profile: Profile): string {
  if (profile.has_password && profile.google_linked) return 'Contraseña y Google'
  return profile.has_password ? 'Contraseña' : 'Google'
}

/** Datos del perfil y edición del nombre (RF-AUTH-14). */
export function NameSection({ profile }: { profile: Profile }) {
  const client = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: profile.name },
  })
  const nameError = form.formState.errors.name
  const save = useMutation({
    mutationFn: (values: Values) => renameProfile(values.name),
    onSuccess: (updated) => {
      client.setQueryData(profileQueryKey, updated)
      form.reset({ name: updated.name })
      // El saludo del inicio sale de la sesión.
      void client.invalidateQueries({ queryKey: sessionQueryKey })
    },
    onError: (error) => {
      applyFieldErrors(error, form.setError, { name: MESSAGES.nameRequired })
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    save.mutate(values)
  })

  return (
    <Section title="Tus datos">
      <dl className={styles.facts}>
        <dt>Correo electrónico</dt>
        <dd>{profile.email}</dd>
        <dt>Método de acceso</dt>
        <dd>{accessMethod(profile)}</dd>
      </dl>
      {save.isSuccess && <Alert variant="success">Guardamos tu nombre.</Alert>}
      {save.isError && !nameError && <Alert variant="error">{errorMessage(save.error)}</Alert>}
      <form
        className={formStyles.form}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
      >
        <TextField
          label="Nombre"
          autoComplete="name"
          error={nameError?.message}
          {...form.register('name')}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="secondary" loading={save.isPending}>
            Guardar nombre
          </Button>
        </div>
      </form>
    </Section>
  )
}
