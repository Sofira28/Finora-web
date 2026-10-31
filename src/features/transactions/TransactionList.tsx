import { ActionsMenu } from '../../components/index.ts'
import { EditIcon } from '../../components/icons/index.ts'
import { formatDate } from '../../lib/format/index.ts'
import { useMediaQuery } from '../../lib/hooks/useMediaQuery.ts'
import type { Sort, Transaction } from './api.ts'
import {
  TRANSACTION_TYPES,
  transactionAmount,
  transactionCategory,
  transactionDescription,
} from './transactionDisplay.ts'
import styles from './Transactions.module.css'

// Rangos del diseño: móvil < 768 px (lista), tablet (tabla sin columna de cuenta) y escritorio.
const TABLE = '(min-width: 768px)'
const WIDE = '(min-width: 1200px)'

interface TransactionListProps {
  transactions: Transaction[]
  accountName: (id: string) => string
  sort: Sort
  onSort: (sort: Sort) => void
  onEdit: (transaction: Transaction) => void
}

/** Lista de movimientos (RF-TRX-04): tabla en tablet y escritorio, lista en móvil. */
export function TransactionList({
  transactions,
  accountName,
  sort,
  onSort,
  onEdit,
}: TransactionListProps) {
  const isTable = useMediaQuery(TABLE)
  const isWide = useMediaQuery(WIDE)
  const rows = transactions.map((transaction) => toRow(transaction, accountName))
  const actions = (row: Row) => (
    <ActionsMenu
      label={`Acciones de ${row.description}, ${row.date}`}
      items={[
        {
          label: 'Editar',
          icon: EditIcon,
          onSelect: () => {
            onEdit(row.transaction)
          },
        },
      ]}
    />
  )

  if (!isTable) {
    return (
      <ul className={styles.cards} aria-label="Movimientos">
        {rows.map((row) => (
          <li key={row.id} className={styles.card}>
            <TypeIcon row={row} />
            <span className={styles.cardText}>
              <span className={styles.description}>{row.description}</span>
              <span className={styles.cardDetails}>
                {row.category && <CategoryDot color={row.category.color} />}
                {[row.category?.label, row.date].filter(Boolean).join(' · ')}
              </span>
              <span className={styles.cardDetails}>
                <AccountText row={row} />
              </span>
            </span>
            <AmountText row={row} />
            {actions(row)}
          </li>
        ))}
      </ul>
    )
  }

  const [sortKey, direction] = sort.split('_') as ['date' | 'amount', 'asc' | 'desc']
  const ariaSort = (key: 'date' | 'amount') =>
    sortKey === key ? (direction === 'asc' ? 'ascending' : 'descending') : undefined
  const toggle = (key: 'date' | 'amount') => {
    onSort(sortKey === key && direction === 'desc' ? `${key}_asc` : `${key}_desc`)
  }

  return (
    <div className={styles.tableCard}>
      <table className={styles.table} data-wide={isWide || undefined}>
        <caption className="visually-hidden">Movimientos</caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort('date')} className={styles.colDate}>
              <SortButton
                label="Fecha"
                active={sortKey === 'date'}
                direction={direction}
                onClick={() => {
                  toggle('date')
                }}
              />
            </th>
            <th scope="col">Descripción</th>
            <th scope="col">Categoría</th>
            {isWide && <th scope="col">Cuenta</th>}
            <th scope="col" aria-sort={ariaSort('amount')} className={styles.colAmount}>
              <SortButton
                label="Monto"
                active={sortKey === 'amount'}
                direction={direction}
                onClick={() => {
                  toggle('amount')
                }}
              />
            </th>
            <th scope="col" className={styles.colActions}>
              <span className="visually-hidden">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={styles.colDate}>{row.date}</td>
              <td>
                <span className={styles.descriptionCell}>
                  <TypeIcon row={row} />
                  <span className={styles.cardText}>
                    <span className={styles.description}>{row.description}</span>
                    {!isWide && (
                      <span className={styles.cardDetails}>
                        <AccountText row={row} />
                      </span>
                    )}
                  </span>
                </span>
              </td>
              <td>
                {row.category ? (
                  <span className={styles.category}>
                    <CategoryDot color={row.category.color} />
                    {row.category.label}
                  </span>
                ) : (
                  <span className={styles.muted}>
                    <span aria-hidden="true">—</span>
                    <span className="visually-hidden">No aplica</span>
                  </span>
                )}
              </td>
              {isWide && (
                <td className={styles.accountCell}>
                  <AccountText row={row} />
                </td>
              )}
              <td className={styles.colAmount}>
                <AmountText row={row} />
              </td>
              <td className={styles.colActions}>{actions(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Row {
  id: string
  transaction: Transaction
  type: Transaction['type']
  date: string
  description: string
  category: ReturnType<typeof transactionCategory>
  account: string
  destination: string | null
  amount: string
}

function toRow(transaction: Transaction, accountName: (id: string) => string): Row {
  return {
    id: transaction.id,
    transaction,
    type: transaction.type,
    date: formatDate(transaction.date),
    description: transactionDescription(transaction, accountName),
    category: transactionCategory(transaction),
    account: accountName(transaction.account_id),
    destination: transaction.destination_account_id
      ? accountName(transaction.destination_account_id)
      : null,
    amount: transactionAmount(transaction),
  }
}

function TypeIcon({ row }: { row: Row }) {
  const { icon: Icon, tone } = TRANSACTION_TYPES[row.type]
  return (
    <span className={styles.typeIcon} data-tone={tone} aria-hidden="true">
      <Icon />
    </span>
  )
}

function CategoryDot({ color }: { color: string }) {
  return <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
}

/** Cuenta, o "origen → destino" en transferencias (la flecha se lee como "a"). */
function AccountText({ row }: { row: Row }) {
  if (!row.destination) return <>{row.account}</>
  return (
    <>
      {row.account} <span aria-hidden="true">→</span>
      <span className="visually-hidden">a</span> {row.destination}
    </>
  )
}

/** Monto con signo y, debajo, el tipo en texto (RNF-TRX-04: nunca solo con color). */
function AmountText({ row }: { row: Row }) {
  return (
    <span className={styles.amount}>
      <span className={styles.amountValue} data-type={row.type}>
        {row.amount}
      </span>
      <span className={styles.amountType}>{TRANSACTION_TYPES[row.type].label}</span>
    </span>
  )
}

interface SortButtonProps {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onClick: () => void
}

function SortButton({ label, active, direction, onClick }: SortButtonProps) {
  return (
    <button type="button" className={styles.sortButton} onClick={onClick}>
      {label}
      <span aria-hidden="true" className={styles.sortArrow}>
        {active ? (direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  )
}
