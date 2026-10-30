import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'

import { Alert, Button, TextField } from '../../../components/index.ts'
import { clearLocalSession, markLoginNotice } from '../session/index.ts'
import formStyles from '../shared/AuthForm.module.css'
import { applyFieldErrors, errorMessage } from '../shared/formErrors.ts'
import { deleteAccount, needsReauth } from './api.ts'
import styles from './Profile.module.css'
import { Section } from './Section.tsx'

const CONFIRMATION = 'ELIMINAR'
const MISMATCH = 'Escribe ELIMINAR para confirmar.'

const schema = z.object({
  confirmation: z.string().refine((value) => value.trim() === CONFIRMATION, MISMATCH),
})
type Values = z.infer<typeof schema>

interface DeleteAccountSectionProps {
  requireReauth: (onDone: () => void) => void
}

/** Eliminación inmediata y definitiva (RF-AUTH-16, RN-AUTH-07). */
export function DeleteAccountSection({ requireReauth }: DeleteAccountSectionProps) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { confirmation: '' },
  })
  const confirmationError = form.formState.errors.confirmation
  const remove = useMutation({
    mutationFn: (values: Values) => deleteAccount(values.confirmation.trim()),
    onSuccess: () => {
      markLoginNotice('account_deleted')
      clearLocalSession(client)
      void navigate('/iniciar-sesion', { replace: true })
    },
    onError: (error, values) => {
      // Tras confirmar la identidad se repite la eliminación ya confirmada.
      if (needsReauth(error))
        requireReauth(() => {
          remove.mutate(values)
        })
      else applyFieldErrors(error, form.setError, { confirmation: MISMATCH })
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    remove.mutate(values)
  })
  const showError = remove.isError && !needsReauth(remove.error) && !confirmationError

  return (
    <Section title="Eliminar cuenta">
      <Alert variant="warning" title="Esta acción no se puede deshacer">
        Borraremos de inmediato tu cuenta y todos tus datos personales y financieros, y cerraremos
        todas tus sesiones.
      </Alert>
      {showError && <Alert variant="error">{errorMessage(remove.error)}</Alert>}
      <form
        className={formStyles.form}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
      >
        <TextField
          label={`Escribe ${CONFIRMATION} para confirmar`}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          error={confirmationError?.message}
          {...form.register('confirmation')}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="danger" loading={remove.isPending}>
            Eliminar mi cuenta
          </Button>
        </div>
      </form>
    </Section>
  )
}
