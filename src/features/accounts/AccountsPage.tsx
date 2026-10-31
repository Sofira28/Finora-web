import { useState } from 'react'

import { Alert, Button, ConfirmDialog, PageHeader } from '../../components/index.ts'
import { PlusIcon } from '../../components/icons/index.ts'
import { ApiError } from '../../lib/api/index.ts'
import { formatMoney } from '../../lib/format/index.ts'
import { errorMessage } from '../auth/shared/formErrors.ts'
import type { AccountHandlers } from './AccountActions.tsx'
import { AccountFormDialog } from './AccountFormDialog.tsx'
import { AccountGroup } from './AccountGroup.tsx'
import styles from './Accounts.module.css'
import { groupAccounts } from './accountTypes.ts'
import type { Account, AccountList } from './api.ts'
import { ArchivedSection } from './ArchivedSection.tsx'
import { CreditCardItem } from './CreditCardItem.tsx'
import { TransactionFormDialog } from '../transactions/TransactionFormDialog.tsx'
import { ACCOUNT_MESSAGES } from './messages.ts'
import { TotalsSummary } from './TotalsSummary.tsx'
import { useAccountAction, useAccounts } from './useAccounts.ts'

type FormState = { mode: 'create' } | { mode: 'edit'; account: Account } | null
type Notice = { variant: 'success' | 'error'; text: string } | null
// `blocked`: no se pudo eliminar porque tiene movimientos (VAL-ACC-08); se ofrece archivar.
type Confirmation = { kind: 'archive' | 'delete' | 'blocked'; account: Account } | null

/** Si el saldo es distinto de cero, sin convertirlo a número. */
function hasBalance(account: Account): boolean {
  return /[1-9]/.test(account.balance)
}

/** Cuentas y tarjetas (FEAT-ACC, RF-ACC-01 a 10). */
export function AccountsPage() {
  const accounts = useAccounts()
  const action = useAccountAction()
  const [formState, setFormState] = useState<FormState>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [adjusting, setAdjusting] = useState<Account | null>(null)

  const closeConfirmation = () => {
    setConfirmation(null)
    action.reset()
  }
  const notFound = () => {
    closeConfirmation()
    setNotice({ variant: 'error', text: ACCOUNT_MESSAGES.notFound })
  }

  const archive = (account: Account) => {
    action.mutate(
      { action: 'archive', account },
      {
        onSuccess: () => {
          closeConfirmation()
          setNotice({ variant: 'success', text: `Archivamos ${account.name}.` })
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 404) notFound()
        },
      },
    )
  }
  const remove = (account: Account) => {
    action.mutate(
      { action: 'delete', account },
      {
        onSuccess: () => {
          closeConfirmation()
          setNotice({ variant: 'success', text: `Eliminamos ${account.name}.` })
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 404) notFound()
          // Ya archivada: el mensaje queda como error en el diálogo de eliminar.
          else if (
            error instanceof ApiError &&
            error.code === 'account_has_movements' &&
            !account.archived
          ) {
            action.reset()
            setConfirmation({ kind: 'blocked', account })
          }
        },
      },
    )
  }

  const openCreate = () => {
    setNotice(null)
    setFormState({ mode: 'create' })
  }
  const handlers: AccountHandlers = {
    edit: (account) => {
      setNotice(null)
      setFormState({ mode: 'edit', account })
    },
    adjust: (account) => {
      setNotice(null)
      setAdjusting(account)
    },
    archive: (account) => {
      setNotice(null)
      setConfirmation({ kind: 'archive', account })
    },
    restore: (account) => {
      setNotice(null)
      // Reactivar no pierde nada: no se pide confirmación.
      action.mutate(
        { action: 'restore', account },
        {
          onSuccess: () => {
            setNotice({ variant: 'success', text: `Reactivamos ${account.name}.` })
          },
          onError: (error) => {
            setNotice({
              variant: 'error',
              text:
                error instanceof ApiError && error.status === 404
                  ? ACCOUNT_MESSAGES.notFound
                  : errorMessage(error),
            })
          },
        },
      )
    },
    remove: (account) => {
      setNotice(null)
      setConfirmation({ kind: 'delete', account })
    },
  }

  return (
    <>
      <PageHeader
        title="Cuentas y tarjetas"
        description="Saldos registrados de tus cuentas, billeteras y tarjetas."
        actions={
          accounts.isSuccess && (
            <Button variant="secondary" onClick={openCreate}>
              <PlusIcon />
              Nueva cuenta
            </Button>
          )
        }
      />
      {notice && (
        <div className={styles.notice}>
          <Alert variant={notice.variant}>{notice.text}</Alert>
        </div>
      )}
      {accounts.isPending ? (
        <div className={styles.page} role="status" aria-live="polite">
          <span className="visually-hidden">Cargando tus cuentas…</span>
          <div className={styles.skeleton} data-size="summary" aria-hidden="true" />
          <div className={styles.skeleton} aria-hidden="true" />
        </div>
      ) : accounts.isError ? (
        <div className={styles.page}>
          <Alert variant="error" title="No pudimos cargar tus cuentas.">
            {accounts.error.message}
          </Alert>
          <div>
            <Button
              variant="secondary"
              loading={accounts.isFetching}
              onClick={() => {
                void accounts.refetch()
              }}
            >
              Reintentar
            </Button>
          </div>
        </div>
      ) : (
        <AccountsContent data={accounts.data} onCreate={openCreate} handlers={handlers} />
      )}
      {confirmation && (
        <AccountConfirmation
          confirmation={confirmation}
          loading={action.isPending}
          error={action.isError ? errorMessage(action.error) : undefined}
          onArchive={archive}
          onDelete={remove}
          onClose={closeConfirmation}
        />
      )}
      {formState && (
        <AccountFormDialog
          account={formState.mode === 'edit' ? formState.account : undefined}
          onClose={() => {
            setFormState(null)
          }}
          onSaved={(saved) => {
            setFormState(null)
            setNotice({
              variant: 'success',
              text:
                formState.mode === 'create'
                  ? `Creamos la cuenta ${saved.name}.`
                  : `Guardamos los cambios de ${saved.name}.`,
            })
          }}
          onNotFound={() => {
            setFormState(null)
            setNotice({ variant: 'error', text: ACCOUNT_MESSAGES.notFound })
          }}
          onAdjust={(account) => {
            setFormState(null)
            setAdjusting(account)
          }}
        />
      )}
      {adjusting && accounts.data && (
        <TransactionFormDialog
          accounts={accounts.data.accounts}
          defaults={{ type: 'adjustment', accountId: adjusting.id }}
          title={`Ajustar saldo de ${adjusting.name}`}
          description="Escribe el saldo real; guardamos la diferencia como un ajuste de saldo."
          onClose={() => {
            setAdjusting(null)
          }}
          onSaved={() => {
            setNotice({ variant: 'success', text: `Ajustamos el saldo de ${adjusting.name}.` })
            setAdjusting(null)
          }}
          // Un movimiento nuevo no responde 404; se cierra por si acaso.
          onNotFound={() => {
            setAdjusting(null)
          }}
        />
      )}
    </>
  )
}

