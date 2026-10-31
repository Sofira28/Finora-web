import { useQuery } from '@tanstack/react-query'

import { accountsQueryKey, fetchAccounts } from './api.ts'

export function useAccounts() {
  return useQuery({ queryKey: accountsQueryKey, queryFn: ({ signal }) => fetchAccounts(signal) })
}
