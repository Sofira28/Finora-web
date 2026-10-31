import { apiRequest, type Schema } from '../../lib/api/index.ts'

export type Account = Schema<'AccountResponse'>
export type AccountType = Schema<'AccountType'>
export type AccountList = Schema<'AccountListResponse'>
export type Totals = Schema<'TotalsResponse'>

export const accountsQueryKey = ['accounts'] as const

/** `GET /accounts`: cuentas activas y archivadas, con los totales calculados por el backend. */
export function fetchAccounts(signal?: AbortSignal): Promise<AccountList> {
  return apiRequest('/accounts', { signal })
}
