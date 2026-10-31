import { formatMoney } from '../../lib/format/index.ts'
import type { TransactionSummary as Summary } from './api.ts'
import { formatSigned } from './transactionDisplay.ts'
import styles from './Transactions.module.css'

/**
 * Resumen calculado por el backend sobre todos los movimientos del filtro (RF-TRX-06,
 * RN-TRX-05). Las transferencias van aparte: no suman como gasto.
 */
export function TransactionSummary({ summary }: { summary: Summary }) {
  return (
    <div className={styles.summary} role="status">
      <strong className={styles.summaryCount}>
        {summary.count === 1
          ? '1 movimiento'
          : `${summary.count.toLocaleString('es-CO')} movimientos`}
      </strong>
      <span>
        Ingresos{' '}
        <strong className={styles.summaryIncome}>+ {formatMoney(summary.income, 'COP')}</strong>
      </span>
      <span>
        Gastos <strong>− {formatMoney(summary.expense, 'COP')}</strong>
      </span>
      <span>
        Ahorro neto <strong>{formatSigned(summary.savings)}</strong>
      </span>
      <span>
        Transferencias <strong>{formatMoney(summary.transfers, 'COP')}</strong> · no suman como
        gasto
      </span>
    </div>
  )
}
