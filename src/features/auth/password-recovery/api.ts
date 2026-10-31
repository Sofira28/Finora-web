import { apiRequest, type Schema } from '../../../lib/api/index.ts'

export function forgotPassword(email: string): Promise<Schema<'AcceptedResponse'>> {
  return apiRequest('/auth/password/forgot', { method: 'POST', body: { email } })
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return apiRequest('/auth/password/reset', {
    method: 'POST',
    body: { token, new_password: newPassword },
  })
}
