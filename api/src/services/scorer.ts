import { join } from 'path'
import { socrataQuery } from './socrata'
import { db, DB_PATH } from '../db/client'
import { checkSanciones } from './procuraduria'
import { createLogger } from '../utils/logger'

const log = createLogger('scorer')

const SCORE_TTL_SEC = 3600
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000

interface SecopRecord {
  documento_proveedor?: string
  proveedor_adjudicado?: string
  nombre_entidad?: string
  valor_del_contrato?: string
  valor_facturado?: string
  fecha_de_fin_del_contrato?: string
  fecha_de_inicio_del_contrato?: string
  estado_contrato?: string
  sector?: string
  objeto_del_contrato?: string
  id_contrato?: string
  dias_adicionados?: string
}

export interface ScoreResult {
  nit: string
  nombre: string
  score_total: number
  nivel_riesgo: 'ROJO' | 'AMARILLO' | 'VERDE'
  flags: string[]
  sector: string | null
  sancionado_paco: boolean
}

function nivelFromScore(score: number): 'ROJO' | 'AMARILLO' | 'VERDE' {
  if (score > 60) return 'ROJO'
  if (score >= 30) return 'AMARILLO'
  return 'VERDE'
}

const SANCTION_FLAGS = ['SANCIONADO_DISCIPLINARIO', 'RESPONSABILIDAD_FISCAL', 'MULTA_SECOP']

