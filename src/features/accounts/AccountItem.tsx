import { formatMoney } from '../../lib/format/index.ts'
import { ACCOUNT_TYPES } from './accountTypes.ts'
import type { Account } from './api.ts'
import styles from './Accounts.module.css'

/** Fila de una cuenta: ícono del tipo, nombre, tipo, entidad y saldo actual. */
export function AccountItem({ account, tone = 'lav' }: { account: Account; tone?: 'lav' | 'pos' }) {
  const { label, icon: Icon } = ACCOUNT_TYPES[account.type]
  const details = [label, account.institution].filter(Boolean).join(' · ')
  return (
    <li className={styles.item}>
      <span className={styles.itemIcon} data-tone={tone} aria-hidden="true">
        <Icon />
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemName}>{account.name}</span>
        <span className={styles.itemDetails}>{details}</span>
      </span>
      <span className={styles.itemBalance}>
        <span className="visually-hidden">Saldo: </span>
        {formatMoney(account.balance, 'COP')}
      </span>
    </li>
  )
}
