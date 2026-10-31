import { PageHeader } from '../../../components/index.ts'
import { useSession } from '../session/index.ts'

// Página de inicio provisional (protegida) hasta que exista la feature `dashboard`.
export function HomePage() {
  const session = useSession()
  const name = session.data?.user?.name

  return (
    <PageHeader
      title={name ? `Hola, ${name}` : 'Hola'}
      description="Tu dinero, más claro. Pronto verás aquí el resumen de tus finanzas."
    />
  )
}
