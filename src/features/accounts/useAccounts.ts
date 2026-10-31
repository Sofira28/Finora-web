import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type Account,
  accountsQueryKey,
  archiveAccount,
  createAccount,
  type CreateAccountBody,
  deleteAccount,
  fetchAccounts,
  restoreAccount,
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

export type AccountAction = 'archive' | 'restore' | 'delete'

const ACTIONS: Record<AccountAction, (id: string) => Promise<unknown>> = {
  archive: archiveAccount,
  restore: restoreAccount,
  delete: deleteAccount,
}

/** Archivar, reactivar o eliminar (RF-ACC-07 a 09); siempre recarga el listado. */
export function useAccountAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ action, account }: { action: AccountAction; account: Account }) =>
      ACTIONS[action](account.id),
    onSettled: () => client.invalidateQueries({ queryKey: accountsQueryKey }),
  })
}
