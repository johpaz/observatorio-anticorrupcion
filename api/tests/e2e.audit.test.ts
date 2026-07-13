/**
 * AUDITORÍA E2E — valida la promesa completa de la landing contra servicios reales:
 *
 *   1. Ingestión desde todas las APIs (Socrata/datos.gov.co en vivo + Procuraduría local seedeada)
 *   2. Scoring correcto (la aritmética de las 9 banderas y el semáforo)
 *   3. Persistencia en SQLite para inferencia rápida (scores, contratos_cache, anomaly_scores)
 *   4. Caché: segunda consulta servida desde SQLite, refresh recalcula
 *   5. Pipeline ML real (Isolation Forest vía venv) cuando hay suficientes NITs
 *   6. Contrato de datos exacto que consume la UI
 *
 * Requiere: internet (datos.gov.co) y data.db de Procuraduría seedeada (bun run seed).
 * Levanta ambos servicios en puertos de prueba con DBs aisladas — no toca anticorrup.db.
 *
 * Ejecutar con: bun run test:e2e
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { join } from 'path'
import { mkdtempSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { Database } from 'bun:sqlite'

const ROOT = join(import.meta.dir, '../..')
const PROCU_DIR = join(ROOT, 'APi Procuraduria, multas, sanciones y obras inconclusas')
// Puertos aleatorios: corridas consecutivas no chocan con servidores que aún se apagan
const PROCU_PORT = 3100 + Math.floor(Math.random() * 400) * 2
const API_PORT = PROCU_PORT + 1
const API = `http://localhost:${API_PORT}`
const PROCU = `http://localhost:${PROCU_PORT}`
const SECTOR = 'Transporte'
const LIMIT = 10

// ── Precondiciones (evaluadas antes de definir los tests) ────────────────
// Doble sonda: conectividad simple + salud del motor de agregados de Socrata.
// Los agregados (count/sum/group) se degradan de forma independiente; si están
// caídos, la ingesta es imposible y la suite debe marcar skip, no rojo falso.
async function probeInternet(): Promise<boolean> {
  try {
    const simple = await fetch('https://www.datos.gov.co/resource/jbjy-vk9h.json?$limit=1', {
      signal: AbortSignal.timeout(10_000),
    })
    if (!simple.ok) return false

    const agg = await fetch(
      'https://www.datos.gov.co/resource/jbjy-vk9h.json?' +
        new URLSearchParams({
          $select: 'date_extract_y(fecha_de_firma) as anio, count(*) as total',
          $group: 'anio',
          $limit: '50',
        }),
      { signal: AbortSignal.timeout(45_000) },
    )
    if (!agg.ok) console.warn('⚠ Motor de agregados de Socrata degradado — e2e en skip')
    return agg.ok
  } catch {
    return false
  }
}

const online = await probeInternet()
const seeded = existsSync(join(PROCU_DIR, 'data.db'))
const venvPython = join(ROOT, '.venv/bin/python3')
const hasVenv = existsSync(venvPython)

if (!online) console.warn('⚠ Sin acceso a datos.gov.co — tests e2e marcados como skip')
if (!seeded) console.warn('⚠ data.db de Procuraduría no existe — corre `bun run seed` primero')

const run = test.skipIf(!online || !seeded)

// ── Infraestructura: ambos servicios con DBs aisladas ────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'audit-e2e-'))
const apiDbPath = join(tmp, 'anticorrup.db')
const procuDbPath = join(tmp, 'procu-data.db')

let procuProc: ReturnType<typeof Bun.spawn> | null = null
let apiProc: ReturnType<typeof Bun.spawn> | null = null

async function waitFor(url: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) })
      if (res.ok) return
    } catch { /* aún no arriba */ }
    await Bun.sleep(300)
  }
  throw new Error(`Servicio no respondió a tiempo: ${url}`)
}

