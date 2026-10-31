import { apiRequest, type Schema } from '../../../lib/api/index.ts'

export type LoginResponse = Schema<'LoginResponse'>

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password } })
}

export function loginMfa(code: string): Promise<LoginResponse> {
  return apiRequest('/auth/login/mfa', { method: 'POST', body: { code } })
}

export function linkGoogle(password: string): Promise<LoginResponse> {
  return apiRequest('/auth/google/link', { method: 'POST', body: { password } })
}

export function logout(): Promise<void> {
  return apiRequest('/auth/logout', { method: 'POST' })
}
