import { expect } from '@playwright/test'

// API de Mailpit (finora-back/compose.yaml): atrapa todos los correos de la E2E.
const MAILPIT = process.env.FINORA_E2E_MAILPIT_URL ?? 'http://localhost:8025'

interface MessageSummary {
  ID: string
  Created: string
}

interface Message {
  Text: string
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT}${path}`)
  if (!response.ok) throw new Error(`Mailpit respondió ${String(response.status)} en ${path}`)
  return (await response.json()) as T
}

/**
 * Espera el correo enviado a `to` después de `since` que contiene un enlace a `path`
 * (p. ej. `/verificar-correo`) y devuelve ese enlace.
 */
export async function waitForLink(to: string, path: string, since: Date): Promise<string> {
  const pattern = new RegExp(`https?://[^\\s"<>]+${path}\\?token=[\\w-]+`)
  let link: string | undefined
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${to}"`)
        const { messages } = await getJson<{ messages: MessageSummary[] }>(
          `/api/v1/search?query=${query}`,
        )
        for (const summary of messages) {
          if (new Date(summary.Created) < since) continue
          const message = await getJson<Message>(`/api/v1/message/${summary.ID}`)
          link = pattern.exec(message.Text)?.[0]
          if (link) return true
        }
        return false
      },
      { message: `correo con ${path} para ${to}`, timeout: 15_000 },
    )
    .toBe(true)
  return link ?? ''
}
