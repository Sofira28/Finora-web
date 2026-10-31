import { useState } from 'react'

import { Alert, Button, PageHeader } from '../../components/index.ts'
import { PlusIcon } from '../../components/icons/index.ts'
import { AccountFormDialog } from './AccountFormDialog.tsx'
import { AccountGroup } from './AccountGroup.tsx'
import styles from './Accounts.module.css'
import { groupAccounts } from './accountTypes.ts'
import type { Account, AccountList } from './api.ts'
import { ArchivedSection } from './ArchivedSection.tsx'
import { CreditCardItem } from './CreditCardItem.tsx'
import { ACCOUNT_MESSAGES } from './messages.ts'
import { TotalsSummary } from './TotalsSummary.tsx'
import { useAccounts } from './useAccounts.ts'

type FormState = { mode: 'create' } | { mode: 'edit'; account: Account } | null
type Notice = { variant: 'success' | 'error'; text: string } | null

/** Cuentas y tarjetas (FEAT-ACC, RF-ACC-01 a 06, 08 y 10). */
export function AccountsPage() {
  const accounts = useAccounts()
  const [formState, setFormState] = useState<FormState>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const openCreate = () => {
    setNotice(null)
    setFormState({ mode: 'create' })
  }
  const openEdit = (account: Account) => {
    setNotice(null)
    setFormState({ mode: 'edit', account })
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
        <AccountsContent data={accounts.data} onCreate={openCreate} onEdit={openEdit} />
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
        />
      )}
    </>
  )
}

interface AccountsContentProps {
  data: AccountList
  onCreate: () => void
  onEdit: (account: Account) => void
}

function AccountsContent({ data, onCreate, onEdit }: AccountsContentProps) {
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
              <CreditCardItem key={account.id} account={account} onEdit={onEdit} />
            ))}
          </ul>
        </section>
      )}
      <div className={styles.groups}>
        <AccountGroup
          title="Cuentas y efectivo"
          description="Forman tu saldo disponible"
          accounts={groups.liquid}
          onEdit={onEdit}
        />
        <AccountGroup
          title="Ahorro e inversión"
          description="Cuentan en tu patrimonio, no en el disponible"
          accounts={groups.savings}
          tone="pos"
          onEdit={onEdit}
        />
      </div>
      <ArchivedSection accounts={groups.archived} />
    </div>
  )
}
