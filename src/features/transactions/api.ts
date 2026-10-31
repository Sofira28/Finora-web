import type { Schema } from '../../lib/api/index.ts'

// Tipos generados del contrato (`api-contracts.md` §6). Las funciones de la API llegan con la
// página (T-TRX-FE-02).
export type Transaction = Schema<'TransactionResponse'>
export type TransactionType = Schema<'TransactionType'>
export type Category = Schema<'Category'>
export type TransactionPage = Schema<'TransactionPageResponse'>
export type TransactionBody = Schema<'TransactionRequest'>
