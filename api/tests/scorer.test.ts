/**
 * Tests unitarios del motor de scoring — validan la promesa de la landing:
 * 9 banderas con puntajes exactos, semáforo ROJO/AMARILLO/VERDE,
 * persistencia en SQLite (scores, contratos_cache, FTS5) y caché de inferencia.
 *
 * Socrata y Procuraduría se mockean: aquí se prueba la aritmética, no la red.
 */
import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

// DB temporal ANTES de importar el módulo db/client
const tmpDb = join(mkdtempSync(join(tmpdir(), 'anticorrup-test-')), 'test.db')
process.env.ANTICORRUP_DB_PATH = tmpDb

// ── Mocks ────────────────────────────────────────────────────────────────
let contractsByNit: Record<string, any[]> = {}
let socrataCalls: { dataset: string; params: Record<string, string> }[] = []

mock.module('../src/services/socrata', () => ({
  socrataQuery: async (dataset: string, params: Record<string, string>) => {
    socrataCalls.push({ dataset, params })
    const match = (params['$where'] ?? '').match(/documento_proveedor='([^']+)'/)
    if (match) return contractsByNit[match[1]] ?? []
    return []
  },
}))

let sancionesByNit: Record<string, any> = {}

mock.module('../src/services/procuraduria', () => ({
  checkSanciones: async (nit: string) => sancionesByNit[nit] ?? null,
}))

const { db, initDb } = await import('../src/db/client')
const { scoreNit } = await import('../src/services/scorer')

// ── Helpers ──────────────────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString()

let nitSeq = 0
const freshNit = () => `900${String(++nitSeq).padStart(6, '0')}`

/** Contrato base inofensivo: terminado, bien ejecutado, sin adiciones. */
function contrato(overrides: Record<string, any> = {}) {
  return {
    proveedor_adjudicado: 'CONSTRUCTORA EJEMPLO SAS',
    nombre_entidad: 'ENTIDAD UNICA',
    valor_del_contrato: '10000000',
    valor_facturado: '10000000',
    fecha_de_inicio_del_contrato: iso(-400 * DAY_MS),
    fecha_de_fin_del_contrato: iso(-30 * DAY_MS),
    estado_contrato: 'Terminado',
    sector: 'Transporte',
    dias_adicionados: '0',
    ...overrides,
  }
}

function sanciones(overrides: Record<string, boolean> = {}) {
  return {
    tiene_antecedentes_fiscales: false,
    tiene_antecedentes_disciplinarios: false,
    tiene_multas_secop: false,
    tiene_obras_relacionadas: false,
    total_registros: 0,
    ...overrides,
  }
}

beforeAll(() => {
  initDb()
})

beforeEach(() => {
  contractsByNit = {}
  sancionesByNit = {}
  socrataCalls = []
})

