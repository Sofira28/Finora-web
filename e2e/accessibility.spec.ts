import { expect, test } from '@playwright/test'

import { expectNoAxeViolations, expectReflow, pasteInto, tabTo } from './support/a11y.ts'
import { Authenticator } from './support/totp.ts'
import { enableMfa, logout, signedUpAccount, uniqueEmail, verifyEmail } from './support/flows.ts'

/**
 * Accesibilidad de authentication en un navegador real (T-AUTH-QA-02, CA-AUTH-12,
 * RNF-AUTH-07): axe con contraste, reflow a 320 px, recorrido solo con teclado y pegado en
 * los campos de contraseña y código.
 */

const PASSWORD = 'caballo correcto batería grapa'

// Sin animaciones: axe mide el contraste del estado final, no a mitad del fundido.
test.use({ reducedMotion: 'reduce' })

test.describe('axe (WCAG 2.2 AA, con contraste) y reflow', () => {
  const publicPages: [string, string][] = [
    ['/registro', 'Crea tu cuenta'],
    ['/registro/revisa-tu-correo', 'Revisa tu correo'],
    ['/verificar-correo', 'Confirma tu correo'],
    ['/iniciar-sesion', 'Inicia sesión'],
    ['/iniciar-sesion?error=google', 'Inicia sesión'],
    ['/recuperar-contrasena', 'Recupera tu contraseña'],
    ['/restablecer-contrasena?token=sin-validar', 'Crea tu nueva contraseña'],
    ['/restablecer-contrasena', 'Crea tu nueva contraseña'],
    ['/politica-de-datos', 'Política de tratamiento de datos personales'],
    ['/no-existe', 'FINORA'],
  ]

  for (const [url, heading] of publicPages) {
    test(`página pública ${url}`, async ({ page }) => {
      await page.goto(url)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expectNoAxeViolations(page, url)
      await expectReflow(page, url)
    })
  }

  test('formularios con errores', async ({ page }) => {
    await page.goto('/registro')
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(page.getByText('Ingresa tu nombre.')).toBeVisible()
    await expectNoAxeViolations(page, '/registro con errores de validación')

    await page.goto('/iniciar-sesion')
    await page.getByLabel('Correo electrónico').fill(uniqueEmail('nadie'))
    await page.getByLabel('Contraseña', { exact: true }).fill('una contraseña cualquiera')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('alert')).toContainText(
      'El correo o la contraseña no son correctos.',
    )
    await expectNoAxeViolations(page, '/iniciar-sesion con credenciales incorrectas')

    await page.goto('/verificar-correo?token=vencido')
    await expect(page.getByRole('alert')).toContainText('Este enlace ya no es válido.')
    await expectNoAxeViolations(page, '/verificar-correo con enlace inválido')
  })

  test('páginas con sesión: inicio, perfil, diálogo, MFA y código', async ({ page }) => {
    test.setTimeout(120_000)
    const email = uniqueEmail('axe')
    await signedUpAccount(page, email, PASSWORD, 'Ana')
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible()
    await expectNoAxeViolations(page, '/ (inicio con sesión)')
    await expectReflow(page, '/')

    await page.goto('/perfil')
    await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible()
    await expectNoAxeViolations(page, '/perfil')
    await expectReflow(page, '/perfil')

    // Paso intermedio de la activación: QR y clave manual.
    await page.getByRole('button', { name: 'Activar verificación en dos pasos' }).click()
    const dialog = page.getByRole('dialog', { name: 'Confirma que eres tú' })
    await expect(dialog).toBeVisible()
    await expectNoAxeViolations(page, 'diálogo de reautenticación')
    await dialog.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
    await dialog.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByRole('img', { name: /Código QR/ })).toBeVisible()
    await expectNoAxeViolations(page, 'activación de MFA: QR')
    await expectReflow(page, 'activación de MFA: QR')
    // Confirmación del código y códigos de recuperación (se muestran una sola vez).
    const secret = await page.getByText(/^[A-Z2-7]{16,}$/).textContent()
    await page
      .getByLabel('Código de la aplicación')
      .fill(await new Authenticator(secret ?? '').nextCode())
    await page.getByRole('button', { name: 'Confirmar y activar' }).click()
    await expect(page.getByRole('list', { name: 'Códigos de recuperación' })).toBeVisible()
    await expectNoAxeViolations(page, 'códigos de recuperación')
    await expectReflow(page, 'códigos de recuperación')
    await page.getByRole('checkbox', { name: /Guardé mis códigos/ }).check()
    await page.getByRole('button', { name: 'Listo' }).click()
    await expect(page.getByText('Activa', { exact: true })).toBeVisible()
    await expectNoAxeViolations(page, '/perfil con MFA activa')

    await logout(page)
    await page.getByLabel('Correo electrónico').fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible()
    await expectNoAxeViolations(page, '/iniciar-sesion/codigo')
    await expectReflow(page, '/iniciar-sesion/codigo')
  })
})

