import { describe, test, expect } from 'bun:test'
import { esBusquedaPorNombre } from '../src/api/client'

describe('esBusquedaPorNombre', () => {
  test('NIT y cédula se consultan por número', () => {
    expect(esBusquedaPorNombre('900073223')).toBe(false)
    expect(esBusquedaPorNombre('79861465')).toBe(false)
  })
  test('texto con letras, tildes o eñes se busca por nombre', () => {
    expect(esBusquedaPorNombre('Servientrega S.A.')).toBe(true)
    expect(esBusquedaPorNombre('Muñoz')).toBe(true)
    expect(esBusquedaPorNombre('Ñ')).toBe(true)
  })
})
