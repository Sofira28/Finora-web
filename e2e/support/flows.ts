import { type Browser, expect, type Page } from '@playwright/test'

import { waitForLink } from './mailpit.ts'
import { Authenticator } from './totp.ts'

/** Correo único por corrida. Dominio reservado (RFC 2606) que el backend acepta. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${String(Date.now())}@example.com`
}

export async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  return context.newPage()
}

export async function register(page: Page, email: string, password: string, name: string) {
  await page.goto('/registro')
  await page.getByLabel('Nombre').fill(name)
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('checkbox', { name: /Acepto la/ }).check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
}

export async function verifyEmail(page: Page, email: string, since: Date) {
  const link = await waitForLink(email, '/verificar-correo', since)
  await page.goto(link)
  await expect(
    page.getByText('Tu correo quedó confirmado. Ya puedes iniciar sesión.'),
  ).toBeVisible()
  // El token no queda en la barra de direcciones.
  expect(page.url()).not.toContain('token=')
}

/**
 * Inicia sesión; con MFA, completa el segundo paso con `code`. Termina donde la aplicación
 * lleve (el inicio o la página protegida que se quería abrir).
 */
export async function login(
  page: Page,
  email: string,
  password: string,
  code?: () => Promise<string>,
) {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  if (code) {
    await page.getByLabel('Código o código de recuperación').fill(await code())
    await page.getByRole('button', { name: 'Verificar' }).click()
  }
  await expect(page).not.toHaveURL(/\/iniciar-sesion/)
}

export async function logout(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
}

/** Cuenta nueva, verificada y con la sesión iniciada en `page`. */
export async function signedUpAccount(page: Page, email: string, password: string, name: string) {
  const since = new Date()
  await register(page, email, password, name)
  await verifyEmail(page, email, since)
  await login(page, email, password)
}

/**
 * Activa la MFA desde /perfil (con reautenticación por contraseña) y devuelve la aplicación
 * de autenticación y los códigos de recuperación.
 */
export async function enableMfa(
  page: Page,
  password: string,
): Promise<{ authenticator: Authenticator; recoveryCodes: string[] }> {
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Activar verificación en dos pasos' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirma que eres tú' })
  await dialog.getByLabel('Contraseña', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Confirmar' }).click()

  await expect(page.getByRole('img', { name: /Código QR para agregar FINORA/ })).toBeVisible()
  const secret = await page.getByText(/^[A-Z2-7]{16,}$/).textContent()
  const authenticator = new Authenticator(secret ?? '')
  await page.getByLabel('Código de la aplicación').fill(await authenticator.nextCode())
  await page.getByRole('button', { name: 'Confirmar y activar' }).click()

  const codes = page.getByRole('list', { name: 'Códigos de recuperación' }).getByRole('listitem')
  await expect(codes).toHaveCount(10)
  const recoveryCodes = await codes.allTextContents()
  await page.getByRole('checkbox', { name: /Guardé mis códigos/ }).check()
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByText('Activa', { exact: true })).toBeVisible()
  return { authenticator, recoveryCodes }
}
