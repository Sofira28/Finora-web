import { AuthLayout } from '../../../components/index.ts'
import { PRIVACY_POLICY_VERSION } from './policy.ts'

// Página provisional mientras se redacta el texto legal (PA-AUTH-12, Ley 1581 de 2012).
export function PrivacyPolicyPage() {
  return (
    <AuthLayout
      title="Política de tratamiento de datos personales"
      description={`Versión ${PRIVACY_POLICY_VERSION}`}
    >
      <p>
        Estamos preparando el texto de nuestra política de tratamiento de datos personales, conforme
        a la Ley 1581 de 2012. Lo publicaremos aquí antes del lanzamiento de FINORA.
      </p>
    </AuthLayout>
  )
}
