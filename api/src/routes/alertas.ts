import { Elysia, t } from 'elysia'
import { db } from '../db/client'
import { scoreSectorBatch, hasSanctionFlag } from '../services/scorer'
import { socrataQuery } from '../services/socrata'

// Respaldo si Socrata no responde en el primer arranque (sin copia local aún)
const SECTORES_FALLBACK = [
  'Transporte',
  'Vivienda, Ciudad y Territorio',
  'Salud y Protección Social',
  'Educación Nacional',
  'defensa',
  'Servicio Público',
]

// Categoría basura del dataset: no es un sector real
const SECTOR_EXCLUIDO = /no aplica/i

/** Sectores reales del dataset SECOP II, ordenados por volumen de contratos.
 *  Pasa por las dos capas de caché de socrataQuery (memoria + copia SQLite). */
export async function getSectores(): Promise<string[]> {
  try {
    const rows = await socrataQuery('contratos', {
      '$select': 'sector, count(*) as total',
      '$where': 'sector IS NOT NULL',
      '$group': 'sector',
      '$order': 'total DESC',
      '$limit': '30',
    }) as { sector: string }[]
    const sectores = rows.map(r => r.sector).filter(s => s && !SECTOR_EXCLUIDO.test(s))
    return sectores.length > 0 ? sectores : SECTORES_FALLBACK
  } catch {
    return SECTORES_FALLBACK
  }
}

const DEFAULT_SECTOR = 'Transporte'
const SCORE_TTL_SEC = 3600
const BATCH_LIMIT = 30

// Un solo refresco en vuelo por sector: peticiones concurrentes comparten la promesa
const refreshing = new Map<string, Promise<unknown>>()

function refreshSector(sector: string, limit = BATCH_LIMIT) {
  let p = refreshing.get(sector)
  if (!p) {
    p = scoreSectorBatch(sector, limit).finally(() => refreshing.delete(sector))
    refreshing.set(sector, p)
  }
  return p
}

/** Precalcula los sectores sin datos frescos — se llama al arrancar el API. */
export async function warmupAlertas(): Promise<void> {
  const sectores = await getSectores()
  console.log(`[warmup] ${sectores.length} sectores por precalcular`)
  for (const sector of sectores) {
    const fresh = db.query<{ c: number }, [string, number]>(
      `SELECT COUNT(*) c FROM scores WHERE sector = ? AND calculado_at > unixepoch() - ?`
    ).get(sector, SCORE_TTL_SEC)
    if ((fresh?.c ?? 0) > 0) continue
    try {
      console.log(`[warmup] calculando alertas del sector "${sector}"...`)
      await refreshSector(sector)
    } catch (err) {
      console.warn(`[warmup] sector "${sector}" falló:`, String(err))
    }
  }
  console.log('[warmup] alertas precalculadas')
}

