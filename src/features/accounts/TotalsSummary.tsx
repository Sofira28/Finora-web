import { formatMoney } from '../../lib/format/index.ts'
import type { Totals } from './api.ts'
import styles from './Accounts.module.css'

/**
 * Totales calculados por el backend (RF-ACC-04). Saldo disponible y patrimonio neto van
 * siempre por separado, con su nombre y su explicación (RN-ACC-06).
 */
export function TotalsSummary({ totals }: { totals: Totals }) {
  return (
    <section className={styles.summary} aria-labelledby="totales-titulo">
      <h2 id="totales-titulo" className="visually-hidden">
        Resumen
      </h2>
      <dl className={styles.totals}>
        <div className={styles.total}>
          <dt className={styles.totalLabel}>Saldo disponible</dt>
          <dd className={styles.totalValue}>
            <span className={styles.totalPrimary}>
              {formatMoney(totals.available_balance, 'COP')}
            </span>
            <span className={styles.totalHint}>
              Cuentas bancarias, billeteras y efectivo. No incluye ahorro, inversión ni el cupo de
              tus tarjetas.
            </span>
          </dd>
        </div>
        <div className={styles.total}>
          <dt className={styles.totalLabel}>Patrimonio neto</dt>
          <dd className={styles.totalValue}>
            <span className={styles.totalAmount}>{formatMoney(totals.net_worth, 'COP')}</span>
            <span className={styles.totalHint}>
              Todo lo que tienes, incluidos ahorro e inversión, menos la deuda de tus tarjetas.
            </span>
          </dd>
        </div>
        <div className={styles.total}>
          <dt className={styles.totalLabel}>Deuda en tarjetas</dt>
          <dd className={styles.totalValue}>
            <span className={styles.totalAmount}>
              {formatMoney(totals.credit_card_debt, 'COP')}
            </span>
            <span className={styles.totalHint}>Lo que debes hoy en tus tarjetas de crédito.</span>
          </dd>
        </div>
      </dl>
      <p className={styles.note}>
        Saldos registrados en FINORA. No están sincronizados con ningún banco.
      </p>
    </section>
  )
}
