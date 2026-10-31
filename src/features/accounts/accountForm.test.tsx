import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { setCsrfToken } from '../../lib/api/index.ts'
import { json, mockApi, problem, renderApp } from '../../test/app.tsx'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { SessionInfo } from '../auth/session/index.ts'
import type { Account, AccountList } from './api.ts'

const ACTIVE: SessionInfo = {
  stage: 'active',
  csrf_token: 'csrf-activa',
  google_enabled: false,
  user: { name: 'Ana', email: 'ana@correo.com' },
}
const ZERO = { available_balance: '0.00', net_worth: '0.00', credit_card_debt: '0.00' }
// La página se descarga con `lazy`; con la suite completa en paralelo puede tardar.
const SLOW = { timeout: 5000 }

const NOMINA: Account = {
  id: '0193f2a4-0000-7000-8000-000000000001',
  name: 'Nómina',
  type: 'bank',
  institution: 'Banco Andino',
  opening_balance: '2800000.00',
  balance: '2800000.00',
  has_movements: false,
  archived: false,
  credit_card: null,
  created_at: '2026-10-30T15:00:00Z',
}
const TARJETA: Account = {
  ...NOMINA,
  id: '0193f2a4-0000-7000-8000-000000000002',
  name: 'Tarjeta Órbita',
  type: 'credit_card',
  opening_balance: '820000.00',
  balance: '820000.00',
  credit_card: {
    credit_limit: '6000000.00',
    available_credit: '5180000.00',
    usage_percent: 14,
    over_limit: false,
    statement_day: 28,
    payment_due_day: 18,
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

type Handler = (body: unknown) => Response | Promise<Response>

function setup(accounts: Account[], handlers: Record<string, Handler> = {}) {
  const list: AccountList = { accounts, totals: ZERO }
  const api = mockApi({
    'GET /auth/session': () => json(200, ACTIVE),
    'GET /accounts': () => json(200, list),
    ...handlers,
  })
  return { api, ...renderApp('/cuentas') }
}

async function openCreate() {
  await userEvent.click(await screen.findByRole('button', { name: 'Nueva cuenta' }, SLOW))
  return screen.getByRole('dialog', { name: 'Nueva cuenta' })
}

describe('crear cuenta (RF-ACC-01)', () => {
  it('crea una cuenta bancaria con el monto escrito como en Colombia', async () => {
    const { api, container } = setup([], {
      'POST /accounts': () => json(201, NOMINA),
    })
    const dialog = await openCreate()
    expect(within(dialog).getByRole('radio', { name: 'Cuenta bancaria' })).toBeChecked()
    // Sin campos de tarjeta en otros tipos.
    expect(within(dialog).queryByLabelText('Cupo total')).not.toBeInTheDocument()
    await expectNoAxeViolations(container)

    await userEvent.type(within(dialog).getByLabelText('Nombre'), ' Nómina ')
    await userEvent.type(within(dialog).getByLabelText('Entidad (opcional)'), 'Banco Andino')
    const saldo = within(dialog).getByLabelText('Saldo inicial')
    await userEvent.clear(saldo)
    await userEvent.type(saldo, '2.800.000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Creamos la cuenta Nómina.')).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.bodies('POST /accounts')).toEqual([
      { name: 'Nómina', type: 'bank', institution: 'Banco Andino', opening_balance: '2800000' },
    ])
    expect(api.headers('POST /accounts')[0]?.['X-CSRF-Token']).toBe('csrf-activa')
    // El listado (y los totales) se recargan del backend.
    await waitFor(() => {
      expect(api.bodies('GET /accounts').length).toBeGreaterThan(1)
    })
  }, 15000)

  it('tarjeta: pide deuda, cupo y días, y envía solo esos campos', async () => {
    const { api } = setup([], { 'POST /accounts': () => json(201, TARJETA) })
    const dialog = await openCreate()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Tarjeta de crédito' }))
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Tarjeta Órbita')
    const deuda = within(dialog).getByLabelText('Deuda actual')
    await userEvent.clear(deuda)
    await userEvent.type(deuda, '820.000')
    await userEvent.type(within(dialog).getByLabelText('Cupo total'), '6.000.000')
    await userEvent.type(within(dialog).getByLabelText('Día de corte'), '28')
    await userEvent.type(within(dialog).getByLabelText('Día límite de pago'), '18')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Creamos la cuenta Tarjeta Órbita.')).toBeVisible()
    expect(api.bodies('POST /accounts')).toEqual([
      {
        name: 'Tarjeta Órbita',
        type: 'credit_card',
        institution: null,
        opening_balance: '820000',
        credit_limit: '6000000',
        statement_day: 28,
        payment_due_day: 18,
      },
    ])
  })

  it('si se cambia de tarjeta a otro tipo, no envía los datos de tarjeta', async () => {
    const { api } = setup([], { 'POST /accounts': () => json(201, NOMINA) })
    const dialog = await openCreate()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Tarjeta de crédito' }))
    await userEvent.type(within(dialog).getByLabelText('Cupo total'), '6.000.000')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Efectivo' }))
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Efectivo')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))
    await screen.findByText(/Creamos la cuenta/)
    expect(api.bodies('POST /accounts')).toEqual([
      { name: 'Efectivo', type: 'cash', institution: null, opening_balance: '0' },
    ])
  })

  it('valida como ayuda antes de enviar (VAL-ACC-01, 03 y 04)', async () => {
    const { api } = setup([])
    const dialog = await openCreate()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Tarjeta de crédito' }))
    const deuda = within(dialog).getByLabelText('Deuda actual')
    await userEvent.clear(deuda)
    await userEvent.type(deuda, '1,250,000')
    await userEvent.type(within(dialog).getByLabelText('Día de corte'), '32')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))

    const nombre = within(dialog).getByLabelText('Nombre')
    expect(nombre).toHaveAccessibleDescription(
      expect.stringContaining('Escribe un nombre de hasta 60 caracteres.'),
    )
    expect(nombre).toHaveFocus()
    expect(deuda).toHaveAccessibleDescription(
      expect.stringContaining('Escribe un monto válido, p. ej. 1.250.000.'),
    )
    expect(within(dialog).getByLabelText('Cupo total')).toHaveAccessibleDescription(
      expect.stringContaining('Indica el cupo de la tarjeta.'),
    )
    expect(within(dialog).getByLabelText('Día de corte')).toHaveAccessibleDescription(
      'Elige un día entre 1 y 31.',
    )
    expect(api.bodies('POST /accounts')).toEqual([])
  })

  it('cupo en cero', async () => {
    setup([])
    const dialog = await openCreate()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Tarjeta de crédito' }))
    await userEvent.type(within(dialog).getByLabelText('Cupo total'), '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))
    expect(within(dialog).getByLabelText('Cupo total')).toHaveAccessibleDescription(
      expect.stringContaining('El cupo debe ser mayor que cero.'),
    )
  })

  it('CA-ACC-08: nombre repetido (409) en su campo', async () => {
    setup([NOMINA], {
      'POST /accounts': () =>
        problem(409, 'account_name_taken', 'Ya tienes una cuenta con ese nombre.', {
          errors: [
            {
              loc: ['body', 'name'],
              type: 'name_taken',
              message: 'Ya tienes una cuenta con ese nombre.',
            },
          ],
        }),
    })
    const dialog = await openCreate()
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'NÓMINA')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))
    const nombre = within(dialog).getByLabelText('Nombre')
    await waitFor(() => {
      expect(nombre).toHaveAccessibleDescription(
        expect.stringContaining('Ya tienes una cuenta con ese nombre.'),
      )
    })
    expect(nombre).toHaveFocus()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument() // el error va en el campo
  })

  it('error 422 del backend sin mensaje: usa el texto del campo', async () => {
    setup([], {
      'POST /accounts': () =>
        problem(422, 'validation_failed', 'Revisa los datos.', {
          errors: [{ loc: ['body', 'opening_balance'], type: 'value_error' }],
        }),
    })
    const dialog = await openCreate()
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Nómina')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Saldo inicial')).toHaveAccessibleDescription(
        expect.stringContaining('Escribe un monto válido, p. ej. 1.250.000.'),
      )
    })
  })

  it('VAL-ACC-11: tope de cuentas, como alerta dentro del diálogo', async () => {
    setup([], {
      'POST /accounts': () =>
        problem(
          409,
          'account_limit_reached',
          'Llegaste al máximo de 100 cuentas. Elimina las que ya no uses.',
        ),
    })
    const dialog = await openCreate()
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Otra')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear cuenta' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Llegaste al máximo de 100 cuentas.',
    )
    // Lo escrito se conserva.
    expect(within(dialog).getByLabelText('Nombre')).toHaveValue('Otra')
  })

  it('el estado vacío invita a crear la primera cuenta (RF-ACC-10)', async () => {
    setup([])
    await userEvent.click(
      await screen.findByRole('button', { name: 'Crear mi primera cuenta' }, SLOW),
    )
    expect(screen.getByRole('dialog', { name: 'Nueva cuenta' })).toBeVisible()
  })

  it('Cancelar cierra sin enviar', async () => {
    const { api } = setup([])
    const dialog = await openCreate()
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Nómina')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.bodies('POST /accounts')).toEqual([])
  })
})

