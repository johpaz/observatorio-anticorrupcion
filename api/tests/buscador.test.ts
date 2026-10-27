/**
 * Búsqueda de contratistas por nombre o razón social: usa solo bases locales (copia SQLite del
 * registro de proveedores, scores) y el servicio de sanciones. Nunca consulta datos.gov.co al buscar.
 */
import { describe, test, expect } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

const dir = mkdtempSync(join(tmpdir(), 'buscador-test-'))
process.env.ANTICORRUP_DB_PATH = join(dir, 'test.db')
process.env.PROVEEDORES_DB_PATH = join(dir, 'proveedores.db')
process.env.PROVEEDORES_PAGE_SIZE = '10'
process.env.PROVEEDORES_MIN_FILAS = '2'
process.env.PROCURADURIA_URL = 'http://procuraduria.test'

const { initDb, db } = await import('../src/db/client')
initDb()
const { buscarPorNombre, nitSinDv, esNombre } = await import('../src/services/buscador')
const { refrescarProveedores } = await import('../src/services/proveedores')

const PROVEEDORES = [
  { nit: '8605123303', nombre: 'SERVIENTREGA S.A', tipo_empresa: 'Sociedad Anónima Cerrada Colombiana', departamento: 'Bogotá', municipio: 'No Provisto' },
  { nit: '1043027974', nombre: 'Juan Francisco Perez', tipo_empresa: 'Persona Natural colombiana', departamento: 'No Provisto', municipio: 'No Provisto' },
]

let procuraduriaOk = true
let consultasDatosGov = 0
globalThis.fetch = (async (url: any) => {
  const u = String(url)
  if (u.includes('datos.gov.co')) {
    consultasDatosGov++
    return Response.json(PROVEEDORES) // solo lo usa la carga del registro, nunca la búsqueda
  }
  if (u.startsWith('http://procuraduria.test')) {
    if (!procuraduriaOk) return new Response('boom', { status: 500 })
    return Response.json({ results: {
      fiscales: [{ nombre: 'SERVIENTREGA SA', documento: '860512330' }],
      disciplinarios: [], multas: [], obras: [],
    } })
  }
  return Response.json([])
}) as typeof fetch

describe('helpers', () => {
  test('esNombre distingue números de texto', () => {
    expect(esNombre('900073223')).toBe(false)
    expect(esNombre('Servientrega SA')).toBe(true)
  })
  test('nitSinDv quita el dígito de verificación solo a empresas', () => {
    expect(nitSinDv('8605123303', 'Sociedad Anónima')).toBe('860512330')
    expect(nitSinDv('1043027974', 'Persona Natural colombiana')).toBe('1043027974')
    expect(nitSinDv('79861465', '')).toBe('79861465')
  })
})

describe('antes de que exista la copia local del registro', () => {
  test('SECOP se marca como fuente no disponible y las demás igual responden, sin ir a datos.gov.co', async () => {
    consultasDatosGov = 0
    const r = await buscarPorNombre('servientrega')
    expect(r.fuentes_fallidas).toEqual(['secop'])
    expect(r.candidatos.map(c => c.nit)).toEqual(['860512330']) // desde sanciones
    expect(consultasDatosGov).toBe(0)
  })
})

describe('buscarPorNombre con la copia local cargada', () => {
  test('une registro de proveedores y sanciones por NIT normalizado y prioriza quien tiene antecedentes', async () => {
    await refrescarProveedores()
    consultasDatosGov = 0
    const r = await buscarPorNombre('servientrega')
    const s = r.candidatos.find(c => c.nit === '860512330')!
    expect(s.fuentes.sort()).toEqual(['sanciones', 'secop'])
    expect(s.sanciones).toEqual(['Responsabilidad fiscal'])
    expect(r.candidatos[0].nit).toBe('860512330')
    expect(r.fuentes_fallidas).toEqual([])
    expect(consultasDatosGov).toBe(0) // buscar no toca datos.gov.co
  })

  test('si sanciones falla devuelve las demás fuentes y la marca como fallida', async () => {
    procuraduriaOk = false
    const r = await buscarPorNombre('servientrega')
    procuraduriaOk = true
    expect(r.fuentes_fallidas).toEqual(['sanciones'])
    expect(r.candidatos.length).toBeGreaterThan(0)
  })

  test('encuentra contratistas ya calculados en la tabla scores', async () => {
    db.prepare(`INSERT INTO scores (nit, nombre, score_total, nivel_riesgo, flags, sector) VALUES (?,?,?,?,?,?)`)
      .run('900111222', 'Constructora Andina Ltda', 72, 'ROJO', '[]', 'Transporte')
    const r = await buscarPorNombre('andina constructora')
    expect(r.candidatos.some(c => c.nit === '900111222' && c.nivel_riesgo === 'ROJO')).toBe(true)
  })
})
