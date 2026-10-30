import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Alert, AuthLayout, Button } from '../../../components/index.ts'
import { DeleteAccountSection } from './DeleteAccountSection.tsx'
import { MfaSection } from './MfaSection.tsx'
import { NameSection } from './NameSection.tsx'
import { PasswordSection } from './PasswordSection.tsx'
import { ReauthDialog, type ReauthMode } from './ReauthDialog.tsx'
import { useProfile } from './useProfile.ts'

const REAUTH_DONE =
  'Confirmaste tu identidad. Tienes 5 minutos para repetir la acción que querías hacer.'
const REAUTH_FAILED = 'No pudimos confirmar tu identidad con Google. Intenta de nuevo.'

interface ReauthRequest {
  mode: ReauthMode
  onDone?: () => void
}

/** Resultado de volver de Google con `intent=reauth` (`/perfil?reauth=ok|codigo|error`). */
function useGoogleReauthReturn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [result] = useState(() => searchParams.get('reauth'))
  useEffect(() => {
    if (searchParams.has('reauth')) void navigate('.', { replace: true })
  }, [searchParams, navigate])
  return result
}

/** Perfil del usuario (RF-AUTH-13 a 16, 18, 20 y 21). */
export function ProfilePage() {
  const profile = useProfile()
  const googleReturn = useGoogleReauthReturn()
  const [reauth, setReauth] = useState<ReauthRequest | null>(() =>
    googleReturn === 'codigo' ? { mode: 'code' } : null,
  )
  const [notice, setNotice] = useState<'done' | 'failed' | null>(() =>
    googleReturn === 'ok' ? 'done' : googleReturn === 'error' ? 'failed' : null,
  )

  const requireReauth = (onDone: () => void) => {
    setNotice(null)
    setReauth({ mode: 'full', onDone })
  }

  return (
    <AuthLayout wide title="Tu perfil" footer={<Link to="/">Volver al inicio</Link>}>
      {notice === 'done' && <Alert variant="info">{REAUTH_DONE}</Alert>}
      {notice === 'failed' && <Alert variant="error">{REAUTH_FAILED}</Alert>}
      {profile.isPending ? (
        <p role="status">Cargando tu perfil…</p>
      ) : profile.isError ? (
        <>
          <Alert variant="error">{profile.error.message}</Alert>
          <Button
            variant="secondary"
            onClick={() => {
              void profile.refetch()
            }}
          >
            Reintentar
          </Button>
        </>
      ) : (
        <>
          <NameSection profile={profile.data} />
          <PasswordSection profile={profile.data} />
          <MfaSection profile={profile.data} requireReauth={requireReauth} />
          <DeleteAccountSection requireReauth={requireReauth} />
          <ReauthDialog
            open={reauth !== null}
            mode={reauth?.mode ?? 'full'}
            profile={profile.data}
            onClose={() => {
              setReauth(null)
            }}
            onSuccess={() => {
              const onDone = reauth?.onDone
              setReauth(null)
              if (onDone) onDone()
              else setNotice('done')
            }}
          />
        </>
      )}
    </AuthLayout>
  )
}