describe('editar cuenta (RF-ACC-05 y 06)', () => {
  it('muestra los datos actuales, el tipo fijo y envía los cambios sin el tipo', async () => {
    const { api } = setup([NOMINA], {
      [`PATCH /accounts/${NOMINA.id}`]: () => json(200, { ...NOMINA, name: 'Nómina principal' }),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Nómina' }, SLOW))
    const dialog = screen.getByRole('dialog', { name: 'Editar Nómina' })
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    expect(dialog).toHaveTextContent('Cuenta bancaria')
    expect(dialog).toHaveTextContent('El tipo no se puede cambiar.')
    expect(within(dialog).getByLabelText('Saldo inicial')).toHaveValue('2.800.000')

    const nombre = within(dialog).getByLabelText('Nombre')
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Nómina principal')
    await userEvent.clear(within(dialog).getByLabelText('Entidad (opcional)'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Guardamos los cambios de Nómina principal.')).toBeVisible()
    expect(api.bodies(`PATCH /accounts/${NOMINA.id}`)).toEqual([
      { name: 'Nómina principal', institution: null, opening_balance: '2800000' },
    ])
  })

  it('tarjeta: edita cupo y días', async () => {
    const { api } = setup([TARJETA], {
      [`PATCH /accounts/${TARJETA.id}`]: () => json(200, TARJETA),
    })
    await userEvent.click(
      await screen.findByRole('button', { name: 'Editar Tarjeta Órbita' }, SLOW),
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Cupo total')).toHaveValue('6.000.000')
    expect(within(dialog).getByLabelText('Día de corte')).toHaveValue('28')
    const pago = within(dialog).getByLabelText('Día límite de pago')
    await userEvent.clear(pago)
    await userEvent.type(pago, '5')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText(/Guardamos los cambios/)
    expect(api.bodies(`PATCH /accounts/${TARJETA.id}`)).toEqual([
      {
        name: 'Tarjeta Órbita',
        institution: 'Banco Andino',
        opening_balance: '820000',
        credit_limit: '6000000',
        statement_day: 28,
        payment_due_day: 5,
      },
    ])
  })

  it('VAL-ACC-07: con movimientos, el saldo inicial no se edita ni se envía', async () => {
    const conMovimientos = { ...NOMINA, has_movements: true }
    const { api } = setup([conMovimientos], {
      [`PATCH /accounts/${NOMINA.id}`]: () => json(200, conMovimientos),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Nómina' }, SLOW))
    const dialog = screen.getByRole('dialog')
    const saldo = within(dialog).getByLabelText('Saldo inicial')
    expect(saldo).toHaveAttribute('readonly')
    expect(saldo).toHaveAccessibleDescription(
      'Esta cuenta ya tiene movimientos. Para corregir el saldo, registra un ajuste.',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText(/Guardamos los cambios/)
    expect(api.bodies(`PATCH /accounts/${NOMINA.id}`)).toEqual([
      { name: 'Nómina', institution: 'Banco Andino' },
    ])
  })

  it('404: cierra el diálogo, avisa y recarga', async () => {
    let gone = false
    mockApi({
      'GET /auth/session': () => json(200, ACTIVE),
      'GET /accounts': () => json(200, { accounts: gone ? [] : [NOMINA], totals: ZERO }),
      [`PATCH /accounts/${NOMINA.id}`]: () => {
        gone = true
        return problem(404, 'account_not_found', 'No encontramos esa cuenta.')
      },
    })
    renderApp('/cuentas')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Nómina' }, SLOW))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos esa cuenta.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Aún no tienes cuentas activas' }),
    ).toBeVisible()
  })
})
