import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { accountsQueryKey } from '../accounts/api.ts'
import {
  createTransaction,
  fetchTransactions,
  replaceTransaction,
  type TransactionBody,
  type TransactionQuery,
  transactionsQueryKey,
} from './api.ts'

/**
 * Movimientos de 50 en 50 con "Cargar más" (RF-TRX-04). El total y el resumen llegan iguales
 * en cada página. Al cambiar los filtros se conserva el resultado anterior hasta tener el
 * nuevo, para que la lista no parpadee mientras se escribe.
 */
export function useTransactions(query: TransactionQuery, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...transactionsQueryKey, query],
    queryFn: ({ pageParam, signal }) => fetchTransactions(query, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    placeholderData: keepPreviousData,
    enabled,
  })
}

/**
 * Recarga movimientos y cuentas: los saldos, totales y resúmenes siempre vienen del backend
 * (plan §3.3).
 */
function useInvalidateLedger() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: transactionsQueryKey }),
      client.invalidateQueries({ queryKey: accountsQueryKey }),
    ])
}

/** Registra un movimiento nuevo o reemplaza uno existente. */
export function useSaveTransaction() {
  const invalidate = useInvalidateLedger()
  return useMutation({
    mutationFn: (request: { id?: string; body: TransactionBody }) =>
      request.id ? replaceTransaction(request.id, request.body) : createTransaction(request.body),
    onSettled: invalidate,
  })
}