test.describe('solo con teclado (WCAG 2.1.1 y 2.4.7)', () => {
  test('orden de tabulación del registro, con foco visible en cada parada', async ({ page }) => {
    await page.goto('/registro')
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible()
    const order = await tabTo(page, 'Inicia sesión')
    expect(order).toEqual([
      'FINORA, ir al inicio',
      'Nombre',
      'Correo electrónico',
      'Contraseña',
      'Mostrar contraseña',
      expect.stringMatching(/^Acepto la Política/),
      expect.stringMatching(/^Política de tratamiento de datos personales/),
      'Crear cuenta',
      'Inicia sesión',
    ])
  })

  test('registro, inicio de sesión, perfil y cierre de sesión sin ratón', async ({ page }) => {
    const email = uniqueEmail('teclado')
    const since = new Date()

    await page.goto('/registro')
    await tabTo(page, 'Nombre')
    await page.keyboard.type('Ana')
    await tabTo(page, 'Correo electrónico')
    await page.keyboard.type(email)
    await tabTo(page, 'Contraseña')
    await page.keyboard.type(PASSWORD)
    await tabTo(page, 'Mostrar contraseña')
    await page.keyboard.press('Space')
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text')
    await tabTo(page, 'Acepto la')
    await page.keyboard.press('Space')
    await tabTo(page, 'Crear cuenta')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()
    await verifyEmail(page, email, since)

    await tabTo(page, 'Correo electrónico')
    await page.keyboard.type(email)
    await tabTo(page, 'Contraseña')
    await page.keyboard.type(PASSWORD)
    await page.keyboard.press('Enter') // enviar desde el campo
    await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible()

    // Menú de perfil del encabezado (AppShell).
    await tabTo(page, 'Menú de perfil')
    await page.keyboard.press('Enter')
    await tabTo(page, 'Mi perfil')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible()

    // El diálogo recibe el foco, Esc lo cierra y el foco vuelve al botón que lo abrió.
    await tabTo(page, 'Activar verificación en dos pasos')
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Confirma que eres tú' })
    await expect(dialog.getByLabel('Contraseña', { exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Activar verificación en dos pasos' }),
    ).toBeFocused()

    await page.goto('/')
    await tabTo(page, 'Menú de perfil')
    await page.keyboard.press('Enter')
    await tabTo(page, 'Cerrar sesión')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  })
})

test.describe('pegado y gestores de contraseñas (WCAG 3.3.8)', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('se puede pegar la contraseña y el código', async ({ page }) => {
    test.setTimeout(120_000)
    const email = uniqueEmail('pegar')
    await signedUpAccount(page, email, PASSWORD, 'Ana')
    await enableMfa(page, PASSWORD)
    await logout(page)

    const password = page.getByLabel('Contraseña', { exact: true })
    await expect(password).toHaveAttribute('autocomplete', 'current-password')
    await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('autocomplete', 'username')
    await page.getByLabel('Correo electrónico').fill(email)
    await pasteInto(page, password, PASSWORD)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()

    const code = page.getByLabel('Código o código de recuperación')
    await expect(code).toHaveAttribute('autocomplete', 'one-time-code')
    await pasteInto(page, code, '123456')
  })

  test('los campos de contraseña nueva se identifican para el gestor', async ({ page }) => {
    await page.goto('/registro')
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    await page.goto('/restablecer-contrasena?token=sin-validar')
    await expect(page.getByLabel('Contraseña nueva')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })
})