interface AccountsContentProps {
  data: AccountList
  onCreate: () => void
  handlers: AccountHandlers
}

function AccountsContent({ data, onCreate, handlers }: AccountsContentProps) {
  const groups = groupAccounts(data.accounts)
  const hasActive = groups.liquid.length + groups.savings.length + groups.cards.length > 0

  return (
    <div className={styles.page}>
      <TotalsSummary totals={data.totals} />
      {!hasActive && (
        <section className={styles.empty} aria-labelledby="sin-cuentas">
          <h2 id="sin-cuentas" className={styles.groupTitle}>
            Aún no tienes cuentas activas
          </h2>
          <p className={styles.groupDescription}>
            Registra tus cuentas bancarias, billeteras, efectivo, ahorros, inversiones y tarjetas
            para ver tu saldo disponible y tu patrimonio neto.
          </p>
          <div>
            <Button onClick={onCreate}>
              <PlusIcon />
              Crear mi primera cuenta
            </Button>
          </div>
        </section>
      )}
      {groups.cards.length > 0 && (
        <section aria-labelledby="tarjetas-titulo">
          <h2 id="tarjetas-titulo" className={styles.sectionTitle}>
            Tarjetas de crédito
          </h2>
          <ul className={styles.cards}>
            {groups.cards.map((account) => (
              <CreditCardItem key={account.id} account={account} handlers={handlers} />
            ))}
          </ul>
        </section>
      )}
      <div className={styles.groups}>
        <AccountGroup
          title="Cuentas y efectivo"
          description="Forman tu saldo disponible"
          accounts={groups.liquid}
          handlers={handlers}
        />
        <AccountGroup
          title="Ahorro e inversión"
          description="Cuentan en tu patrimonio, no en el disponible"
          accounts={groups.savings}
          tone="pos"
          handlers={handlers}
        />
      </div>
      <ArchivedSection accounts={groups.archived} handlers={handlers} />
    </div>
  )
}

interface AccountConfirmationProps {
  confirmation: NonNullable<Confirmation>
  loading: boolean
  error?: string
  onArchive: (account: Account) => void
  onDelete: (account: Account) => void
  onClose: () => void
}

/** Confirmaciones de archivar (CA-ACC-04) y eliminar (CA-ACC-05, VAL-ACC-08). */
function AccountConfirmation({
  confirmation: { kind, account },
  loading,
  error,
  onArchive,
  onDelete,
  onClose,
}: AccountConfirmationProps) {
  const common = { open: true, loading, error, onClose }

  if (kind === 'delete') {
    return (
      <ConfirmDialog
        {...common}
        title={`¿Eliminar ${account.name}?`}
        description="La cuenta se borrará definitivamente. Esta acción no se puede deshacer."
        confirmLabel="Eliminar cuenta"
        variant="danger"
        onConfirm={() => {
          onDelete(account)
        }}
      />
    )
  }

  // Archivar, o la alternativa cuando no se puede eliminar.
  const blocked = kind === 'blocked'
  return (
    <ConfirmDialog
      {...common}
      title={blocked ? `No podemos eliminar ${account.name}` : `¿Archivar ${account.name}?`}
      description={
        blocked
          ? ACCOUNT_MESSAGES.deleteHasMovements
          : 'Dejará de aparecer en tus cuentas y en tus totales. Su historial se conserva y puedes reactivarla cuando quieras.'
      }
      confirmLabel="Archivar cuenta"
      cancelLabel={blocked ? 'Ahora no' : 'Cancelar'}
      onConfirm={() => {
        onArchive(account)
      }}
    >
      {hasBalance(account) && !account.archived && (
        <Alert variant="warning">
          {account.type === 'credit_card'
            ? `Esta tarjeta tiene un saldo de ${formatMoney(account.balance, 'COP')}. `
            : `Esta cuenta tiene un saldo de ${formatMoney(account.balance, 'COP')}. `}
          Al archivarla, deja de contar en tus totales.
        </Alert>
      )}
    </ConfirmDialog>
  )
}
