import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alert, Button, OtpField } from '../../../components/index.ts'
import formStyles from '../shared/AuthForm.module.css'
import { applyFieldErrors, errorMessage } from '../shared/formErrors.ts'
import { MESSAGES } from '../shared/messages.ts'
import {
  confirmMfa,
  disableMfa,
  type MfaSetup,
  needsReauth,
  type Profile,
  profileQueryKey,
  setupMfa,
} from './api.ts'
import styles from './Profile.module.css'
import { Section } from './Section.tsx'

const INVALID_CODE = 'El código no es correcto.'
// RF-AUTH-20 (PA-AUTH-09): sin soporte, perder ambos significa perder la cuenta.
const LOSS_WARNING =
  'Si pierdes tu teléfono y tus códigos de recuperación, no podrás recuperar tu cuenta.'

const codeSchema = z.object({ code: z.string().trim().min(1, MESSAGES.codeRequired) })
type CodeValues = z.infer<typeof codeSchema>

type Step =
  { kind: 'idle' } | { kind: 'setup'; setup: MfaSetup } | { kind: 'codes'; codes: string[] }

interface MfaSectionProps {
  profile: Profile
  requireReauth: (onDone: () => void) => void
}

/** Verificación en dos pasos: activar (RF-AUTH-10, 11 y 20) y desactivar (RF-AUTH-13). */
export function MfaSection({ profile, requireReauth }: MfaSectionProps) {
  const client = useQueryClient()
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const setup = useMutation({
    mutationFn: setupMfa,
    onSuccess: (data) => {
      setStep({ kind: 'setup', setup: data })
    },
    onError: (error) => {
      if (needsReauth(error))
        requireReauth(() => {
          setup.mutate()
        })
    },
  })

  const description =
    'Además de tu contraseña o Google, pediremos un código de una aplicación de autenticación (como Google Authenticator o Microsoft Authenticator).'

  if (step.kind === 'setup') {
    return (
      <Section title="Verificación en dos pasos" description={description}>
        <ConfirmSetup
          setup={step.setup}
          onConfirmed={(codes) => {
            setStep({ kind: 'codes', codes })
            void client.invalidateQueries({ queryKey: profileQueryKey })
          }}
          onCancel={() => {
            setStep({ kind: 'idle' })
          }}
        />
      </Section>
    )
  }
  if (step.kind === 'codes') {
    return (
      <Section title="Verificación en dos pasos" description={description}>
        <RecoveryCodes
          codes={step.codes}
          onDone={() => {
            setStep({ kind: 'idle' })
          }}
        />
      </Section>
    )
  }
  if (profile.mfa_enabled) {
    return (
      <Section title="Verificación en dos pasos" description={description}>
        <p className={styles.sectionText}>
          Estado: <span className={styles.status}>Activa</span>
        </p>
        <DisableMfa requireReauth={requireReauth} />
      </Section>
    )
  }
  return (
    <Section title="Verificación en dos pasos" description={description}>
      <p className={styles.sectionText}>Estado: Inactiva</p>
      {setup.isError && !needsReauth(setup.error) && (
        <Alert variant="error">{errorMessage(setup.error)}</Alert>
      )}
      <div className={styles.actions}>
        <Button
          loading={setup.isPending}
          onClick={() => {
            setup.mutate()
          }}
        >
          Activar verificación en dos pasos
        </Button>
      </div>
    </Section>
  )
}

/** QR como imagen SVG: sin canvas y sin insertar HTML. `qrcode` se carga solo aquí. */
function useQrImage(uri: string): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toString(uri, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }),
      )
      .then((svg) => {
        if (active) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      })
    return () => {
      active = false
    }
  }, [uri])
  return src
}

