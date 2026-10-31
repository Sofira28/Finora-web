import { useId } from 'react'

import type { Account } from './api.ts'
import { AccountItem } from './AccountItem.tsx'
import styles from './Accounts.module.css'

interface AccountGroupProps {
  title: string
  /** Qué significa el grupo para los totales. */
  description: string
  accounts: Account[]
  tone?: 'lav' | 'pos'
  onEdit: (account: Account) => void
}

/** Grupo de cuentas (RF-ACC-02); no se muestra si está vacío. */
export function AccountGroup({ title, description, accounts, tone, onEdit }: AccountGroupProps) {
  const titleId = useId()
  if (accounts.length === 0) return null
  return (
    <section className={styles.group} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.groupTitle}>
        {title}
      </h2>
      <p className={styles.groupDescription}>{description}</p>
      <ul className={styles.list}>
        {accounts.map((account) => (
          <AccountItem key={account.id} account={account} tone={tone} onEdit={onEdit} />
        ))}
      </ul>
    </section>
  )
}
