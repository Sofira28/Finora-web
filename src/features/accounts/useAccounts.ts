import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  accountsQueryKey,
  createAccount,
  type CreateAccountBody,
  fetchAccounts,
  updateAccount,
  type UpdateAccountBody,
} from './api.ts'

export function useAccounts() {
  return useQuery({ queryKey: accountsQueryKey, queryFn: ({ signal }) => fetchAccounts(signal) })
}

/**
 * Guarda una cuenta nueva o los cambios de una existente. Al terminar (bien o mal) se recarga
 * el listado: los totales siempre vienen del backend.
 */
export function useSaveAccount() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: { id?: string; body: CreateAccountBody | UpdateAccountBody }) =>
      request.id
        ? updateAccount(request.id, request.body)
        : createAccount(request.body as CreateAccountBody),
    onSettled: () => client.invalidateQueries({ queryKey: accountsQueryKey }),
  })
}