// ── Banderas: puntajes exactos de la promesa ─────────────────────────────
describe('Banderas de riesgo (puntajes de la landing)', () => {
  test('VENCIDOS_SIN_CERRAR: 1 contrato vencido +6 meses en ejecución → +25', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [
      contrato({ estado_contrato: 'En ejecución', fecha_de_fin_del_contrato: iso(-200 * DAY_MS), id_contrato: 'a' }),
    ]
    const r = await scoreNit(nit)
    expect(r.flags).toContain('VENCIDOS_SIN_CERRAR(1)')
    expect(r.score_total).toBe(25)
    expect(r.nivel_riesgo).toBe('VERDE')
  })

  test('VENCIDOS_SIN_CERRAR: 4 vencidos → tope de 75 puntos (25 c/u, máx 75)', async () => {
    const nit = freshNit()
    contractsByNit[nit] = Array.from({ length: 4 }, (_, i) =>
      contrato({ estado_contrato: 'En ejecución', fecha_de_fin_del_contrato: iso(-250 * DAY_MS), id_contrato: `v${i}` }))
    const r = await scoreNit(nit)
    expect(r.flags).toContain('VENCIDOS_SIN_CERRAR(4)')
    expect(r.score_total).toBe(75)
    expect(r.nivel_riesgo).toBe('ROJO')
  })

  test('vencido hace MENOS de 6 meses no cuenta', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [
      contrato({ estado_contrato: 'En ejecución', fecha_de_fin_del_contrato: iso(-60 * DAY_MS), id_contrato: 'a' }),
    ]
    const r = await scoreNit(nit)
    expect(r.flags).toHaveLength(0)
    expect(r.score_total).toBe(0)
  })

  test('EXTENSION_MAYOR_1_ANO: >365 días adicionados → +20', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ dias_adicionados: '400', id_contrato: 'a' })]
    const r = await scoreNit(nit)
    expect(r.flags).toEqual(['EXTENSION_MAYOR_1_ANO'])
    expect(r.score_total).toBe(20)
  })

  test('EXTENSION_MAYOR_1_ANO suprime MULTIPLES_ADICIONES (no doble conteo)', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [
      contrato({ dias_adicionados: '400', id_contrato: 'a' }),
      contrato({ dias_adicionados: '30', id_contrato: 'b' }),
      contrato({ dias_adicionados: '30', id_contrato: 'c' }),
    ]
    const r = await scoreNit(nit)
    expect(r.flags).toEqual(['EXTENSION_MAYOR_1_ANO'])
    expect(r.score_total).toBe(20)
  })

  test('MULTIPLES_ADICIONES: 3+ contratos con adiciones (≤365 días) → +15', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [
      contrato({ dias_adicionados: '30', id_contrato: 'a' }),
      contrato({ dias_adicionados: '60', id_contrato: 'b' }),
      contrato({ dias_adicionados: '90', id_contrato: 'c' }),
    ]
    const r = await scoreNit(nit)
    expect(r.flags).toEqual(['MULTIPLES_ADICIONES(3)'])
    expect(r.score_total).toBe(15)
  })

  test('CONCENTRACION_ENTIDADES: 5 entidades distintas → +10', async () => {
    const nit = freshNit()
    contractsByNit[nit] = Array.from({ length: 5 }, (_, i) =>
      contrato({ nombre_entidad: `ENTIDAD ${i}`, id_contrato: `e${i}` }))
    const r = await scoreNit(nit)
    expect(r.flags).toEqual(['CONCENTRACION_ENTIDADES(5)'])
    expect(r.score_total).toBe(10)
  })

  test('4 entidades distintas no dispara la bandera', async () => {
    const nit = freshNit()
    contractsByNit[nit] = Array.from({ length: 4 }, (_, i) =>
      contrato({ nombre_entidad: `ENTIDAD ${i}`, id_contrato: `e${i}` }))
    const r = await scoreNit(nit)
    expect(r.flags).toHaveLength(0)
  })

  test('BAJA_EJECUCION: terminado, facturado <50%, valor >$5M → +15', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [
      contrato({ valor_del_contrato: '100000000', valor_facturado: '20000000', estado_contrato: 'Terminado', id_contrato: 'a' }),
    ]
    const r = await scoreNit(nit)
    expect(r.flags).toEqual(['BAJA_EJECUCION(1)'])
    expect(r.score_total).toBe(15)
  })

  test('BAJA_EJECUCION no aplica a contratos ≤ $5M (piso documentado)', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [
      contrato({ valor_del_contrato: '4000000', valor_facturado: '100000', estado_contrato: 'Terminado', id_contrato: 'a' }),
    ]
    const r = await scoreNit(nit)
    expect(r.flags).toHaveLength(0)
  })

  test('SANCIONADO_DISCIPLINARIO (+30), RESPONSABILIDAD_FISCAL (+25) y MULTA_SECOP (+15) suman 70', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ id_contrato: 'a' })]
    sancionesByNit[nit] = sanciones({
      tiene_antecedentes_disciplinarios: true,
      tiene_antecedentes_fiscales: true,
      tiene_multas_secop: true,
    })
    const r = await scoreNit(nit)
    expect(r.flags).toEqual(expect.arrayContaining(['SANCIONADO_DISCIPLINARIO', 'RESPONSABILIDAD_FISCAL', 'MULTA_SECOP']))
    expect(r.score_total).toBe(70)
    expect(r.nivel_riesgo).toBe('ROJO')
    expect(r.sancionado_paco).toBe(true)

    // sancionado_paco sobrevive al caché SQLite (se reconstruye desde las flags)
    const cached = await scoreNit(nit)
    expect(cached.sancionado_paco).toBe(true)
  })

  test('ANOMALIA_ESTADISTICA: score −0.5 → +30 (máximo)', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ id_contrato: 'a' })]
    db.prepare(`INSERT OR REPLACE INTO anomaly_scores (nit, sector, anomaly_score, features) VALUES (?, ?, ?, ?)`)
      .run(nit, 'Transporte', -0.5, '{}')
    const r = await scoreNit(nit)
    expect(r.flags).toEqual(['ANOMALIA_ESTADISTICA(-0.50)'])
    expect(r.score_total).toBe(30)
  })

  test('ANOMALIA_ESTADISTICA: score −0.275 → +15 (mitad del rango lineal)', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ id_contrato: 'a' })]
    db.prepare(`INSERT OR REPLACE INTO anomaly_scores (nit, sector, anomaly_score, features) VALUES (?, ?, ?, ?)`)
      .run(nit, 'Transporte', -0.275, '{}')
    const r = await scoreNit(nit)
    expect(r.score_total).toBe(15)
  })

  test('anomaly score en el umbral (−0.05) o mejor NO genera bandera', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ id_contrato: 'a' })]
    db.prepare(`INSERT OR REPLACE INTO anomaly_scores (nit, sector, anomaly_score, features) VALUES (?, ?, ?, ?)`)
      .run(nit, 'Transporte', -0.05, '{}')
    const r = await scoreNit(nit)
    expect(r.flags).toHaveLength(0)
  })
})

