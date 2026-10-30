import { randomBytes } from 'node:crypto'

import { defineConfig, devices } from '@playwright/test'

// Puertos propios para no chocar con los servidores de desarrollo (5173 y 8000).
const WEB_PORT = 5174
const API_PORT = 8001
const WEB_URL = `http://localhost:${String(WEB_PORT)}`

/**
 * Pruebas E2E contra el backend, PostgreSQL y Mailpit reales (plan de authentication §8).
 * Antes: `docker compose up -d db mailpit` en finora-back.
 */
export default defineConfig({
  testDir: './e2e',
  // El flujo de cuenta es secuencial y comparte correo y reloj TOTP.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: './e2e/backend.sh',
      url: `http://127.0.0.1:${String(API_PORT)}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        FINORA_E2E_API_PORT: String(API_PORT),
        FINORA_ENVIRONMENT: 'development',
        FINORA_WEB_URL: WEB_URL,
        // Clave de MFA nueva en cada corrida (la BD también es nueva).
        // base64 URL-safe con relleno, como `base64.urlsafe_b64encode` de Python.
        FINORA_MFA_ENCRYPTION_KEY: randomBytes(32)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_'),
        // Google desactivado aunque finora-back/.env tenga credenciales.
        FINORA_GOOGLE_CLIENT_ID: '',
        FINORA_GOOGLE_CLIENT_SECRET: '',
        FINORA_SMTP_HOST: 'localhost',
        FINORA_SMTP_PORT: '1025',
        // Varias corridas seguidas desde la misma IP no deben chocar con los límites por IP.
        FINORA_RATE_LIMIT_LOGIN_PER_IP: '1000',
        FINORA_RATE_LIMIT_EMAIL_PER_IP: '1000',
      },
    },
    {
      command: `pnpm exec vite --port ${String(WEB_PORT)} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { FINORA_API_PROXY_TARGET: `http://127.0.0.1:${String(API_PORT)}` },
    },
  ],
})
