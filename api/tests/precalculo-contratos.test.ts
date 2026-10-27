import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

process.env.ANTICORRUP_DB_PATH = join(mkdtempSync(join(tmpdir(), 'precalculo-test-')), 'test.db')
process.env.CONTRATOS_PRECALCULO_PAUSA_MS = '0'
process.env.CONTRATOS_PRECALCULO_YEARS = '2'

let fallar = false
let llamadas = 0
globalThis.fetch = (async (url: any) => {
  llamadas++
  if (fallar) return new Response('caído', { status: 503 })
  const select = new URL(String(url)).searchParams.get('$select') ?? ''
  if (select.includes('as year')) return Response.json([{ year: '2025' }, { year: '2024' }, { year: '2023' }])
  if (select === 'sector') return Response.json([{ sector: 'defensa' }])
  return Response.json([])
}) as typeof fetch

const { initDb, db } = await import('../src/db/client')
const { precalcularContratos, claveContratos, vistasAPrecalcular } = await import('../src/services/precalculo-contratos')

beforeAll(() => initDb())

describe('precálculo de contratos', () => {
  test('la clave coincide con la que arma el endpoint para la vista que pide el frontend', () => {
    expect(claveContratos({ year: '2024' })).toBe('dashboard:contratos:v1:{"limit":"20","page":"1","year":"2024"}')
    expect(claveContratos({})).toBe('dashboard:contratos:v1:{"limit":"20","page":"1"}')
  })

  test('vistas: sin filtros + últimos años + sectores', () => {
    expect(vistasAPrecalcular({ years: [2025, 2024, 2023], sectores: ['defensa', 'salud'] }))
      .toEqual([{}, { year: '2025' }, { year: '2024' }, { sector: 'defensa' }, { sector: 'salud' }])
  })

  test('guarda cada vista en SQLite y la siguiente pasada no vuelve a llamar a datos.gov.co', async () => {
    const r1 = await precalcularContratos()
    expect(r1).toEqual({ calculadas: 4, vigentes: 0, fallidas: 0 })
    const claves = db.query(`SELECT key FROM dashboard_cache WHERE key LIKE 'dashboard:contratos:v1:%'`).all() as { key: string }[]
    expect(claves.map(c => c.key)).toContain(claveContratos({ sector: 'defensa' }))

    const antes = llamadas
    const r2 = await precalcularContratos()
    expect(r2).toEqual({ calculadas: 0, vigentes: 4, fallidas: 0 })
    expect(llamadas).toBe(antes)
  })

  test('si datos.gov.co falla, la vista vencida no se pierde (queda la copia anterior)', async () => {
    const clave = claveContratos({ year: '2025' })
    db.run(`UPDATE dashboard_cache SET updated_at = 1 WHERE key = ?`, [clave])
    const antes = db.query(`SELECT data FROM dashboard_cache WHERE key = ?`).get(clave) as { data: string }
    fallar = true
    const r = await precalcularContratos()
    fallar = false
    expect(r.calculadas + r.fallidas).toBe(1)
    expect((db.query(`SELECT data FROM dashboard_cache WHERE key = ?`).get(clave) as { data: string }).data).toBe(antes.data)
  })
})
