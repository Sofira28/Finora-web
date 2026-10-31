import { createHmac } from 'node:crypto'

// TOTP (RFC 6238) como Google Authenticator: SHA-1, 6 dígitos, intervalos de 30 s.
const INTERVAL = 30
const WINDOW = 1 // el backend acepta un intervalo a cada lado del actual

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const value = alphabet.indexOf(char)
    if (value < 0) throw new Error(`Carácter base32 inválido: ${char}`)
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes = bits.match(/.{8}/g) ?? []
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)))
}

function codeAt(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', secret).update(counter).digest()
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f
  const value = hmac.readUInt32BE(offset) & 0x7fffffff
  return String(value % 1_000_000).padStart(6, '0')
}

/**
 * "Aplicación de autenticación" de la prueba. El backend no acepta un intervalo ya usado
 * (ni anteriores), así que cada código usa un intervalo posterior al último; si ya no
 * quedan dentro de la ventana, espera al siguiente intervalo.
 */
export class Authenticator {
  private readonly secret: Buffer
  private lastStep = -Infinity

  constructor(base32Secret: string) {
    this.secret = base32Decode(base32Secret)
  }

  async nextCode(): Promise<string> {
    for (;;) {
      const now = Math.floor(Date.now() / 1000 / INTERVAL)
      const step = Math.max(now - WINDOW + 1, this.lastStep + 1) // +1: margen ante el borde
      if (step <= now + WINDOW) {
        this.lastStep = step
        return codeAt(this.secret, step)
      }
      const msToNext = ((now + 1) * INTERVAL - Date.now() / 1000) * 1000
      await new Promise((resolve) => setTimeout(resolve, msToNext + 200))
    }
  }
}
