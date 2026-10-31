import { WarningIcon } from '../../components/icons/index.ts'
import { formatMoney } from '../../lib/format/index.ts'
import type { Account } from './api.ts'
import styles from './Accounts.module.css'

/**
 * Tarjeta de crédito (RF-ACC-03): deuda, cupo, cupo disponible, uso del cupo y días de corte
 * y pago. Los cálculos llegan del backend; aquí solo se muestran.
 */
export function CreditCardItem({ account }: { account: Account }) {
  const card = account.credit_card
  if (!card) return null
  // Deuda negativa = saldo a favor (casos borde de la spec §11). Solo se mira el signo.
  const inFavor = account.balance.startsWith('-')
  const usage = card.usage_percent
  const usageText = `${String(usage)} % del cupo usado`

  return (
    <li className={styles.card}>
      <div className={styles.cardVisual} aria-hidden="true">
        <span className={styles.cardBrand}>FINORA</span>
        <span className={styles.cardKind}>Crédito</span>
        <span className={styles.cardNumber}>•••• •••• •••• ••••</span>
        <span className={styles.cardName}>{account.name}</span>
      </div>
      <div className={styles.cardBody}>
        <div>
          <h3 className={styles.cardTitle}>{account.name}</h3>
          {account.institution && <p className={styles.itemDetails}>{account.institution}</p>}
        </div>
        <div>
          <p className={styles.cardLabel}>{inFavor ? 'Saldo a favor' : 'Deuda pendiente'}</p>
          <p className={styles.cardDebt}>
            {formatMoney(inFavor ? account.balance.slice(1) : account.balance, 'COP')}
          </p>
        </div>
        <div>
          <div
            className={styles.usageTrack}
            role="progressbar"
            aria-label={`Uso del cupo de ${account.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(usage, 100)}
            aria-valuetext={usageText}
          >
            <div
              className={styles.usageBar}
              data-over={card.over_limit || undefined}
              style={{ width: `${String(Math.min(usage, 100))}%` }}
            />
          </div>
          <dl className={styles.cardFacts}>
            <div>
              <dt>Disponible</dt>
              <dd>{formatMoney(card.available_credit, 'COP')}</dd>
            </div>
            <div>
              <dt>Cupo</dt>
              <dd>{formatMoney(card.credit_limit, 'COP')}</dd>
            </div>
            <div>
              <dt className="visually-hidden">Uso</dt>
              <dd>{usageText.replace(' del cupo', '')}</dd>
            </div>
          </dl>
        </div>
        {card.over_limit && (
          <p className={styles.overLimit}>
            <WarningIcon />
            Superaste el cupo de esta tarjeta.
          </p>
        )}
        <p className={styles.itemDetails}>
          Corte día {card.statement_day} · pago día {card.payment_due_day}
        </p>
      </div>
    </li>
  )
}
