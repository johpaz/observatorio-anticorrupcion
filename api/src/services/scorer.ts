import { socrataQuery } from './socrata'
import { db } from '../db/client'

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

function normalizeStr(s: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

async function fetchContracts(nit: string): Promise<SecopRecord[]> {
  const safe = nit.replace(/'/g, "''")
  return socrataQuery('contratos', {
    '$select': 'documento_proveedor,proveedor_adjudicado,nombre_entidad,valor_del_contrato,valor_facturado,fecha_de_fin_del_contrato,fecha_de_inicio_del_contrato,estado_contrato,sector,objeto_del_contrato,id_contrato,dias_adicionados',
    '$where': `documento_proveedor='${safe}'`,
    '$limit': '500',
    '$order': 'fecha_de_fin_del_contrato DESC',
  }) as Promise<SecopRecord[]>
}

export async function scoreNit(nit: string): Promise<ScoreResult> {
  const cached = db.query<any, [string, number]>(
    `SELECT * FROM scores WHERE nit = ? AND calculado_at > unixepoch() - ?`
  ).get(nit, SCORE_TTL_SEC)

  if (cached) {
    return {
      nit: cached.nit,
      nombre: cached.nombre ?? 'Desconocido',
      score_total: cached.score_total,
      nivel_riesgo: cached.nivel_riesgo as 'ROJO' | 'AMARILLO' | 'VERDE',
      flags: JSON.parse(cached.flags),
      sector: cached.sector,
      sancionado_paco: false,
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

  const nivel_riesgo = nivelFromScore(score)
  const nombre = contracts[0].proveedor_adjudicado ?? 'Desconocido'

  const sectorCounts: Record<string, number> = {}
  for (const c of contracts) {
    if (c.sector) sectorCounts[c.sector] = (sectorCounts[c.sector] ?? 0) + 1
  }
  const sector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  db.prepare(`INSERT OR REPLACE INTO scores (nit, nombre, score_total, nivel_riesgo, flags, sector) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(nit, nombre, score, nivel_riesgo, JSON.stringify(flags), sector)

  return { nit, nombre, score_total: score, nivel_riesgo, flags, sector, sancionado_paco: false }
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
  return results.sort((a, b) => b.score_total - a.score_total)
}
