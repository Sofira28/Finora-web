import { formatMoney } from '../../lib/format/index.ts'
import { AccountActions, type AccountHandlers } from './AccountActions.tsx'
import { ACCOUNT_TYPES } from './accountTypes.ts'
import type { Account } from './api.ts'
import styles from './Accounts.module.css'

interface AccountItemProps {
  account: Account
  handlers: AccountHandlers
  tone?: 'lav' | 'pos'
}

/** Fila de una cuenta: ícono del tipo, nombre, tipo, entidad, saldo actual y acciones. */
export function AccountItem({ account, handlers, tone = 'lav' }: AccountItemProps) {
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
      <AccountActions account={account} handlers={handlers} />
    </li>
  )
}
