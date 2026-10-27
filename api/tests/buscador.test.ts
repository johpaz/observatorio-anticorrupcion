/**
 * Búsqueda de contratistas por nombre o razón social: normalización de NIT,
 * fusión de fuentes y tolerancia a que una de ellas falle. Sin red.
 */
import { describe, test, expect } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

process.env.ANTICORRUP_DB_PATH = join(mkdtempSync(join(tmpdir(), 'buscador-test-')), 'test.db')
process.env.PROCURADURIA_URL = 'http://procuraduria.test'

const { initDb, db } = await import('../src/db/client')
initDb()
const { buscarPorNombre, nitSinDv, esNombre } = await import('../src/services/buscador')

let procuraduriaOk = true
globalThis.fetch = (async (url: any) => {
  const u = String(url)
  if (u.includes('qmzu-gj57')) {
    return Response.json([
      { nit: '8605123303', nombre: 'SERVIENTREGA S.A', tipo_empresa: 'Sociedad Anónima Cerrada Colombiana', departamento: 'Bogotá', municipio: 'No Provisto' },
      { nit: '1043027974', nombre: 'Juan Francisco Perez', tipo_empresa: 'Persona Natural colombiana', departamento: 'No Provisto', municipio: 'No Provisto' },
    ])
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

describe('buscarPorNombre', () => {
  test('une SECOP y sanciones por NIT normalizado y prioriza quien tiene antecedentes', async () => {
    const r = await buscarPorNombre('servientrega')
    const s = r.candidatos.find(c => c.nit === '860512330')!
    expect(s.fuentes.sort()).toEqual(['sanciones', 'secop'])
    expect(s.sanciones).toEqual(['Responsabilidad fiscal'])
    expect(r.candidatos[0].nit).toBe('860512330')
    expect(r.fuentes_fallidas).toEqual([])
  })

  test('si sanciones falla devuelve las demás fuentes y la marca como fallida', async () => {
    procuraduriaOk = false
    const r = await buscarPorNombre('servientrega')
    procuraduriaOk = true
    expect(r.fuentes_fallidas).toEqual(['sanciones'])
    expect(r.candidatos.length).toBeGreaterThan(0)
  })

  test('si SECOP no responde a tiempo, la búsqueda igual responde y marca la fuente como fallida', async () => {
    process.env.BUSQUEDA_TIMEOUT_MS = '50'
    const previo = globalThis.fetch
    globalThis.fetch = (async (url: any) => {
      if (String(url).includes('qmzu-gj57')) return new Promise<Response>(() => {}) // nunca responde
      return previo(url)
    }) as typeof fetch
    const { buscarPorNombre: buscar } = await import('../src/services/buscador?timeout')
    const t0 = Date.now()
    const r = await buscar('diego cancino')
    globalThis.fetch = previo
    delete process.env.BUSQUEDA_TIMEOUT_MS
    expect(Date.now() - t0).toBeLessThan(2_000)
    expect(r.fuentes_fallidas).toContain('secop')
  })

  test('encuentra contratistas ya calculados en la tabla scores', async () => {
    db.prepare(`INSERT INTO scores (nit, nombre, score_total, nivel_riesgo, flags, sector) VALUES (?,?,?,?,?,?)`)
      .run('900111222', 'Constructora Andina Ltda', 72, 'ROJO', '[]', 'Transporte')
    const r = await buscarPorNombre('andina constructora')
    expect(r.candidatos.some(c => c.nit === '900111222' && c.nivel_riesgo === 'ROJO')).toBe(true)
  })
})
