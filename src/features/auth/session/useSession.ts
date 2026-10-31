import { useQuery } from '@tanstack/react-query'

import { fetchSession, sessionQueryKey } from './api.ts'

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => fetchSession(signal),
    // La sesión cambia con acciones propias (que actualizan la consulta) o al vencer.
    staleTime: 60_000,
  })
}
