import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'

import { Alert, Button, Dialog, MoneyField, TextField } from '../../components/index.ts'
import { InfoIcon } from '../../components/icons/index.ts'
import { ApiError } from '../../lib/api/index.ts'
import { formatMoney } from '../../lib/format/index.ts'
import type { Account } from '../accounts/api.ts'
import { applyFieldErrors, errorMessage } from '../auth/shared/formErrors.ts'
import type { Category, Transaction, TransactionType } from './api.ts'
import { CATEGORIES, CATEGORIES_BY_TYPE, isCategoryAllowed } from './categories.ts'
import { SelectField, TextAreaField } from './FormFields.tsx'
import { TRANSACTION_MESSAGES as M } from './messages.ts'
import { todayInColombia } from './periods.ts'
import {
  DESCRIPTION_MAX,
  emptyFormValues,
  formValuesFrom,
  MIN_DATE,
  type NewTransactionDefaults,
  NOTE_MAX,
  selectableAccounts,
  SERVER_FIELDS,
  transactionBody,
  transactionFormSchema,
  type TransactionFormValues,
} from './transactionForm.ts'
import { TRANSACTION_TYPES } from './transactionDisplay.ts'
import styles from './TransactionForm.module.css'
import { useSaveTransaction } from './useTransactions.ts'

const TYPE_ORDER: TransactionType[] = ['expense', 'income', 'transfer', 'adjustment']

// Mensajes para los errores de formato del backend, que llegan sin texto.
const FALLBACKS: Partial<Record<keyof TransactionFormValues, string>> = {
  amount: M.amount,
  targetBalance: M.targetBalance,
  date: M.date,
  accountId: M.account,
  destinationAccountId: M.destination,
  category: M.category,
  description: M.description,
  note: M.note,
}

export interface TransactionFormDialogProps {
  /** Todas las cuentas del usuario (de `GET /accounts`), con su saldo actual. */
  accounts: readonly Account[]
  /** Movimiento a editar; sin él, el formulario registra uno nuevo. */
  transaction?: Transaction
  /** Tipo y cuenta iniciales de un movimiento nuevo (p. ej. "Ajustar saldo" desde Cuentas). */
  defaults?: NewTransactionDefaults
  /** Título y descripción propios (p. ej. "Ajustar saldo de Nómina"). */
  title?: string
  description?: string
  onClose: () => void
  onSaved: (transaction: Transaction) => void
  /** El movimiento ya no existe (`404`): quien abre el diálogo lo cierra y avisa. */
  onNotFound: () => void
}

