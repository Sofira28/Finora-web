import { GoogleButton } from '../../../components/index.ts'
import { PRIVACY_POLICY_PATH } from '../privacy/policy.ts'
import { useSession } from '../session/index.ts'
import styles from './AuthForm.module.css'
import { googleStartUrl } from './google.ts'

/**
 * Botón de Google con el aviso de la política junto a él (RF-AUTH-05): entrar con Google
 * puede crear la cuenta. Solo aparece si el backend tiene Google configurado.
 */
export function GoogleSection() {
  const session = useSession()
  if (!session.data?.google_enabled) return null
  return (
    <>
      <div className={styles.divider}>o</div>
      <GoogleButton href={googleStartUrl()} />
      <p className={styles.note}>
        Al continuar con Google aceptas la{' '}
        <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener">
          Política de tratamiento de datos personales{' '}
          <span className="visually-hidden">(se abre en una pestaña nueva)</span>
        </a>
        .
      </p>
    </>
  )
}
