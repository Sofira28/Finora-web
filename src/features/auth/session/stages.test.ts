import { describe, expect, it } from 'vitest'

import { safeRedirect } from './stages.ts'

describe('safeRedirect', () => {
  it.each(['/', '/perfil', '/perfil?reauth=ok#seguridad'])('acepta la ruta interna %s', (ruta) => {
    expect(safeRedirect(ruta)).toBe(ruta)
  })

  it.each([
    undefined,
    42,
    '',
    'perfil',
    'https://sitio.malo',
    '//sitio.malo',
    '/\\sitio.malo',
    '/\\/sitio.malo',
    '/\t/sitio.malo',
    '/perfil\n',
  ])('rechaza %j y vuelve al inicio', (valor) => {
    expect(safeRedirect(valor)).toBe('/')
  })
})