// ── Semáforo: fronteras de la promesa ────────────────────────────────────
describe('Semáforo de riesgo (ROJO >60, AMARILLO 30–60, VERDE <30)', () => {
  test('score 25 → VERDE', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [
      contrato({ estado_contrato: 'En ejecución', fecha_de_fin_del_contrato: iso(-200 * DAY_MS), id_contrato: 'a' }),
    ]
    expect((await scoreNit(nit)).nivel_riesgo).toBe('VERDE')
  })

  test('score exactamente 30 → AMARILLO (frontera inferior)', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ id_contrato: 'a' })]
    sancionesByNit[nit] = sanciones({ tiene_antecedentes_disciplinarios: true }) // +30
    expect((await scoreNit(nit)).nivel_riesgo).toBe('AMARILLO')
  })

  test('score exactamente 60 → AMARILLO (frontera superior)', async () => {
    const nit = freshNit()
    // 25 (1 vencido) + 20 (extensión) + 15 (multa) = 60
    contractsByNit[nit] = [
      contrato({ estado_contrato: 'En ejecución', fecha_de_fin_del_contrato: iso(-200 * DAY_MS), dias_adicionados: '400', id_contrato: 'a' }),
    ]
    sancionesByNit[nit] = sanciones({ tiene_multas_secop: true })
    const r = await scoreNit(nit)
    expect(r.score_total).toBe(60)
    expect(r.nivel_riesgo).toBe('AMARILLO')
  })

  test('score 61+ → ROJO', async () => {
    const nit = freshNit()
    // 25 + 20 + 25 (fiscal) = 70
    contractsByNit[nit] = [
      contrato({ estado_contrato: 'En ejecución', fecha_de_fin_del_contrato: iso(-200 * DAY_MS), dias_adicionados: '400', id_contrato: 'a' }),
    ]
    sancionesByNit[nit] = sanciones({ tiene_antecedentes_fiscales: true })
    const r = await scoreNit(nit)
    expect(r.score_total).toBe(70)
    expect(r.nivel_riesgo).toBe('ROJO')
  })

  test('NIT sin contratos → score 0, VERDE, sin banderas', async () => {
    const nit = freshNit()
    const r = await scoreNit(nit)
    expect(r).toMatchObject({ score_total: 0, nivel_riesgo: 'VERDE', flags: [] })
  })
})

// ── Persistencia SQLite (inferencia rápida) ──────────────────────────────
describe('Persistencia en SQLite', () => {
  test('scoreNit guarda el score y los contratos crudos en la DB', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [
      contrato({ id_contrato: 'c1', objeto_del_contrato: 'Mantenimiento vial rural' }),
      contrato({ id_contrato: 'c2' }),
    ]
    await scoreNit(nit)

    const scoreRow = db.query<any, [string]>(`SELECT * FROM scores WHERE nit = ?`).get(nit)
    expect(scoreRow).not.toBeNull()
    expect(scoreRow.nombre).toBe('CONSTRUCTORA EJEMPLO SAS')
    expect(() => JSON.parse(scoreRow.flags)).not.toThrow()

    const cached = db.query<any, [string]>(`SELECT * FROM contratos_cache WHERE nit = ?`).all(nit)
    expect(cached).toHaveLength(2)
    const raw = JSON.parse(cached[0].raw_json)
    expect(raw.proveedor_adjudicado).toBe('CONSTRUCTORA EJEMPLO SAS')
  })

  test('FTS5: el nombre del contratista es buscable en scores_fts tras el scoring', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ proveedor_adjudicado: 'FERROCARRILES ANDINOS ZETA', id_contrato: 'a' })]
    await scoreNit(nit)
    const hits = db.query<any, [string]>(
      `SELECT nit FROM scores_fts WHERE scores_fts MATCH ?`
    ).all('FERROCARRILES')
    expect(hits.map(h => h.nit)).toContain(nit)
  })
})

// ── Caché de inferencia (TTL 1h en tabla scores) ─────────────────────────
describe('Caché de scoring', () => {
  test('segunda llamada dentro del TTL no consulta Socrata (lee de SQLite)', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ id_contrato: 'a' })]

    const first = await scoreNit(nit)
    const callsAfterFirst = socrataCalls.length
    const second = await scoreNit(nit)

    expect(socrataCalls.length).toBe(callsAfterFirst) // 0 llamadas nuevas
    expect(second.score_total).toBe(first.score_total)
    expect(second.nivel_riesgo).toBe(first.nivel_riesgo)
  })

  test('tras borrar el score (path refresh=1) se recalcula contra Socrata', async () => {
    const nit = freshNit()
    contractsByNit[nit] = [contrato({ id_contrato: 'a' })]

    await scoreNit(nit)
    const callsAfterFirst = socrataCalls.length
    db.prepare(`DELETE FROM scores WHERE nit = ?`).run(nit)
    await scoreNit(nit)

    expect(socrataCalls.length).toBeGreaterThan(callsAfterFirst)
  })
})
