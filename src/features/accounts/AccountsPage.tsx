import { Alert, Button, PageHeader } from '../../components/index.ts'
import { groupAccounts } from './accountTypes.ts'
import type { AccountList } from './api.ts'
import { AccountGroup } from './AccountGroup.tsx'
import { ArchivedSection } from './ArchivedSection.tsx'
import styles from './Accounts.module.css'
import { CreditCardItem } from './CreditCardItem.tsx'
import { TotalsSummary } from './TotalsSummary.tsx'
import { useAccounts } from './useAccounts.ts'

/** Cuentas y tarjetas (FEAT-ACC, RF-ACC-02 a 04, 08 y 10). */
export function AccountsPage() {
  const accounts = useAccounts()

  return (
    <>
      <PageHeader
        title="Cuentas y tarjetas"
        description="Saldos registrados de tus cuentas, billeteras y tarjetas."
      />
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
        <AccountsContent data={accounts.data} />
      )}
    </>
  )
}

function AccountsContent({ data }: { data: AccountList }) {
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
        </section>
      )}
      {groups.cards.length > 0 && (
        <section aria-labelledby="tarjetas-titulo">
          <h2 id="tarjetas-titulo" className={styles.sectionTitle}>
            Tarjetas de crédito
          </h2>
          <ul className={styles.cards}>
            {groups.cards.map((account) => (
              <CreditCardItem key={account.id} account={account} />
            ))}
          </ul>
        </section>
      )}
      <div className={styles.groups}>
        <AccountGroup
          title="Cuentas y efectivo"
          description="Forman tu saldo disponible"
          accounts={groups.liquid}
        />
        <AccountGroup
          title="Ahorro e inversión"
          description="Cuentan en tu patrimonio, no en el disponible"
          accounts={groups.savings}
          tone="pos"
        />
      </div>
      <ArchivedSection accounts={groups.archived} />
    </div>
  )
}
