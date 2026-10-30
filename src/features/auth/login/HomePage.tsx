import { Link } from 'react-router'

import { Alert, AuthLayout, Button } from '../../../components/index.ts'
import { useSession } from '../session/index.ts'
import { errorMessage } from '../shared/formErrors.ts'
import { useLogout } from './useLogout.ts'

// Página de inicio provisional (protegida) hasta que exista la feature `dashboard`.
export function HomePage() {
  const session = useSession()
  const logout = useLogout()
  const name = session.data?.user?.name

  return (
    <AuthLayout
      title={name ? `Hola, ${name}` : 'Hola'}
      description="Tu dinero, más claro. Pronto verás aquí el resumen de tus finanzas."
    >
      {logout.isError && <Alert variant="error">{errorMessage(logout.error)}</Alert>}
      <p>
        <Link to="/perfil">Ir a mi perfil</Link>
      </p>
      <Button
        variant="secondary"
        fullWidth
        loading={logout.isPending}
        onClick={() => {
          logout.mutate()
        }}
      >
        Cerrar sesión
      </Button>
    </AuthLayout>
  )
}
