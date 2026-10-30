import { Link, useLocation } from 'react-router'

import { AuthLayout } from '../../../components/index.ts'
import { ResendVerificationForm } from '../shared/ResendVerificationForm.tsx'
import type { CheckEmailState } from './RegisterPage.tsx'

export function CheckEmailPage() {
  const state = useLocation().state as CheckEmailState | null
  const email = typeof state?.email === 'string' ? state.email : undefined

  return (
    <AuthLayout
      title="Revisa tu correo"
      description={
        email ? (
          <>
            Te enviamos un enlace a <strong>{email}</strong> para confirmar tu cuenta. Vence en 24
            horas.
          </>
        ) : (
          'Si te registraste, te enviamos un enlace para confirmar tu cuenta. Vence en 24 horas.'
        )
      }
      footer={<Link to="/iniciar-sesion">Ir al inicio de sesión</Link>}
    >
      <p>¿No te llegó? Revisa la carpeta de correo no deseado o pide un enlace nuevo.</p>
      <ResendVerificationForm email={email} />
    </AuthLayout>
  )
}
