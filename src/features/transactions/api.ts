import { apiRequest, type Schema } from '../../lib/api/index.ts'

// Tipos generados del contrato (`api-contracts.md` §6).
export type Transaction = Schema<'TransactionResponse'>
export type TransactionType = Schema<'TransactionType'>
export type Category = Schema<'Category'>
export type Sort = Schema<'Sort'>
export type TransactionPage = Schema<'TransactionPageResponse'>
export type TransactionSummary = Schema<'SummaryResponse'>
export type TransactionBody = Schema<'TransactionRequest'>

/** Parámetros de `GET /transactions` (`api-contracts.md` §6.4), sin el cursor. */
export interface TransactionQuery {
  q?: string
  from?: string
  to?: string
  type?: TransactionType
  category?: Category
  account_id?: string
  sort: Sort
}

export const transactionsQueryKey = ['transactions'] as const

/** `GET /transactions`: una página (50 por defecto) con el total y el resumen del filtro. */
export function fetchTransactions(
  query: TransactionQuery,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<TransactionPage> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query) as [string, string | undefined][]) {
    if (value) params.set(key, value)
  }
  if (cursor) params.set('cursor', cursor)
  return apiRequest(`/transactions?${params.toString()}`, { signal })
}

/** `POST /transactions` (RF-TRX-01 a 03). */
export function createTransaction(body: TransactionBody): Promise<Transaction> {
  return apiRequest('/transactions', { method: 'POST', body })
}

/** `PUT /transactions/{id}` (RF-TRX-07): reemplaza el movimiento; el tipo puede cambiar. */
export function replaceTransaction(id: string, body: TransactionBody): Promise<Transaction> {
  return apiRequest(`/transactions/${encodeURIComponent(id)}`, { method: 'PUT', body })
}