/** Registro y edición de movimientos (RF-TRX-01 a 03 y 07). Se monta abierto. */
export function TransactionFormDialog({
  accounts,
  transaction,
  defaults,
  title: customTitle,
  description: customDescription,
  onClose,
  onSaved,
  onNotFound,
}: TransactionFormDialogProps) {
  const isEdit = transaction !== undefined
  // "Hoy" se fija al abrir; si pasa la medianoche con el diálogo abierto, el backend decide.
  const [today] = useState(todayInColombia)
  const options = selectableAccounts(accounts, transaction)
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema(today)),
    defaultValues: transaction
      ? formValuesFrom(transaction, accounts)
      : emptyFormValues(today, {
          ...defaults,
          // Con una sola cuenta, ya queda elegida.
          accountId: defaults?.accountId ?? (options.length === 1 ? options[0]?.id : undefined),
        }),
  })
  const save = useSaveTransaction()
  const { errors } = form.formState
  const type = useWatch({ control: form.control, name: 'type' })
  const accountId = useWatch({ control: form.control, name: 'accountId' })
  const account = accounts.find((item) => item.id === accountId)
  const categorized = type === 'expense' || type === 'income'

  const title = customTitle ?? (isEdit ? 'Editar movimiento' : 'Nuevo movimiento')

  if (options.length === 0) {
    return (
      <Dialog open title={title} onClose={onClose}>
        <div className={styles.form}>
          <Alert variant="info">
            Para registrar movimientos necesitas al menos una cuenta activa.{' '}
            <Link to="/cuentas">Ir a Cuentas</Link>
          </Alert>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>
    )
  }

  const onSubmit = form.handleSubmit((values) => {
    save.mutate(
      { id: transaction?.id, body: transactionBody(values) },
      {
        onSuccess: onSaved,
        onError: (error) => {
          if (error instanceof ApiError && error.status === 404) {
            onNotFound()
            return
          }
          applyFieldErrors(remapErrors(error), form.setError, FALLBACKS)
        },
      },
    )
  })

  // Si el error del backend quedó en un campo, la alerta general sobra.
  const fieldError = Object.values(errors).some((e) => e.type === 'server')
  const isCard = account?.type === 'credit_card'
  const accountOption = (item: Account) => (
    <option key={item.id} value={item.id}>
      {item.archived ? `${item.name} (archivada)` : item.name}
    </option>
  )

  return (
    <Dialog
      open
      title={title}
      description={
        customDescription ??
        (isEdit ? undefined : 'Registra un gasto, un ingreso, una transferencia o un ajuste.')
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
        <fieldset className={styles.types}>
          <legend className={styles.legend}>Tipo de movimiento</legend>
          {TYPE_ORDER.map((value) => (
            <label key={value} className={styles.typeOption}>
              <input
                type="radio"
                value={value}
                {...form.register('type', {
                  onChange: () => {
                    // Una categoría que no corresponde al nuevo tipo se quita.
                    const category = form.getValues('category')
                    if (category && !isCategoryAllowed(value, category)) {
                      form.setValue('category', '')
                    }
                  },
                })}
              />
              <span>{TRANSACTION_TYPES[value].label}</span>
            </label>
          ))}
        </fieldset>

        {type === 'transfer' && (
          <p className={styles.info}>
            <InfoIcon />
            <span>{M.transferInfo}</span>
          </p>
        )}

        {type !== 'adjustment' && (
          <MoneyField
            label="Monto"
            hint="Ej.: 1.250.000"
            inputClassName={styles.amountInput}
            error={errors.amount?.message}
            {...form.register('amount')}
          />
        )}

        <div className={styles.row}>
          <TextField
            label="Fecha"
            type="date"
            min={MIN_DATE}
            max={today}
            error={errors.date?.message}
            {...form.register('date')}
          />
          <SelectField
            label={type === 'transfer' ? 'Cuenta de origen' : 'Cuenta'}
            error={errors.accountId?.message}
            {...form.register('accountId')}
          >
            <option value="">Elige una cuenta</option>
            {options.map(accountOption)}
          </SelectField>
          {type === 'transfer' && (
            <SelectField
              label="Cuenta de destino"
              error={errors.destinationAccountId?.message}
              {...form.register('destinationAccountId')}
            >
              <option value="">Elige una cuenta</option>
              {options.filter((item) => item.id !== accountId).map(accountOption)}
            </SelectField>
          )}
          {categorized && (
            <SelectField
              label="Categoría"
              error={errors.category?.message}
              {...form.register('category')}
            >
              <option value="">Elige una categoría</option>
              {CATEGORIES_BY_TYPE[type].map((key: Category) => (
                <option key={key} value={key}>
                  {CATEGORIES[key].label}
                </option>
              ))}
            </SelectField>
          )}
        </div>

        {type === 'adjustment' && (
          <MoneyField
            label={isCard ? 'Deuda real de la tarjeta' : 'Saldo real de la cuenta'}
            hint={
              account
                ? `${isCard ? 'Deuda' : 'Saldo'} actual en FINORA: ${formatMoney(account.balance, 'COP')}. Guardamos la diferencia como ajuste; no cuenta como ingreso ni gasto.`
                : 'Elige la cuenta para ver su saldo actual.'
            }
            inputClassName={styles.amountInput}
            error={errors.targetBalance?.message}
            {...form.register('targetBalance')}
          />
        )}

        <TextField
          label={categorized ? 'Descripción' : 'Descripción (opcional)'}
          hint={categorized ? 'Por ejemplo, Mercado de la semana.' : undefined}
          autoComplete="off"
          maxLength={DESCRIPTION_MAX}
          error={errors.description?.message}
          {...form.register('description')}
        />
        <TextAreaField
          label="Nota (opcional)"
          rows={2}
          maxLength={NOTE_MAX}
          error={errors.note?.message}
          {...form.register('note')}
        />

        {save.isError && !fieldError && <Alert variant="error">{errorMessage(save.error)}</Alert>}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Guardar cambios' : 'Guardar movimiento'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Los errores del backend nombran los campos de la API (`account_id`); el formulario, los suyos. */
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