function ConfirmSetup({
  setup,
  onConfirmed,
  onCancel,
}: {
  setup: MfaSetup
  onConfirmed: (codes: string[]) => void
  onCancel: () => void
}) {
  const qr = useQrImage(setup.otpauth_uri)
  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  })
  const codeError = form.formState.errors.code
  const confirm = useMutation({
    mutationFn: (values: CodeValues) => confirmMfa(values.code),
    onSuccess: (data) => {
      onConfirmed(data.recovery_codes)
    },
    onError: (error) => {
      applyFieldErrors(error, form.setError, { code: INVALID_CODE })
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    confirm.mutate(values)
  })

  return (
    <>
      <ol className={styles.sectionText}>
        <li>Abre tu aplicación de autenticación y escanea el código QR.</li>
        <li>Escribe el código de 6 dígitos que te muestra la aplicación.</li>
      </ol>
      {qr ? (
        <img
          className={styles.qr}
          src={qr}
          alt="Código QR para agregar FINORA a tu aplicación de autenticación"
        />
      ) : (
        <p role="status">Generando el código QR…</p>
      )}
      <p className={styles.sectionText}>
        ¿No puedes escanearlo? Escribe esta clave en la aplicación:{' '}
        <span className={styles.secret}>{setup.secret}</span>
      </p>
      <Alert variant="warning">{LOSS_WARNING}</Alert>
      {confirm.isError && !codeError && (
        <Alert variant="error">{errorMessage(confirm.error)}</Alert>
      )}
      <form
        className={formStyles.form}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
      >
        <OtpField
          label="Código de la aplicación"
          error={codeError?.message}
          {...form.register('code')}
        />
        <div className={styles.actions}>
          <Button type="submit" loading={confirm.isPending}>
            Confirmar y activar
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </>
  )
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  const [missing, setMissing] = useState(false)
  const [copied, setCopied] = useState<boolean | null>(null)
  const errorId = useId()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <Alert variant="success">La verificación en dos pasos quedó activa.</Alert>
      <p className={styles.sectionText}>
        Guarda estos {codes.length} códigos de recuperación en un lugar seguro. Cada uno sirve una
        sola vez para entrar si no tienes tu teléfono. No los volveremos a mostrar.
      </p>
      <ul className={styles.codes} aria-label="Códigos de recuperación">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={() => {
            void copy()
          }}
        >
          Copiar códigos
        </Button>
      </div>
      {copied !== null && (
        <p role="status" className={styles.sectionText}>
          {copied
            ? 'Copiamos los códigos.'
            : 'No pudimos copiarlos. Selecciónalos y cópialos a mano.'}
        </p>
      )}
      <Alert variant="warning">{LOSS_WARNING}</Alert>
      <label className={formStyles.checkbox}>
        <input
          type="checkbox"
          checked={saved}
          aria-invalid={missing ? true : undefined}
          aria-describedby={missing ? errorId : undefined}
          onChange={(event) => {
            setSaved(event.target.checked)
            setMissing(false)
          }}
        />
        <span>Guardé mis códigos de recuperación en un lugar seguro.</span>
      </label>
      {missing && (
        <p id={errorId} className={formStyles.checkboxError}>
          Confirma que guardaste tus códigos.
        </p>
      )}
      <div className={styles.actions}>
        <Button
          onClick={() => {
            if (saved) onDone()
            else setMissing(true)
          }}
        >
          Listo
        </Button>
      </div>
    </>
  )
}

function DisableMfa({ requireReauth }: { requireReauth: (onDone: () => void) => void }) {
  const client = useQueryClient()
  const [needsNewCode, setNeedsNewCode] = useState(false)
  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  })
  const codeError = form.formState.errors.code
  const disable = useMutation({
    mutationFn: (values: CodeValues) => disableMfa(values.code),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: profileQueryKey })
    },
    onError: (error) => {
      if (needsReauth(error)) {
        // No se reintenta solo: la reautenticación gastó el código vigente (no se reutiliza).
        requireReauth(() => {
          form.reset()
          setNeedsNewCode(true)
        })
        return
      }
      applyFieldErrors(error, form.setError, { code: INVALID_CODE })
    },
  })
  const onSubmit = form.handleSubmit((values) => {
    setNeedsNewCode(false)
    disable.mutate(values)
  })
  const showError = disable.isError && !needsReauth(disable.error) && !codeError

  return (
    <>
      <Alert variant="warning">
        Si la desactivas, solo necesitarás tu contraseña o Google para entrar.
      </Alert>
      {needsNewCode && (
        <Alert variant="info">
          Listo, confirmaste tu identidad. Escribe el siguiente código de tu aplicación para
          desactivarla.
        </Alert>
      )}
      {showError && <Alert variant="error">{errorMessage(disable.error)}</Alert>}
      <form
        className={formStyles.form}
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
      >
        <OtpField
          label="Código de tu aplicación"
          error={codeError?.message}
          {...form.register('code')}
        />
        <div className={styles.actions}>
          <Button type="submit" variant="danger" loading={disable.isPending}>
            Desactivar verificación en dos pasos
          </Button>
        </div>
      </form>
    </>
  )
}
