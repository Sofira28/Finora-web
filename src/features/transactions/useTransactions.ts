import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'

import { fetchTransactions, type TransactionQuery, transactionsQueryKey } from './api.ts'

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