beforeAll(async () => {
  if (!online || !seeded) return

  // Snapshot de la data.db real (VACUUM INTO incluye el WAL pendiente):
  // los tests pueden insertar fixtures sin ensuciar la original
  const src = new Database(join(PROCU_DIR, 'data.db'), { readonly: true })
  src.run(`VACUUM INTO '${procuDbPath.replace(/'/g, "''")}'`)
  src.close()

  // stderr en 'inherit': un pipe sin lector se llena y bloquea el proceso hijo
  procuProc = Bun.spawn(['bun', 'src/index.ts'], {
    cwd: PROCU_DIR,
    env: { ...Bun.env, PORT: String(PROCU_PORT), DATA_DB_PATH: procuDbPath },
    stdout: 'ignore',
    stderr: 'inherit',
  })

  apiProc = Bun.spawn(['bun', 'src/index.ts'], {
    cwd: join(ROOT, 'api'),
    env: {
      ...Bun.env,
      PORT: String(API_PORT),
      ANTICORRUP_DB_PATH: apiDbPath,
      PROCURADURIA_URL: PROCU,
      PYTHON_BIN: hasVenv ? venvPython : 'python3',
      CACHE_TTL: '300',
      ALERTAS_WARMUP: '0', // el precálculo interferiría con la aserción de DB vacía
    },
    stdout: 'ignore',
    stderr: 'inherit',
  })

  await waitFor(`${PROCU}/`)
  await waitFor(`${API}/health`)
}, 60_000)

afterAll(() => {
  apiProc?.kill()
  procuProc?.kill()
})

// ── Puntos por bandera, según la promesa publicada en la landing ─────────
function expectedPoints(flag: string): number {
  const n = Number(flag.match(/\((-?[\d.]+)\)/)?.[1] ?? NaN)
  if (flag.startsWith('VENCIDOS_SIN_CERRAR')) return Math.min(n * 25, 75)
  if (flag.startsWith('EXTENSION_MAYOR_1_ANO')) return 20
  if (flag.startsWith('MULTIPLES_ADICIONES')) return 15
  if (flag.startsWith('CONCENTRACION_ENTIDADES')) return 10
  if (flag.startsWith('BAJA_EJECUCION')) return 15
  if (flag.startsWith('SANCIONADO_DISCIPLINARIO')) return 30
  if (flag.startsWith('RESPONSABILIDAD_FISCAL')) return 25
  if (flag.startsWith('MULTA_SECOP')) return 15
  if (flag.startsWith('ANOMALIA_ESTADISTICA')) return Math.min(Math.round((-n - 0.05) / 0.45 * 30), 30)
  throw new Error(`Bandera desconocida (no está en la promesa de la landing): ${flag}`)
}

function nivelFromScore(score: number): string {
  if (score > 60) return 'ROJO'
  if (score >= 30) return 'AMARILLO'
  return 'VERDE'
}

// ── La auditoría ─────────────────────────────────────────────────────────
let batch: any = null
let coldMs = 0

