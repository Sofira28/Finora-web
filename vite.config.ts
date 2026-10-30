/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Solo lo lee el servidor de desarrollo; no llega al navegador (sin prefijo VITE_).
  const env = loadEnv(mode, process.cwd(), 'FINORA_')
  const apiTarget = env.FINORA_API_PROXY_TARGET ?? 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      // Frontend y backend comparten origen: la cookie de sesión (SameSite=Lax) y la
      // verificación de Origin del backend funcionan sin CORS (plan de authentication §3).
      proxy: { '/api': { target: apiTarget } },
    },
    test: {
      environment: 'jsdom',
      // Las pruebas de e2e/ son de Playwright (`pnpm test:e2e`).
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      // Zona horaria fija para que las pruebas de fechas no dependan del equipo.
      env: { TZ: 'UTC' },
    },
  }
})
