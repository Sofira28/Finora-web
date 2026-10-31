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

export type CreateAccountBody = Schema<'CreateAccountRequest'>
export type UpdateAccountBody = Schema<'UpdateAccountRequest'>

/** `POST /accounts` (RF-ACC-01). */
export function createAccount(body: CreateAccountBody): Promise<Account> {
  return apiRequest('/accounts', { method: 'POST', body })
}

/** `PATCH /accounts/{id}` (RF-ACC-05/06): solo cambia lo que se envía. */
export function updateAccount(id: string, body: UpdateAccountBody): Promise<Account> {
  return apiRequest(`/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body })
}

/** `POST /accounts/{id}/archive` (RF-ACC-07); idempotente. */
export function archiveAccount(id: string): Promise<Account> {
  return apiRequest(`/accounts/${encodeURIComponent(id)}/archive`, { method: 'POST' })
}

/** `POST /accounts/{id}/restore` (RF-ACC-08); idempotente. */
export function restoreAccount(id: string): Promise<Account> {
  return apiRequest(`/accounts/${encodeURIComponent(id)}/restore`, { method: 'POST' })
}

/** `DELETE /accounts/{id}` (RF-ACC-09): definitivo; `409` si tiene movimientos. */
export function deleteAccount(id: string): Promise<void> {
  return apiRequest(`/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
