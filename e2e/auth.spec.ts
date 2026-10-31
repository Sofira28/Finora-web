import { expect, type Page, test } from '@playwright/test'

import { waitForLink } from './support/mailpit.ts'
import {
  enableMfa,
  login,
  logout,
  newDevice,
  register,
  signedUpAccount,
  uniqueEmail,
  verifyEmail,
} from './support/flows.ts'
import type { Authenticator } from './support/totp.ts'

/**
 * Flujo completo de authentication contra el backend, PostgreSQL y Mailpit reales
 * (T-AUTH-QA-01): CA-AUTH-01, CA-AUTH-07, CA-AUTH-08 y CA-AUTH-10.
 */

const EMAIL = uniqueEmail('ana.e2e')
const PASSWORD = 'caballo correcto batería grapa'
const NEW_PASSWORD = 'otra frase larga para FINORA'

async function expectGreeting(page: Page, name: string) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible()
}

async function expectSignedOut(page: Page) {
  await page.goto('/perfil')
  await expect(page).toHaveURL(/\/iniciar-sesion$/)
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
}

test('cuenta completa: registro, MFA, recuperación y eliminación', async ({ page, browser }) => {
  test.setTimeout(240_000) // los códigos TOTP pueden exigir esperar al siguiente intervalo
  let authenticator: Authenticator | undefined
  const totp = () => {
    if (!authenticator) throw new Error('La MFA aún no está activa')
    return authenticator.nextCode()
  }
  let recoveryCodes: string[] = []

  await test.step('CA-AUTH-01: registro y verificación con el enlace de Mailpit', async () => {
    await signedUpAccount(page, EMAIL, PASSWORD, 'Ana')
    await expectGreeting(page, 'Ana')
  })

  await test.step('perfil: cambio de nombre', async () => {
    await page.getByRole('button', { name: 'Menú de perfil' }).click()
    await page.getByRole('link', { name: 'Mi perfil' }).click()
    await page.getByLabel('Nombre').fill('Ana María')
    await page.getByRole('button', { name: 'Guardar nombre' }).click()
    await expect(page.getByText('Guardamos tu nombre.')).toBeVisible()
  })

  await test.step('CA-AUTH-08: activación de MFA con reautenticación', async () => {
    ;({ authenticator, recoveryCodes } = await enableMfa(page, PASSWORD))
  })

  await test.step('cierre de sesión', async () => {
    await logout(page)
    await expectSignedOut(page)
  })

  await test.step('CA-AUTH-08: el inicio de sesión pide el código TOTP', async () => {
    await login(page, EMAIL, PASSWORD, totp)
    await expectGreeting(page, 'Ana María')
  })

  await test.step('CA-AUTH-08: un código de recuperación sirve una sola vez', async () => {
    const [recovery = ''] = recoveryCodes
    await logout(page)
    await login(page, EMAIL, PASSWORD, () => Promise.resolve(recovery))
    await logout(page)

    await page.getByLabel('Correo electrónico').fill(EMAIL)
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await page.getByLabel('Código o código de recuperación').fill(recovery)
    await page.getByRole('button', { name: 'Verificar' }).click()
    await expect(page.getByText('El código no es correcto.')).toBeVisible()
  })

  await test.step('CA-AUTH-07: recuperación con sesiones en dos dispositivos', async () => {
    await page.getByLabel('Código o código de recuperación').fill(await totp())
    await page.getByRole('button', { name: 'Verificar' }).click()
    await expect(page).not.toHaveURL(/\/iniciar-sesion/)
    const otherDevice = await newDevice(browser)
    await login(otherDevice, EMAIL, PASSWORD, totp)

    const recovering = await newDevice(browser)
    const since = new Date()
    await recovering.goto('/iniciar-sesion')
    await recovering.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
    await recovering.getByLabel('Correo electrónico').fill(EMAIL)
    await recovering.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(recovering.getByText(/te enviamos un enlace para restablecer/)).toBeVisible()

    const link = await waitForLink(EMAIL, '/restablecer-contrasena', since)
    await recovering.goto(link)
    expect(recovering.url()).not.toContain('token=')
    await recovering.getByLabel('Contraseña nueva').fill(NEW_PASSWORD)
    await recovering.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(
      recovering.getByText('Tu contraseña quedó guardada.', { exact: false }),
    ).toBeVisible()

    // Las dos sesiones anteriores quedaron cerradas.
    await expectSignedOut(page)
    await expectSignedOut(otherDevice)

    // La contraseña anterior deja de funcionar.
    await recovering.getByLabel('Correo electrónico').fill(EMAIL)
    await recovering.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
    await recovering.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(recovering.getByText('El correo o la contraseña no son correctos.')).toBeVisible()

    // El enlace no se puede reutilizar.
    await recovering.goto(link)
    await recovering.getByLabel('Contraseña nueva').fill('una tercera frase bien larga')
    await recovering.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(
      recovering.getByText('Este enlace ya no es válido. Solicita uno nuevo.'),
    ).toBeVisible()

    // La nueva sí funciona.
    await login(page, EMAIL, NEW_PASSWORD, totp)
    await otherDevice.context().close()
    await recovering.context().close()
  })

  await test.step('CA-AUTH-10: eliminación con sesiones en dos dispositivos', async () => {
    const otherDevice = await newDevice(browser)
    await login(otherDevice, EMAIL, NEW_PASSWORD, totp)

    await page.goto('/perfil')
    await page.getByLabel('Escribe ELIMINAR para confirmar').fill('ELIMINAR')
    await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click()
    const dialog = page.getByRole('dialog', { name: 'Confirma que eres tú' })
    await dialog.getByLabel('Contraseña', { exact: true }).fill(NEW_PASSWORD)
    await dialog.getByLabel('Código o código de recuperación').fill(await totp())
    await dialog.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByText('Eliminamos tu cuenta y todos tus datos.')).toBeVisible()

    // Todas las sesiones quedaron inválidas y la cuenta ya no existe.
    await expectSignedOut(otherDevice)
    await otherDevice.getByLabel('Correo electrónico').fill(EMAIL)
    await otherDevice.getByLabel('Contraseña', { exact: true }).fill(NEW_PASSWORD)
    await otherDevice.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(otherDevice.getByText('El correo o la contraseña no son correctos.')).toBeVisible()
    await otherDevice.context().close()

    // El correo puede registrarse como una cuenta nueva y vacía (sin MFA, con el nombre nuevo).
    const since = new Date()
    await register(page, EMAIL, PASSWORD, 'Ana de nuevo')
    await verifyEmail(page, EMAIL, since)
    await login(page, EMAIL, PASSWORD)
    await expectGreeting(page, 'Ana de nuevo')
    await page.goto('/perfil')
    await expect(page.getByText('Estado: Inactiva')).toBeVisible()
  })
})