describe('Auditoría E2E de la promesa', () => {
  run('las fuentes están vivas: Procuraduría seedeada y Socrata accesible', async () => {
    // Heartbeat del frontend: /api/health debe existir bajo el prefijo proxeado
    const health = await fetch(`${API}/api/health`)
    expect(health.ok).toBe(true)

    const stats = await (await fetch(`${PROCU}/stats`)).json()
    expect(stats.totales.disciplinarios).toBeGreaterThan(1000) // SIRI real
    expect(stats.totales.fiscales).toBeGreaterThan(1000)       // CGR real
    expect(stats.totales.multas_secop).toBeGreaterThan(100)    // multas SECOP reales
  }, 30_000)

  run('ingestión: el batch de alertas se alimenta de Socrata y puebla SQLite desde cero', async () => {
    const dbBefore = new Database(apiDbPath, { readonly: true })
    const before = dbBefore.query<{ c: number }, []>(`SELECT COUNT(*) c FROM scores`).get()!.c
    dbBefore.close()
    expect(before).toBe(0) // la DB de prueba nace vacía

    const t0 = performance.now()
    const res = await fetch(`${API}/api/alertas?sector=${SECTOR}&limit=${LIMIT}`)
    coldMs = performance.now() - t0
    expect(res.ok).toBe(true)
    batch = await res.json()

    expect(batch.cached).toBe(false)
    expect(batch.scores.length).toBeGreaterThan(0)

    const db = new Database(apiDbPath, { readonly: true })
    const scoresCount = db.query<{ c: number }, []>(`SELECT COUNT(*) c FROM scores`).get()!.c
    const contratosCount = db.query<{ c: number }, []>(`SELECT COUNT(*) c FROM contratos_cache`).get()!.c
    db.close()

    expect(scoresCount).toBe(new Set(batch.scores.map((s: any) => s.nit)).size)
    expect(contratosCount).toBeGreaterThan(0)
    console.log(`   → ingesta: ${scoresCount} scores, ${contratosCount} contratos cacheados en ${(coldMs / 1000).toFixed(1)}s`)
  }, 120_000)

  run('contrato de datos: cada score cumple la forma exacta que consume la UI (ScoreResult)', () => {
    for (const s of batch.scores) {
      expect(typeof s.nit).toBe('string')
      expect(typeof s.nombre).toBe('string')
      expect(typeof s.score_total).toBe('number')
      expect(['ROJO', 'AMARILLO', 'VERDE']).toContain(s.nivel_riesgo)
      expect(Array.isArray(s.flags)).toBe(true)
      for (const f of s.flags) expect(typeof f).toBe('string')
      expect(typeof s.sancionado_paco).toBe('boolean')
    }
  })

  run('aritmética: score_total ≡ suma de los puntos prometidos por cada bandera', () => {
    for (const s of batch.scores) {
      const expected = s.flags.reduce((acc: number, f: string) => acc + expectedPoints(f), 0)
      const tolerance = s.flags.some((f: string) => f.startsWith('ANOMALIA')) ? 1 : 0
      expect(Math.abs(s.score_total - expected)).toBeLessThanOrEqual(tolerance)
      expect(s.nivel_riesgo).toBe(nivelFromScore(s.score_total))
    }
  })

  run('caché SQLite: la segunda consulta se sirve de la DB (cached=true) y en milisegundos', async () => {
    const t0 = performance.now()
    const res = await fetch(`${API}/api/alertas?sector=${SECTOR}&limit=${LIMIT}`)
    const warmMs = performance.now() - t0
    const warm = await res.json()

    expect(warm.cached).toBe(true)
    const uniq = (arr: any[]) => [...new Set(arr.map((s: any) => s.nit))].sort()
    expect(uniq(warm.scores)).toEqual(uniq(batch.scores))
    expect(warmMs).toBeLessThan(500)
    expect(warmMs).toBeLessThan(coldMs / 10)
    console.log(`   → frío: ${(coldMs / 1000).toFixed(1)}s · caché: ${warmMs.toFixed(0)}ms`)
  }, 30_000)

  run('pipeline ML: Isolation Forest escribió anomaly_scores y los outliers llevan su bandera', () => {
    const db = new Database(apiDbPath, { readonly: true })
    const anomalias = db.query<{ nit: string; anomaly_score: number }, [string]>(
      `SELECT nit, anomaly_score FROM anomaly_scores WHERE sector = ?`
    ).all(SECTOR)

    if (!hasVenv) {
      // Sin venv el sistema degrada sin romperse: no hay filas nuevas pero el batch funcionó
      console.warn('   → sin venv: se valida solo la degradación elegante')
      db.close()
      return
    }

    expect(anomalias.length).toBeGreaterThanOrEqual(5) // MIN_NITS del script

    const outliers = anomalias.filter(a => a.anomaly_score < -0.05)
    for (const o of outliers) {
      const row = db.query<{ flags: string }, [string]>(`SELECT flags FROM scores WHERE nit = ?`).get(o.nit)
      if (!row) continue
      expect(JSON.parse(row.flags).some((f: string) => f.startsWith('ANOMALIA_ESTADISTICA'))).toBe(true)
    }
    db.close()
    console.log(`   → ML: ${anomalias.length} NITs evaluados, ${outliers.length} outliers con bandera`)
  })

  run('sanciones reales: una multa en la base de Procuraduría se refleja como bandera del NIT', async () => {
    const nit = batch.scores[0].nit
    const before = await (await fetch(`${API}/api/contratista/${nit}`)).json()

    // Inyecta una multa para ese NIT en la copia de data.db (la real no se toca)
    const procuDb = new Database(procuDbPath)
    procuDb.run(
      `INSERT INTO multas_secop (entidad, nombre_responsable, cedula_responsable, valor_multa)
       VALUES ('ENTIDAD AUDITORIA E2E', ?, ?, 9999999)`,
      [before.nombre, nit],
    )
    procuDb.close()

    // La otra API debe reportarla…
    const persona = await (await fetch(`${PROCU}/persona/${nit}`)).json()
    expect(persona.resumen.tiene_multas_secop).toBe(true)

    // …y el scoring debe recogerla al refrescar: +15 y bandera MULTA_SECOP
    const after = await (await fetch(`${API}/api/contratista/${nit}?refresh=1`)).json()
    expect(after.flags).toContain('MULTA_SECOP')
    expect(after.sancionado_paco).toBe(true)
    const beforeSinMulta = before.flags.includes('MULTA_SECOP') ? before.score_total - 15 : before.score_total
    expect(after.score_total).toBeGreaterThanOrEqual(beforeSinMulta + 15)

    // …y el detalle de la sanción debe viajar hasta la UI
    expect(after.sanciones?.resumen?.tiene_multas_secop).toBe(true)
    expect(after.sanciones.multas.some((m: any) => m.entidad === 'ENTIDAD AUDITORIA E2E')).toBe(true)
  }, 120_000)

  run('perfil de contratista: devuelve hasta 20 contratos desde contratos_cache', async () => {
    const nit = batch.scores[0].nit
    const perfil = await (await fetch(`${API}/api/contratista/${nit}`)).json()
    expect(Array.isArray(perfil.contratos)).toBe(true)
    expect(perfil.contratos.length).toBeGreaterThan(0)
    expect(perfil.contratos.length).toBeLessThanOrEqual(20)
    for (const c of perfil.contratos) {
      expect(c).toHaveProperty('entidad')
      expect(c).toHaveProperty('valor')
      expect(c).toHaveProperty('estado')
    }
  }, 60_000)

  run('KPIs globales del hero: /api/contratos/kpis sin filtros responde con totales reales', async () => {
    const res = await fetch(`${API}/api/contratos/kpis`)
    expect(res.ok).toBe(true)
    const kpis = await res.json()
    expect(Number(kpis.total)).toBeGreaterThan(1_000_000)   // millones de contratos SECOP II
    expect(Number(kpis.valor_total)).toBeGreaterThan(1e12)  // billones de COP
  }, 60_000)

  run('/api/alertas/stats: los agregados del hero coinciden con la tabla scores', async () => {
    const stats = await (await fetch(`${API}/api/alertas/stats`)).json()
    const db = new Database(apiDbPath, { readonly: true })
    const total = db.query<{ c: number }, []>(`SELECT COUNT(*) c FROM scores`).get()!.c
    const rojos = db.query<{ c: number }, []>(`SELECT COUNT(*) c FROM scores WHERE nivel_riesgo='ROJO'`).get()!.c
    db.close()
    expect(stats.total).toBe(total)
    expect(stats.rojos).toBe(rojos)
    expect(stats.total).toBe(stats.rojos + stats.amarillos + stats.verdes)
  })

  run('sectores dinámicos: /api/alertas/sectores refleja el dataset real (sin "No aplica")', async () => {
    const res = await fetch(`${API}/api/alertas/sectores`)
    expect(res.ok).toBe(true)
    const { sectores } = await res.json()
    expect(sectores.length).toBeGreaterThan(6)          // más que la lista quemada original
    expect(sectores).toContain('Transporte')
    expect(sectores.some((s: string) => /no aplica/i.test(s))).toBe(false)
  }, 60_000)

  run('desglose dimensional: /api/alertas/desglose agrega los contratos del sector desde SQLite', async () => {
    const res = await fetch(`${API}/api/alertas/desglose?sector=${SECTOR}`)
    expect(res.ok).toBe(true)
    const d = await res.json()

    expect(d.sector).toBe(SECTOR)
    expect(d.por_anio.length).toBeGreaterThan(0)
    expect(d.por_entidad.length).toBeGreaterThan(0)
    expect(d.por_departamento.length).toBeGreaterThan(0)

    for (const r of d.por_anio) {
      expect(r.anio).toMatch(/^\d{4}$/)
      expect(r.trimestre).toBeGreaterThanOrEqual(1)
      expect(r.trimestre).toBeLessThanOrEqual(4)
      expect(r.contratos).toBeGreaterThan(0)
    }

    // Coherencia con contratos_cache: el total anual no supera lo cacheado
    const db = new Database(apiDbPath, { readonly: true })
    const enCache = db.query<{ c: number }, [string]>(
      `SELECT COUNT(*) c FROM contratos_cache WHERE nit IN (SELECT nit FROM scores WHERE sector = ?)`
    ).get(SECTOR)!.c
    db.close()
    const totalAnios = d.por_anio.reduce((a: number, r: any) => a + r.contratos, 0)
    expect(totalAnios).toBeGreaterThan(0)
    expect(totalAnios).toBeLessThanOrEqual(enCache)
  }, 30_000)

  run('stale-while-revalidate: datos vencidos se sirven al instante y se refrescan en segundo plano', async () => {
    // Envejecer artificialmente los scores del sector (2h > TTL de 1h)
    const dbw = new Database(apiDbPath)
    dbw.run(`UPDATE scores SET calculado_at = unixepoch() - 7200 WHERE sector = ?`, [SECTOR])
    dbw.close()

    // La respuesta debe ser inmediata (SQLite) aunque los datos estén vencidos
    const t0 = performance.now()
    const res = await (await fetch(`${API}/api/alertas?sector=${SECTOR}&limit=${LIMIT}`)).json()
    const ms = performance.now() - t0
    expect(res.cached).toBe(true)
    expect(res.stale).toBe(true)
    expect(res.scores.length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(1_000)

    // El refresco en segundo plano debe dejar los scores frescos sin que nadie espere
    const deadline = Date.now() + 90_000
    let refreshed = false
    while (Date.now() < deadline) {
      const dbr = new Database(apiDbPath, { readonly: true })
      const row = dbr.query<{ oldest: number }, [string]>(
        `SELECT MIN(calculado_at) oldest FROM scores WHERE sector = ?`
      ).get(SECTOR)!
      dbr.close()
      if (row.oldest > Math.floor(Date.now() / 1000) - 3600) { refreshed = true; break }
      await Bun.sleep(2_000)
    }
    expect(refreshed).toBe(true)

    // Y la siguiente consulta ya llega fresca
    const after = await (await fetch(`${API}/api/alertas?sector=${SECTOR}&limit=${LIMIT}`)).json()
    expect(after.stale).toBe(false)
    console.log(`   → SWR: respuesta stale en ${ms.toFixed(0)}ms, refresco en segundo plano completado`)
  }, 120_000)
})
