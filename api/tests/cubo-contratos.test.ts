import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

process.env.ANTICORRUP_DB_PATH = join(mkdtempSync(join(tmpdir(), 'cubo-test-')), 'test.db')
process.env.CUBO_REINTENTO_MS = '0'

const fila = (mes: string | null, departamento: string, sector: string, tipo: string, estado: string, n: number, nv: number, v: number) =>
  ({ ...(mes ? { mes: `${mes}-01T00:00:00.000` } : {}), departamento, sector, tipo_de_contrato: tipo, estado_contrato: estado, n: String(n), nv: String(nv), v: String(v) })
const CUBO: Record<string, any[]> = {
  '2025': [fila('2025-01', 'Bogotá', 'defensa', 'Prestación', 'Liquidado', 2, 2, 300), fila('2025-05', 'Antioquia', 'salud', 'Obra', 'En ejecución', 1, 1, 100)],
  '2024': [fila('2024-02', 'Bogotá', 'defensa', 'Prestación', 'Liquidado', 4, 3, 400)],
  sinfecha: [fila(null, 'Bogotá', 'defensa', 'Prestación', 'Liquidado', 1, 1, 50)],
}
let llamadas = 0
let caido = false
globalThis.fetch = (async (url: any) => {
  llamadas++
  if (caido) return new Response('caído', { status: 503 })
  const q = new URL(String(url)).searchParams
  const select = q.get('$select') ?? ''
  if (select.startsWith('date_extract_y(fecha_de_firma) as y')) return Response.json([{ y: '2025', n: '3' }, { y: '2024', n: '4' }, { n: '1' }])
  const where = q.get('$where') ?? ''
  if (where.includes('IS NULL')) return Response.json(CUBO.sinfecha)
  return Response.json(CUBO[where.match(/= (\d{4})/)![1]] ?? [])
}) as typeof fetch

const { initDb, db } = await import('../src/db/client')
const { cuboListo, refrescarCubo, agregadosLocales, metadataLocal } = await import('../src/services/cubo-contratos')

beforeAll(() => initDb())

describe('cubo local de contratos', () => {
  test('sin descargar no responde (el dashboard sigue usando datos.gov.co)', () => {
    expect(cuboListo()).toBe(false)
    expect(agregadosLocales({})).toBeNull()
  })

  test('descarga cada año y la segunda pasada no vuelve a llamar', async () => {
    const r = await refrescarCubo()
    expect(r.actualizados.sort()).toEqual([0, 2024, 2025])
    const antes = llamadas
    const r2 = await refrescarCubo()
    expect(r2.vigentes).toBe(3)
    expect(llamadas).toBe(antes + 1) // solo la consulta de años
  })

  test('sin filtros suma todo, incluidos los contratos sin fecha; el promedio ignora valores nulos', () => {
    const a = agregadosLocales({})!
    expect(a.kpis).toEqual({ total: '8', valor_total: '850', valor_promedio: String(850 / 7) })
    expect(a.porSector[0]).toEqual({ sector: 'defensa', total: '7', valor_total: '750' })
  })

  test('filtros de año, trimestre, sector y estado se resuelven en SQLite', () => {
    expect(agregadosLocales({ year: '2025' })!.kpis.total).toBe('3')
    expect(agregadosLocales({ year: '2025', quarter: '2' })!.kpis).toMatchObject({ total: '1', valor_total: '100' })
    expect(agregadosLocales({ quarter: '1' })!.kpis.total).toBe('6')
    expect(agregadosLocales({ sector: 'salud' })!.porDepto).toEqual([{ departamento: 'Antioquia', total: '1', valor_total: '100' }])
    expect(agregadosLocales({ estado_contrato: 'Liquidado', year: '2024' })!.kpis.total).toBe('4')
    expect(agregadosLocales({ year: '2025' })!.porMes.map((m: any) => m.mes.slice(0, 7))).toEqual(['2025-01', '2025-05'])
    expect(agregadosLocales({ year: '2025' })!.porTipo.map((t: any) => t.tipo_de_contrato)).toEqual(['Prestación', 'Obra'])
  })

  test('metadata de filtros sale del cubo', () => {
    expect(metadataLocal()).toEqual({
      years: [2025, 2024], departamentos: ['Antioquia', 'Bogotá'], sectores: ['defensa', 'salud'],
      tipos: ['Obra', 'Prestación'], estados: ['En ejecución', 'Liquidado'],
    })
  })

  test('si datos.gov.co cae al actualizar, se conservan los datos', async () => {
    db.run(`UPDATE cubo_meta SET actualizado_at = 1`)
    caido = true
    const r = await refrescarCubo()
    caido = false
    expect(r.actualizados).toEqual([])
    expect(agregadosLocales({})!.kpis.total).toBe('8')
  })
})
