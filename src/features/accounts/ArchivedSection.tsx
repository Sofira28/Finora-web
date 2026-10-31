import type { Account } from './api.ts'
import { AccountItem } from './AccountItem.tsx'
import styles from './Accounts.module.css'

/** Cuentas archivadas (RF-ACC-08): plegadas por defecto; no cuentan en los totales. */
export function ArchivedSection({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) return null
  return (
    <section className={styles.group} aria-label="Cuentas archivadas">
      <details className={styles.archived}>
        <summary className={styles.archivedSummary}>
          Archivadas ({accounts.length})
          <span className={styles.groupDescription}>No cuentan en tus totales</span>
        </summary>
        <ul className={styles.list}>
          {accounts.map((account) => (
            <AccountItem key={account.id} account={account} />
          ))}
        </ul>
      </details>
    </section>
  )
}
