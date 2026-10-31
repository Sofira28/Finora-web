import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'

import { Alert, Button, Dialog, MoneyField, TextField } from '../../components/index.ts'
import { ApiError } from '../../lib/api/index.ts'
import { applyFieldErrors, errorMessage } from '../auth/shared/formErrors.ts'
import {
  type AccountFormValues,
  accountFormSchema,
  createBody,
  emptyFormValues,
  formValuesFrom,
  SERVER_FIELDS,
  updateBody,
} from './accountForm.ts'
import { ACCOUNT_TYPES } from './accountTypes.ts'
import type { Account, AccountType } from './api.ts'
import styles from './Accounts.module.css'
import { ACCOUNT_MESSAGES as M } from './messages.ts'
import { useSaveAccount } from './useAccounts.ts'

const TYPE_ORDER: AccountType[] = ['bank', 'wallet', 'cash', 'savings', 'investment', 'credit_card']

// Mensajes para los errores de formato del backend, que llegan sin texto.
const FALLBACKS: Partial<Record<keyof AccountFormValues, string>> = {
  name: M.name,
  institution: M.institution,
  openingBalance: M.amount,
  creditLimit: M.creditLimit,
  statementDay: M.day,
  paymentDueDay: M.day,
}

export interface AccountFormDialogProps {
  /** Cuenta a editar; sin ella, el formulario crea una nueva. */
  account?: Account
  onClose: () => void
  onSaved: (account: Account) => void
  /** La cuenta ya no existe (`404`): quien abre el diálogo lo cierra y avisa. */
  onNotFound: () => void
  /** Con saldo bloqueado (VAL-ACC-07): abre "Ajustar saldo" en lugar de editarlo. */
  onAdjust?: (account: Account) => void
}

/** Alta y edición de cuentas (RF-ACC-01, 05 y 06). Se monta abierto. */
export function AccountFormDialog({
  account,
  onClose,
  onSaved,
  onNotFound,
  onAdjust,
}: AccountFormDialogProps) {
  const isEdit = account !== undefined
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: account ? formValuesFrom(account) : emptyFormValues(),
  })
  const save = useSaveAccount()
  const { errors } = form.formState
  const type = useWatch({ control: form.control, name: 'type' })
  const isCard = type === 'credit_card'
  const lockedBalance = account?.has_movements === true

  const onSubmit = form.handleSubmit((values) => {
    save.mutate(
      account
        ? { id: account.id, body: updateBody(values, account) }
        : { body: createBody(values) },
      {
        onSuccess: onSaved,
        onError: (error) => {
          if (error instanceof ApiError && error.status === 404) {
            onNotFound()
            return
          }
          if (error instanceof ApiError && error.code === 'account_name_taken') {
            form.setError(
              'name',
              { type: 'server', message: error.fieldMessage('name') ?? error.message },
              { shouldFocus: true },
            )
            return
          }
          const mapped = remapErrors(error)
          applyFieldErrors(mapped, form.setError, FALLBACKS)
        },
      },
    )
  })

  // Si el error del backend quedó en un campo, la alerta general sobra.
  const fieldError = Object.values(errors).some((e) => e.type === 'server')
  const typeLabel = ACCOUNT_TYPES[type].label

  return (
    <Dialog
      open
      title={isEdit ? `Editar ${account.name}` : 'Nueva cuenta'}
      description={
        isEdit ? undefined : 'Registra una cuenta, billetera, efectivo, ahorro o tarjeta.'
      }
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
      >
        {isEdit ? (
          <p className={styles.fixedType}>
            <span className={styles.fixedTypeLabel}>Tipo</span>
            {typeLabel}
            <span className={styles.fieldHint}>El tipo no se puede cambiar.</span>
          </p>
        ) : (
          <fieldset className={styles.types}>
            <legend className={styles.typesLegend}>Tipo de cuenta</legend>
            {TYPE_ORDER.map((value) => {
              const { label, icon: Icon } = ACCOUNT_TYPES[value]
              return (
                <label key={value} className={styles.typeOption}>
                  <input type="radio" value={value} {...form.register('type')} />
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </label>
              )
            })}
          </fieldset>
        )}

        <TextField
          label="Nombre"
          hint="Por ejemplo, Nómina o Tarjeta Visa. No escribas números de cuenta ni de tarjeta."
          autoComplete="off"
          maxLength={60}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label="Entidad (opcional)"
          hint="Banco o aplicación, p. ej. Bancolombia o Nequi."
          autoComplete="off"
          maxLength={60}
          error={errors.institution?.message}
          {...form.register('institution')}
        />
        <MoneyField
          label={isCard ? 'Deuda actual' : 'Saldo inicial'}
          hint={
            lockedBalance
              ? M.hasMovements
              : isCard
                ? 'Lo que debes hoy en la tarjeta. Ej.: 820.000'
                : 'Lo que tiene hoy la cuenta. Ej.: 1.250.000'
          }
          readOnly={lockedBalance}
          aria-readonly={lockedBalance || undefined}
          error={errors.openingBalance?.message}
          {...form.register('openingBalance')}
        />
        {lockedBalance && onAdjust && (
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                onAdjust(account)
              }}
            >
              Ajustar saldo
            </Button>
          </div>
        )}
        {isCard && (
          <>
            <MoneyField
              label="Cupo total"
              hint="Ej.: 6.000.000"
              error={errors.creditLimit?.message}
              {...form.register('creditLimit')}
            />
            <div className={styles.days}>
              <TextField
                label="Día de corte"
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                error={errors.statementDay?.message}
                {...form.register('statementDay')}
              />
              <TextField
                label="Día límite de pago"
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                error={errors.paymentDueDay?.message}
                {...form.register('paymentDueDay')}
              />
            </div>
          </>
        )}

        {save.isError && !fieldError && <Alert variant="error">{errorMessage(save.error)}</Alert>}

        <div className={styles.formActions}>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/**
 * Los errores del backend nombran los campos de la API (`opening_balance`); el formulario
 * usa los suyos (`openingBalance`).
 */
function remapErrors(error: unknown): unknown {
  if (!(error instanceof ApiError) || !error.problem.errors) return error
  const errors = error.problem.errors.map((fieldError) => {
    const field = fieldError.loc.at(-1)
    const mapped =
      typeof field === 'string' && field in SERVER_FIELDS
        ? SERVER_FIELDS[field as keyof typeof SERVER_FIELDS]
        : field
    return { ...fieldError, loc: [...fieldError.loc.slice(0, -1), mapped ?? ''] }
  })
  return new ApiError({ ...error.problem, errors })
}
