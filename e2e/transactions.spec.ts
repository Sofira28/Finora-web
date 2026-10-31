import { expect, type Locator, type Page, test } from '@playwright/test'

import { signedUpAccount, uniqueEmail } from './support/flows.ts'

/**
 * Movimientos de punta a punta contra el backend y PostgreSQL reales (T-TRX-QA-01):
 * CA-TRX-01, 03, 04 y 05 desde el contexto común (cuentas de CA-ACC-01) y CA-TRX-07.
 *
 * Un solo usuario: cada criterio parte del contexto común y termina eliminando su movimiento,
 * lo que prueba también el borrado y devuelve los saldos al punto de partida.
 */

const PASSWORD = 'caballo correcto batería grapa'

/** Monto como lo muestra Intl (`$` + espacio sin ruptura); acepta cualquier espacio. */
function money(text: string): RegExp {
  return new RegExp(text.replace(/[.$+]/g, (char) => `\\${char}`).replace(/ /g, '\\s'))
}

// --- Cuentas ---------------------------------------------------------------------------------

interface NewAccount {
  name: string
  type: string
  balance: string
  card?: { limit: string; statementDay: string; dueDay: string }
}

async function createAccount(page: Page, account: NewAccount) {
  await page.getByRole('button', { name: 'Nueva cuenta' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nueva cuenta' })
  await dialog.getByRole('radio', { name: account.type }).check()
  await dialog.getByLabel('Nombre').fill(account.name)
  await dialog.getByLabel(account.card ? 'Deuda actual' : 'Saldo inicial').fill(account.balance)
  if (account.card) {
    await dialog.getByLabel('Cupo total').fill(account.card.limit)
    await dialog.getByLabel('Día de corte').fill(account.card.statementDay)
    await dialog.getByLabel('Día límite de pago').fill(account.card.dueDay)
  }
  await dialog.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText(`Creamos la cuenta ${account.name}.`)).toBeVisible()
}

function total(page: Page, label: string): Locator {
  return page
    .getByRole('region', { name: 'Resumen' })
    .getByText(label, { exact: true })
    .locator('xpath=following-sibling::dd[1]/span[1]')
}

function accountItem(page: Page, name: string): Locator {
  return page.getByRole('listitem').filter({ hasText: name })
}

interface Expected {
  available: string
  netWorth: string
  debt?: string
  balances?: Record<string, string>
  card?: { debt: string; available: string }
}

/** Saldos y totales de /cuentas, siempre calculados por el backend. */
async function expectAccounts(page: Page, expected: Expected) {
  await page.goto('/cuentas')
  await expect(total(page, 'Saldo disponible')).toHaveText(money(expected.available))
  await expect(total(page, 'Patrimonio neto')).toHaveText(money(expected.netWorth))
  if (expected.debt) {
    await expect(total(page, 'Deuda en tarjetas')).toHaveText(money(expected.debt))
  }
  for (const [name, balance] of Object.entries(expected.balances ?? {})) {
    await expect(accountItem(page, name)).toContainText(money(balance))
  }
  if (expected.card) {
    const card = accountItem(page, 'Tarjeta Órbita')
    await expect(card).toContainText(money(`Deuda pendiente$ ${expected.card.debt}`))
    await expect(card).toContainText(money(`Disponible$ ${expected.card.available}`))
  }
}

const COMMON: Expected = {
  available: '$ 2.890.000',
  netWorth: '$ 14.070.000',
  debt: '$ 820.000',
  balances: { Nómina: '$ 2.800.000', Efectivo: '$ 90.000', CDT: '$ 12.000.000' },
  card: { debt: '820.000', available: '5.180.000' },
}

// --- Movimientos -----------------------------------------------------------------------------

type NewTransaction =
  | {
      type: 'Gasto'
      amount: string
      account: string
      category: string
      description: string
    }
  | { type: 'Transferencia'; amount: string; from: string; to: string }

async function addTransaction(page: Page, transaction: NewTransaction) {
  await page.goto('/movimientos')
  await page.getByRole('button', { name: 'Añadir movimiento' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo movimiento' })
  await dialog.getByRole('radio', { name: transaction.type }).check()
  await dialog.getByLabel('Monto').fill(transaction.amount)
  if (transaction.type === 'Gasto') {
    await dialog.getByLabel('Cuenta', { exact: true }).selectOption({ label: transaction.account })
    await dialog.getByLabel('Categoría').selectOption({ label: transaction.category })
    await dialog.getByLabel('Descripción').fill(transaction.description)
  } else {
    await dialog.getByLabel('Cuenta de origen').selectOption({ label: transaction.from })
    await dialog.getByLabel('Cuenta de destino').selectOption({ label: transaction.to })
  }
  await dialog.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page.getByText('Registramos el movimiento.')).toBeVisible()
}

function summary(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: 'Ingresos' })
}

async function openRowAction(page: Page, description: string, action: string) {
  await page.getByRole('button', { name: new RegExp(`^Acciones de ${description}`) }).click()
  await page.getByRole('button', { name: action, exact: true }).click()
}

/** Elimina el movimiento desde su menú y vuelve al contexto común (RF-TRX-08). */
async function deleteTransaction(page: Page, description: string) {
  await page.goto('/movimientos')
  await openRowAction(page, description, 'Eliminar')
  const dialog = page.getByRole('dialog', { name: '¿Eliminar este movimiento?' })
  await dialog.getByRole('button', { name: 'Eliminar movimiento' }).click()
  await expect(page.getByText('Eliminamos el movimiento.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aún no tienes movimientos' })).toBeVisible()
}

