import { ApiError, apiRequest, type Schema } from '../../../lib/api/index.ts'

export type Profile = Schema<'ProfileResponse'>
export type MfaSetup = Schema<'MfaSetupResponse'>

export const profileQueryKey = ['me'] as const

export function fetchProfile(signal?: AbortSignal): Promise<Profile> {
  return apiRequest('/me', { signal })
}

export function renameProfile(name: string): Promise<Profile> {
  return apiRequest('/me', { method: 'PATCH', body: { name } })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiRequest('/me/password', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  })
}

export function requestPasswordSetup(): Promise<Schema<'AcceptedResponse'>> {
  return apiRequest('/me/password/setup', { method: 'POST' })
}

export function reauthenticate(body: { password?: string; code?: string }): Promise<void> {
  return apiRequest('/auth/reauthenticate', { method: 'POST', body })
}

export function setupMfa(): Promise<MfaSetup> {
  return apiRequest('/me/mfa/setup', { method: 'POST' })
}

export function confirmMfa(code: string): Promise<Schema<'RecoveryCodesResponse'>> {
  return apiRequest('/me/mfa/confirm', { method: 'POST', body: { code } })
}

export function disableMfa(code: string): Promise<void> {
  return apiRequest('/me/mfa/disable', { method: 'POST', body: { code } })
}

export function deleteAccount(confirmation: string): Promise<void> {
  return apiRequest('/me', { method: 'DELETE', body: { confirmation } })
}

/** La acción exige una reautenticación reciente (RF-AUTH-21). */
export function needsReauth(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'reauthentication_required'
}
