import { EditIcon } from '../../components/icons/index.ts'
import { formatMoney } from '../../lib/format/index.ts'
import { ACCOUNT_TYPES } from './accountTypes.ts'
import type { Account } from './api.ts'
import styles from './Accounts.module.css'

interface AccountItemProps {
  account: Account
  tone?: 'lav' | 'pos'
  onEdit?: (account: Account) => void
}

/** Fila de una cuenta: ícono del tipo, nombre, tipo, entidad, saldo actual y acciones. */
export function AccountItem({ account, tone = 'lav', onEdit }: AccountItemProps) {
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
      {onEdit && (
        <span className={styles.itemActions}>
          <EditButton account={account} onEdit={onEdit} />
        </span>
      )}
    </li>
  )
}

/** Botón de solo ícono; su nombre accesible incluye la cuenta ("Editar Nómina"). */
export function EditButton({
  account,
  onEdit,
}: {
  account: Account
  onEdit: (account: Account) => void
}) {
  const label = `Editar ${account.name}`
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      onClick={() => {
        onEdit(account)
      }}
    >
      <EditIcon />
    </button>
  )
}