test('movimientos: gasto, ahorro, compra y pago de tarjeta con los totales de Cuentas', async ({
  page,
}) => {
  test.setTimeout(180_000)

  await test.step('contexto común: cuentas de CA-ACC-01', async () => {
    await signedUpAccount(page, uniqueEmail('trx.e2e'), PASSWORD, 'Ana')
    await page.goto('/cuentas')
    await createAccount(page, { name: 'Nómina', type: 'Cuenta bancaria', balance: '2.800.000' })
    await createAccount(page, { name: 'Efectivo', type: 'Efectivo', balance: '90.000' })
    await createAccount(page, { name: 'CDT', type: 'Inversión', balance: '12.000.000' })
    await createAccount(page, {
      name: 'Tarjeta Órbita',
      type: 'Tarjeta de crédito',
      balance: '820.000',
      card: { limit: '6.000.000', statementDay: '28', dueDay: '18' },
    })
    await expectAccounts(page, COMMON)
  })

  await test.step('CA-TRX-01: gasto de $ 120.000 en Nómina', async () => {
    await addTransaction(page, {
      type: 'Gasto',
      amount: '120.000',
      account: 'Nómina',
      category: 'Mercado',
      description: 'Mercado de la semana',
    })
    // Resumen del mes, calculado por el backend.
    await expect(summary(page)).toContainText('1 movimiento')
    await expect(summary(page)).toContainText(money('Gastos − $ 120.000'))
    const row = page.getByRole('row').filter({ hasText: 'Mercado de la semana' })
    await expect(row).toContainText(money('− $ 120.000'))
    await expect(row).toContainText('Gasto')
    await expectAccounts(page, {
      available: '$ 2.770.000',
      netWorth: '$ 13.950.000',
      balances: { Nómina: '$ 2.680.000' },
    })
  })

  await test.step('CA-TRX-07: editar el monto a $ 100.000 y eliminar', async () => {
    await page.goto('/movimientos')
    await openRowAction(page, 'Mercado de la semana', 'Editar')
    const dialog = page.getByRole('dialog', { name: 'Editar movimiento' })
    await expect(dialog.getByLabel('Monto')).toHaveValue('120.000')
    await dialog.getByLabel('Monto').fill('100.000')
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Guardamos los cambios del movimiento.')).toBeVisible()
    await expectAccounts(page, {
      available: '$ 2.790.000',
      netWorth: '$ 13.970.000',
      balances: { Nómina: '$ 2.700.000' },
    })

    await deleteTransaction(page, 'Mercado de la semana')
    await expectAccounts(page, COMMON)
    // Sin movimientos, el saldo inicial de Nómina vuelve a ser editable (RN-TRX-10).
    await page.getByRole('button', { name: 'Acciones de Nómina' }).click()
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Editar Nómina' })
    await expect(form.getByLabel('Saldo inicial')).not.toHaveAttribute('readonly')
    await form.getByRole('button', { name: 'Cancelar' }).click()
  })

  await test.step('CA-TRX-03: ahorro de $ 500.000 de Nómina a CDT', async () => {
    await addTransaction(page, {
      type: 'Transferencia',
      amount: '500.000',
      from: 'Nómina',
      to: 'CDT',
    })
    await expect(summary(page)).toContainText(money('Ahorro neto + $ 500.000'))
    await expect(summary(page)).toContainText(money('Gastos − $ 0'))
    await expect(page.getByRole('row').filter({ hasText: 'Transferencia a CDT' })).toContainText(
      'Nómina →a CDT',
    )
    await expectAccounts(page, {
      available: '$ 2.390.000',
      netWorth: '$ 14.070.000',
      balances: { Nómina: '$ 2.300.000', CDT: '$ 12.500.000' },
    })
    await deleteTransaction(page, 'Transferencia a CDT')
    await expectAccounts(page, COMMON)
  })

  await test.step('CA-TRX-04: compra de $ 300.000 con la tarjeta', async () => {
    await addTransaction(page, {
      type: 'Gasto',
      amount: '300.000',
      account: 'Tarjeta Órbita',
      category: 'Restaurantes',
      description: 'Cena',
    })
    await expect(summary(page)).toContainText(money('Gastos − $ 300.000'))
    await expectAccounts(page, {
      available: '$ 2.890.000',
      netWorth: '$ 13.770.000',
      debt: '$ 1.120.000',
      card: { debt: '1.120.000', available: '4.880.000' },
    })
    await deleteTransaction(page, 'Cena')
    await expectAccounts(page, COMMON)
  })

  await test.step('CA-TRX-05: pago de la tarjeta con $ 820.000 desde Nómina', async () => {
    await addTransaction(page, {
      type: 'Transferencia',
      amount: '820.000',
      from: 'Nómina',
      to: 'Tarjeta Órbita',
    })
    // El pago de tarjeta no es gasto ni ahorro: cuenta como transferencia (RN-TRX-05).
    await expect(summary(page)).toContainText(money('Gastos − $ 0'))
    await expect(summary(page)).toContainText(money('Transferencias $ 820.000'))
    await expectAccounts(page, {
      available: '$ 2.070.000',
      netWorth: '$ 14.070.000',
      debt: '$ 0',
      card: { debt: '0', available: '6.000.000' },
    })
    await deleteTransaction(page, 'Transferencia a Tarjeta Órbita')
    await expectAccounts(page, COMMON)
  })
})
