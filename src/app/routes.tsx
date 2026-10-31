import type { RouteObject } from 'react-router'

import { HomePage } from '../features/auth/login/HomePage.tsx'
import { LinkGooglePage } from '../features/auth/login/LinkGooglePage.tsx'
import { LoginPage } from '../features/auth/login/LoginPage.tsx'
import { MfaCodePage } from '../features/auth/login/MfaCodePage.tsx'
import { ForgotPasswordPage } from '../features/auth/password-recovery/ForgotPasswordPage.tsx'
import { ResetPasswordPage } from '../features/auth/password-recovery/ResetPasswordPage.tsx'
import { PrivacyPolicyPage } from '../features/auth/privacy/PrivacyPolicyPage.tsx'
import { PRIVACY_POLICY_PATH } from '../features/auth/privacy/policy.ts'
import { CheckEmailPage } from '../features/auth/register/CheckEmailPage.tsx'
import { RegisterPage } from '../features/auth/register/RegisterPage.tsx'
import { GuestRoute, ProtectedRoute } from '../features/auth/session/index.ts'
import { VerifyEmailPage } from '../features/auth/verify-email/VerifyEmailPage.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'
import { AppShell } from './shell/AppShell.tsx'

// Rutas del plan de authentication §3.
export const routes: RouteObject[] = [
  {
    element: <ProtectedRoute />,
    children: [
      {
        // Estructura de la aplicación (plan de accounts §3.1).
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          {
            path: 'cuentas',
            lazy: async () => ({
              Component: (await import('../features/accounts/AccountsPage.tsx')).AccountsPage,
            }),
          },
          {
            path: 'perfil',
            // Se descarga al entrar: solo la usa quien ya inició sesión.
            lazy: async () => ({
              Component: (await import('../features/auth/profile/ProfilePage.tsx')).ProfilePage,
            }),
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute stage="mfa_pending" />,
    children: [{ path: 'iniciar-sesion/codigo', element: <MfaCodePage /> }],
  },
  {
    element: <ProtectedRoute stage="link_pending" />,
    children: [{ path: 'iniciar-sesion/vincular-google', element: <LinkGooglePage /> }],
  },
  {
    element: <GuestRoute />,
    children: [
      { path: 'iniciar-sesion', element: <LoginPage /> },
      { path: 'registro', element: <RegisterPage /> },
    ],
  },
  { path: 'registro/revisa-tu-correo', element: <CheckEmailPage /> },
  // Pública aunque haya sesión: el enlace puede abrirse con otra sesión en el navegador.
  { path: 'verificar-correo', element: <VerifyEmailPage /> },
  { path: PRIVACY_POLICY_PATH.slice(1), element: <PrivacyPolicyPage /> },
  // Públicas aunque haya sesión: el enlace de crear contraseña también se pide desde el perfil.
  { path: 'recuperar-contrasena', element: <ForgotPasswordPage /> },
  { path: 'restablecer-contrasena', element: <ResetPasswordPage /> },
  { path: '*', element: <NotFoundPage /> },
]
