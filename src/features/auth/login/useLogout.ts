import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { clearLocalSession } from '../session/index.ts'
import { logout } from './api.ts'

/** Cierra la sesión actual (RF-AUTH-06) y no deja datos del usuario en memoria. */
export function useLogout() {
  const client = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearLocalSession(client)
      void navigate('/iniciar-sesion', { replace: true })
    },
  })
}
