/**
 * Copia local del registro de proveedores SECOP II (SQLite + FTS5). Sin red.
 */
import { describe, test, expect, beforeAll } from 'bun:test'
import { join } from 'path'
import { mkdtempSync, existsSync } from 'fs'
import { tmpdir } from 'os'

const dir = mkdtempSync(join(tmpdir(), 'proveedores-test-'))
process.env.ANTICORRUP_DB_PATH = join(dir, 'test.db')
process.env.PROVEEDORES_DB_PATH = join(dir, 'proveedores.db')
process.env.PROVEEDORES_PAGE_SIZE = '2'
process.env.PROVEEDORES_MIN_FILAS = '4'

const { initDb } = await import('../src/db/client')
initDb()
const { refrescarProveedores, buscarProveedoresLocal, estadoProveedores } = await import('../src/services/proveedores')
const { buscarPorNombre } = await import('../src/services/buscador')

const FILAS = [
  { nit: '1010154582', nombre: 'DIEGO ARMANDO CANCINO POLO', tipo_empresa: 'Persona Natural colombiana', departamento: 'Córdoba', municipio: 'Montería' },
  { nit: '79223627', nombre: 'Diego José Cancino Obando', tipo_empresa: 'Persona Natural colombiana', departamento: 'Cundinamarca', municipio: 'Soacha' },
  { nit: '8605123303', nombre: 'SERVIENTREGA S.A', tipo_empresa: 'Sociedad Anónima', departamento: 'No Provisto', municipio: 'No Provisto' },
  { nit: '900111222', nombre: 'Construcciones Muñoz y Cía', tipo_empresa: 'Sociedad', departamento: 'Antioquia', municipio: 'Medellín' },
  { nit: '900333444', nombre: 'OTRA EMPRESA SAS', tipo_empresa: 'Sociedad', departamento: 'No Provisto', municipio: 'No Provisto' },
]

let peticiones = 0
let fallar = false
const fetchOriginal = globalThis.fetch
globalThis.fetch = (async (url: any) => {
  const u = String(url)
  if (!u.includes('qmzu-gj57')) return Response.json({ results: {} })
  peticiones++
  if (fallar) return new Response('boom', { status: 500 })
  const offset = Number(new URL(u).searchParams.get('$offset') ?? 0)
  return Response.json(FILAS.slice(offset, offset + 2))
}) as typeof fetch

describe('antes de la primera carga', () => {
  test('sin copia local la búsqueda devuelve null (el llamador usa la consulta en vivo)', () => {
    expect(existsSync(process.env.PROVEEDORES_DB_PATH!)).toBe(false)
    expect(buscarProveedoresLocal(['diego'])).toBeNull()
    expect(estadoProveedores().disponible).toBe(false)
  })
})

describe('refrescarProveedores', () => {
  beforeAll(async () => { expect(await refrescarProveedores()).toBe(5) })

  test('recorre todas las páginas y deja la copia disponible', () => {
    expect(peticiones).toBe(3) // 2 + 2 + 1 filas
    expect(estadoProveedores()).toMatchObject({ disponible: true, filas: 5 })
    expect(existsSync(process.env.PROVEEDORES_DB_PATH + '.tmp')).toBe(false)
  })

  test('encuentra nombres en cualquier orden', () => {
    for (const q of [['diego', 'cancino'], ['cancino', 'diego']]) {
      expect(buscarProveedoresLocal(q)!.map(r => r.nit).sort()).toEqual(['1010154582', '79223627'])
    }
  })

  test('ignora mayúsculas y tildes, y acepta prefijos', () => {
    expect(buscarProveedoresLocal(['munoz'])!.map(r => r.nit)).toEqual(['900111222'])
    expect(buscarProveedoresLocal(['dieg', 'canc'])!).toHaveLength(2)
  })

  test('devuelve ubicación sin los "No Provisto"', () => {
    const [r] = buscarProveedoresLocal(['servientrega'])!
    expect(r).toMatchObject({ nit: '8605123303', ubicacion: '' })
    expect(buscarProveedoresLocal(['soacha'])).toEqual([]) // la ubicación no se indexa como nombre
  })

  test('un nombre inexistente da lista vacía (no null)', () => {
    expect(buscarProveedoresLocal(['zzzinexistente'])).toEqual([])
  })

  test('buscarPorNombre usa la copia local y normaliza el NIT con dígito de verificación', async () => {
    peticiones = 0
    const r = await buscarPorNombre('servientrega')
    expect(r.candidatos.some(c => c.nit === '860512330' && c.fuentes.includes('secop'))).toBe(true)
    expect(peticiones).toBe(0) // no consultó datos.gov.co
  })

  test('una descarga fallida o truncada conserva la copia anterior', async () => {
    fallar = true
    await expect(refrescarProveedores()).rejects.toThrow()
    fallar = false
    expect(estadoProveedores()).toMatchObject({ disponible: true, filas: 5 })
    expect(buscarProveedoresLocal(['diego'])!.length).toBe(2)
    expect(existsSync(process.env.PROVEEDORES_DB_PATH + '.tmp')).toBe(false)
  })
})

globalThis.fetch = globalThis.fetch ?? fetchOriginal