export const alertasRoutes = new Elysia({ prefix: '/api/alertas' })
  .onError(({ error, set }) => { set.status = 500; return { error: String(error) } })

  // Sectores monitoreables (dinámicos desde el dataset, ordenados por volumen)
  .get('/sectores', async () => ({ sectores: await getSectores() }))

  .get('/', async ({ query }) => {
    const sector  = query.sector ?? DEFAULT_SECTOR
    const nivel   = query.nivel ?? ''
    const limit   = Math.min(Number(query.limit ?? BATCH_LIMIT), 100)
    const refresh = query.refresh === '1'

    const meta = db.query<{ c: number; oldest: number }, [string]>(
      `SELECT COUNT(*) c, COALESCE(MIN(calculado_at), 0) oldest FROM scores WHERE sector = ?`
    ).get(sector)!
    const stale = meta.c === 0 || meta.oldest <= now() - SCORE_TTL_SEC

    // Solo se bloquea al usuario cuando no hay NADA que servir (primera vez)
    // o cuando él mismo pidió recalcular (botón Actualizar)
    if (refresh || meta.c === 0) {
      const fresh = await refreshSector(sector, limit) as Awaited<ReturnType<typeof scoreSectorBatch>>
      const filtered = nivel ? fresh.filter(r => r.nivel_riesgo === nivel) : fresh
      return {
        total: filtered.length,
        scores: filtered,
        cached: false,
        stale: false,
        sector,
        nivel: nivel || null,
        generated_at: new Date().toISOString(),
      }
    }

    // Stale-while-revalidate: servir SQLite al instante; si está viejo,
    // refrescar en segundo plano sin hacer esperar a nadie
    if (stale) {
      refreshSector(sector).catch(err =>
        console.warn(`[alertas] refresco en segundo plano de "${sector}" falló:`, String(err)))
    }

    const nivelClause = nivel ? 'AND nivel_riesgo = ?' : ''
    const args: any[] = nivel ? [sector, nivel, limit] : [sector, limit]
    const rows = db.query<any, any[]>(
      `SELECT * FROM scores
        WHERE sector = ? ${nivelClause}
        ORDER BY score_total DESC
        LIMIT ?`
    ).all(...args)

    return {
      total: rows.length,
      scores: rows.map(r => {
        const flags: string[] = JSON.parse(r.flags)
        return { ...r, flags, sancionado_paco: hasSanctionFlag(flags) }
      }),
      cached: true,
      stale,
      sector,
      nivel: nivel || null,
      generated_at: new Date(meta.oldest * 1000).toISOString(),
    }
  }, {
    query: t.Object({
      sector:  t.Optional(t.String()),
      nivel:   t.Optional(t.String()),
      limit:   t.Optional(t.String()),
      refresh: t.Optional(t.String()),
    }),
  })

  // Análisis dimensional de los contratos de los NITs puntuados del sector.
  // Solo SQLite (contratos_cache) — el score siempre evalúa el historial completo;
  // estas dimensiones describen los contratos, no re-puntúan por período.
  .get('/desglose', ({ query }) => {
    const sector = query.sector ?? DEFAULT_SECTOR

    const por_anio = db.query<{ anio: string; trimestre: number; contratos: number; valor: number }, [string]>(
      `SELECT substr(fecha_fin, 1, 4) AS anio,
              ((CAST(substr(fecha_fin, 6, 2) AS INTEGER) - 1) / 3) + 1 AS trimestre,
              COUNT(*) AS contratos,
              COALESCE(SUM(valor), 0) AS valor
         FROM contratos_cache
        WHERE nit IN (SELECT nit FROM scores WHERE sector = ?)
          AND fecha_fin IS NOT NULL AND length(fecha_fin) >= 7
        GROUP BY anio, trimestre
        ORDER BY anio ASC, trimestre ASC`
    ).all(sector)

    const por_entidad = db.query<{ entidad: string; contratos: number; valor: number }, [string]>(
      `SELECT COALESCE(NULLIF(entidad, ''), 'No registrada') AS entidad,
              COUNT(*) AS contratos, COALESCE(SUM(valor), 0) AS valor
         FROM contratos_cache
        WHERE nit IN (SELECT nit FROM scores WHERE sector = ?)
        GROUP BY 1 ORDER BY valor DESC LIMIT 12`
    ).all(sector)

    const por_departamento = db.query<{ departamento: string; contratos: number; valor: number }, [string]>(
      `SELECT COALESCE(NULLIF(json_extract(raw_json, '$.departamento'), ''), 'No registrado') AS departamento,
              COUNT(*) AS contratos, COALESCE(SUM(valor), 0) AS valor
         FROM contratos_cache
        WHERE nit IN (SELECT nit FROM scores WHERE sector = ?)
        GROUP BY 1 ORDER BY contratos DESC LIMIT 15`
    ).all(sector)

    return { sector, por_anio, por_entidad, por_departamento }
  }, { query: t.Object({ sector: t.Optional(t.String()) }) })

  .get('/stats', () => {
    const rows = db.query<{ nivel_riesgo: string; c: number }, []>(
      `SELECT nivel_riesgo, COUNT(*) as c FROM scores GROUP BY nivel_riesgo`
    ).all()
    const byNivel = Object.fromEntries(rows.map(r => [r.nivel_riesgo, r.c]))
    const contratos = db.query<{ c: number; valor: number | null }, []>(
      `SELECT COUNT(*) as c, SUM(valor) as valor FROM contratos_cache`
    ).get()
    return {
      total: rows.reduce((a, r) => a + r.c, 0),
      rojos: byNivel.ROJO ?? 0,
      amarillos: byNivel.AMARILLO ?? 0,
      verdes: byNivel.VERDE ?? 0,
      contratos_analizados: contratos?.c ?? 0,
      valor_analizado: contratos?.valor ?? 0,
    }
  })

function now() { return Math.floor(Date.now() / 1000) }
