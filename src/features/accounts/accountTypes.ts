import type { ComponentType, SVGProps } from 'react'

import {
  BankIcon,
  CashIcon,
  CreditCardIcon,
  InvestmentIcon,
  SavingsIcon,
  WalletIcon,
} from '../../components/icons/index.ts'
import type { Account, AccountType } from './api.ts'

interface TypeInfo {
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

/** Nombre e ícono de cada tipo (RN-ACC-01). */
export const ACCOUNT_TYPES: Record<AccountType, TypeInfo> = {
  bank: { label: 'Cuenta bancaria', icon: BankIcon },
  wallet: { label: 'Billetera digital', icon: WalletIcon },
  cash: { label: 'Efectivo', icon: CashIcon },
  savings: { label: 'Ahorro programado', icon: SavingsIcon },
  investment: { label: 'Inversión', icon: InvestmentIcon },
  credit_card: { label: 'Tarjeta de crédito', icon: CreditCardIcon },
}

export interface AccountGroups {
  liquid: Account[]
  savings: Account[]
  cards: Account[]
  archived: Account[]
}

/** Agrupa como en RF-ACC-02; las archivadas van aparte (RF-ACC-08). Conserva el orden. */
export function groupAccounts(accounts: Account[]): AccountGroups {
  const groups: AccountGroups = { liquid: [], savings: [], cards: [], archived: [] }
  for (const account of accounts) {
    if (account.archived) groups.archived.push(account)
    else if (account.type === 'credit_card') groups.cards.push(account)
    else if (account.type === 'savings' || account.type === 'investment')
      groups.savings.push(account)
    else groups.liquid.push(account)
  }
  return groups
}