export function hasSanctionFlag(flags: string[]): boolean {
  return flags.some(f => SANCTION_FLAGS.includes(f))
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

async function fetchContracts(nit: string): Promise<SecopRecord[]> {
  const safe = nit.replace(/'/g, "''")
  return socrataQuery('contratos', {
    '$select': 'documento_proveedor,proveedor_adjudicado,nombre_entidad,valor_del_contrato,valor_facturado,fecha_de_fin_del_contrato,fecha_de_inicio_del_contrato,estado_contrato,sector,departamento,objeto_del_contrato,id_contrato,dias_adicionados',
    '$where': `documento_proveedor='${safe}'`,
    '$limit': '500',
    '$order': 'fecha_de_fin_del_contrato DESC',
  }) as Promise<SecopRecord[]>
}

// Run Python Isolation Forest script in background subprocess
async function runAnomalyDetection(sector: string): Promise<void> {
  const scriptPath = join(import.meta.dir, '../scripts/anomaly_scorer.py')
  const projectRoot = join(import.meta.dir, '../../..')
  try {
    const proc = Bun.spawn(
      [Bun.env.PYTHON_BIN ?? 'python3', scriptPath, sector],
      { stdout: 'pipe', stderr: 'pipe', cwd: projectRoot, env: { ...Bun.env, DB_PATH } }
    )
    await proc.exited
    const out = await new Response(proc.stdout).text()
    if (out.trim()) log.info(out.trim())
  } catch (e) {
    log.warn(`anomaly detection omitido: ${String(e)}`)
  }
}

// Apply ML anomaly scores to in-memory results and update SQLite
function applyMlScores(sector: string, results: ScoreResult[]): void {
  const anomalyRows = db.query<{ nit: string; anomaly_score: number }, [string]>(
    `SELECT nit, anomaly_score FROM anomaly_scores WHERE sector = ?`
  ).all(sector)

  if (anomalyRows.length === 0) return

  const anomalyMap = new Map(anomalyRows.map(r => [r.nit, r.anomaly_score]))

  for (const result of results) {
    const anomalyScore = anomalyMap.get(result.nit)
    if (anomalyScore === undefined || anomalyScore >= -0.05) continue
    if (result.flags.some(f => f.startsWith('ANOMALIA'))) continue

    // Map: score=-0.5 → +30pts, score=-0.05 → +0pts (linear)
    const mlPts = Math.round((-anomalyScore - 0.05) / 0.45 * 30)
    const bonus = Math.min(mlPts, 30)
    result.score_total += bonus
    result.nivel_riesgo = nivelFromScore(result.score_total)
    result.flags.push(`ANOMALIA_ESTADISTICA(${anomalyScore.toFixed(2)})`)

    db.prepare(`UPDATE scores SET score_total = ?, nivel_riesgo = ?, flags = ? WHERE nit = ?`)
      .run(result.score_total, result.nivel_riesgo, JSON.stringify(result.flags), result.nit)
  }
}

export async function scoreNit(nit: string): Promise<ScoreResult> {
  const cached = db.query<any, [string, number]>(
    `SELECT * FROM scores WHERE nit = ? AND calculado_at > unixepoch() - ?`
  ).get(nit, SCORE_TTL_SEC)

  if (cached) {
    const flags: string[] = JSON.parse(cached.flags)
    return {
      nit: cached.nit,
      nombre: cached.nombre ?? 'Desconocido',
      score_total: cached.score_total,
      nivel_riesgo: cached.nivel_riesgo as 'ROJO' | 'AMARILLO' | 'VERDE',
      flags,
      sector: cached.sector,
      sancionado_paco: hasSanctionFlag(flags),
    }
  }

  const contracts = await fetchContracts(nit)

  if (contracts.length === 0) {
    db.prepare(`INSERT OR REPLACE INTO scores (nit, nombre, score_total, nivel_riesgo, flags, sector) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(nit, 'Desconocido', 0, 'VERDE', '[]', null)
    return { nit, nombre: 'Desconocido', score_total: 0, nivel_riesgo: 'VERDE', flags: [], sector: null, sancionado_paco: false }
  }

  // Persist contracts to cache
  const insert = db.prepare(`
    INSERT OR REPLACE INTO contratos_cache
      (nit, contrato_id, entidad, valor, fecha_inicio, fecha_fin, estado, sector, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    for (const c of contracts) {
      const id = c.id_contrato ?? `${nit}|${c.nombre_entidad ?? ''}|${c.fecha_de_inicio_del_contrato ?? ''}`
      insert.run(
        nit, id,
        c.nombre_entidad ?? null,
        c.valor_del_contrato ? parseFloat(c.valor_del_contrato) : null,
        c.fecha_de_inicio_del_contrato ?? null,
        c.fecha_de_fin_del_contrato ?? null,
        c.estado_contrato ?? null,
        c.sector ?? null,
        JSON.stringify(c),
      )
    }
  })()

  const flags: string[] = []
  let score = 0
  const now = Date.now()

  // Flag A: "En ejecución" contracts past end date > 6 months (+25 each, cap 75)
  let overdueCount = 0
  for (const c of contracts) {
    if (!c.fecha_de_fin_del_contrato) continue
    const endDate = new Date(c.fecha_de_fin_del_contrato)
    if (isNaN(endDate.getTime())) continue
    const estadoNorm = normalizeStr(c.estado_contrato ?? '')
    const isActive = estadoNorm.includes('ejecuci') || estadoNorm.includes('prorrogado')
    if (isActive && now - endDate.getTime() > SIX_MONTHS_MS) overdueCount++
  }
  if (overdueCount > 0) {
    score += Math.min(overdueCount * 25, 75)
    flags.push(`VENCIDOS_SIN_CERRAR(${overdueCount})`)
  }

  // Flag B: Significant extension — dias_adicionados > 365 (+20)
  const hasLargeExtension = contracts.some(c => Number(c.dias_adicionados ?? 0) > 365)
  if (hasLargeExtension) {
    score += 20
    flags.push('EXTENSION_MAYOR_1_ANO')
  }

  // Flag C: 3+ contracts with any extension (+15)
  const withExtension = contracts.filter(c => Number(c.dias_adicionados ?? 0) > 0).length
  if (!hasLargeExtension && withExtension >= 3) {
    score += 15
    flags.push(`MULTIPLES_ADICIONES(${withExtension})`)
  }

  // Flag D: Contracts in 5+ distinct entities (+10)
  const entities = new Set(contracts.map(c => c.nombre_entidad).filter(Boolean))
  if (entities.size >= 5) {
    score += 10
    flags.push(`CONCENTRACION_ENTIDADES(${entities.size})`)
  }

  // Flag E: Low execution ratio on terminated contracts (+15)
  const lowExecCount = contracts.filter(c => {
    const valor = parseFloat(c.valor_del_contrato ?? '0')
    const facturado = parseFloat(c.valor_facturado ?? '0')
    const estadoNorm = normalizeStr(c.estado_contrato ?? '')
    return valor > 5_000_000 && facturado / valor < 0.5
      && (estadoNorm.includes('terminado') || estadoNorm.includes('cancelado'))
  }).length
  if (lowExecCount > 0) {
    score += 15
    flags.push(`BAJA_EJECUCION(${lowExecCount})`)
  }

  // Flag F: Sanciones Procuraduría / CGR / SECOP
  let sancionado = false
  const sanciones = await checkSanciones(nit)
  if (sanciones) {
    if (sanciones.tiene_antecedentes_disciplinarios) {
      score += 30
      flags.push('SANCIONADO_DISCIPLINARIO')
      sancionado = true
    }
    if (sanciones.tiene_antecedentes_fiscales) {
      score += 25
      flags.push('RESPONSABILIDAD_FISCAL')
      sancionado = true
    }
    if (sanciones.tiene_multas_secop) {
      score += 15
      flags.push('MULTA_SECOP')
      sancionado = true
    }
  }

  // Flag ML: incorporate anomaly score if available from a prior batch run
  const anomalyRow = db.query<{ anomaly_score: number }, [string]>(
    `SELECT anomaly_score FROM anomaly_scores WHERE nit = ?`
  ).get(nit)
  if (anomalyRow && anomalyRow.anomaly_score < -0.05) {
    const mlPts = Math.round((-anomalyRow.anomaly_score - 0.05) / 0.45 * 30)
    score += Math.min(mlPts, 30)
    flags.push(`ANOMALIA_ESTADISTICA(${anomalyRow.anomaly_score.toFixed(2)})`)
  }

  const nivel_riesgo = nivelFromScore(score)
  const nombre = contracts[0].proveedor_adjudicado ?? 'Desconocido'

  const sectorCounts: Record<string, number> = {}
  for (const c of contracts) {
    if (c.sector) sectorCounts[c.sector] = (sectorCounts[c.sector] ?? 0) + 1
  }
  const sector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  db.prepare(`INSERT OR REPLACE INTO scores (nit, nombre, score_total, nivel_riesgo, flags, sector) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(nit, nombre, score, nivel_riesgo, JSON.stringify(flags), sector)

  return { nit, nombre, score_total: score, nivel_riesgo, flags, sector, sancionado_paco: sancionado }
}

export async function scoreSectorBatch(sector: string, limit = 30): Promise<ScoreResult[]> {
  const safe = sector.replace(/'/g, "''")
  const topNits = await socrataQuery('contratos', {
    '$select': 'documento_proveedor,proveedor_adjudicado,count(*) as total',
    '$where': `sector='${safe}' AND documento_proveedor IS NOT NULL`,
    '$group': 'documento_proveedor,proveedor_adjudicado',
    '$order': 'total DESC',
    '$limit': String(limit),
  }) as any[]

  const CONCURRENCY = 5
  const results: ScoreResult[] = []
  for (let i = 0; i < topNits.length; i += CONCURRENCY) {
    const batch = topNits.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(r => scoreNit(String(r.documento_proveedor)).catch(() => null))
    )
    for (const r of batchResults) {
      if (!r) continue
      if (r.sector !== sector) {
        db.prepare(`UPDATE scores SET sector = ? WHERE nit = ?`).run(sector, r.nit)
        r.sector = sector
      }
      results.push(r)
    }
  }

  // Run Isolation Forest on the batch, then apply ML scores to results and SQLite
  await runAnomalyDetection(sector)
  applyMlScores(sector, results)

  return results.sort((a, b) => b.score_total - a.score_total)
}
