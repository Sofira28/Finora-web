import { useQuery } from '@tanstack/react-query'

import { fetchProfile, profileQueryKey } from './api.ts'

export function useProfile() {
  return useQuery({ queryKey: profileQueryKey, queryFn: ({ signal }) => fetchProfile(signal) })
}
