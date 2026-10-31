import { apiRequest, type Schema } from '../../../lib/api/index.ts'

export type RegisterRequest = Schema<'RegisterRequest'>
export type AcceptedResponse = Schema<'AcceptedResponse'>

export function register(body: RegisterRequest): Promise<AcceptedResponse> {
  return apiRequest('/auth/register', { method: 'POST', body })
}

export function verifyEmail(token: string): Promise<void> {
  return apiRequest('/auth/verify-email', { method: 'POST', body: { token } })
}

export function resendVerification(email: string): Promise<AcceptedResponse> {
  return apiRequest('/auth/verify-email/resend', { method: 'POST', body: { email } })
}
