import { API_BASE } from '../../../lib/api/index.ts'
import { PRIVACY_POLICY_VERSION } from '../privacy/policy.ts'

/** URL de `GET /auth/google/start` (navegación completa, ADR-0002). */
export function googleStartUrl(intent: 'login' | 'reauth' = 'login'): string {
  const params = new URLSearchParams({ intent })
  // El aviso junto al botón equivale a aceptar la política si se crea una cuenta (RF-AUTH-05).
  if (intent === 'login') params.set('privacy_policy_version', PRIVACY_POLICY_VERSION)
  return `${API_BASE}/auth/google/start?${params.toString()}`
}
