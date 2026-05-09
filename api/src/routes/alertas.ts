import { Elysia, t } from 'elysia'
import { db } from '../db/client'
import { scoreSectorBatch } from '../services/scorer'

const DEFAULT_SECTOR = 'Transporte'
const SCORE_TTL_SEC = 3600

export const alertasRoutes = new Elysia({ prefix: '/api/alertas' })
  .onError(({ error, set }) => { set.status = 500; return { error: String(error) } })

  .get('/', async ({ query }) => {
    const sector  = query.sector ?? DEFAULT_SECTOR
    const nivel   = query.nivel ?? ''
    const limit   = Math.min(Number(query.limit ?? 30), 100)
    const refresh = query.refresh === '1'

    const nivelClause = nivel ? 'AND nivel_riesgo = ?' : ''
    const args: any[] = nivel
      ? [sector, now() - SCORE_TTL_SEC, nivel, limit]
      : [sector, now() - SCORE_TTL_SEC, limit]

    const existing = db.query<any, any[]>(
      `SELECT * FROM scores
        WHERE sector = ? AND calculado_at > ?
        ${nivelClause}
        ORDER BY score_total DESC
        LIMIT ?`
    ).all(...args)

    if (existing.length > 0 && !refresh) {
      return {
        total: existing.length,
        scores: existing.map(r => ({ ...r, flags: JSON.parse(r.flags), sancionado_paco: false })),
        cached: true,
        sector,
        nivel: nivel || null,
        generated_at: new Date(Math.min(...existing.map((r: any) => r.calculado_at)) * 1000).toISOString(),
      }
    }

    const fresh = await scoreSectorBatch(sector, limit)
    const filtered = nivel ? fresh.filter(r => r.nivel_riesgo === nivel) : fresh

    return {
      total: filtered.length,
      scores: filtered,
      cached: false,
      sector,
      nivel: nivel || null,
      generated_at: new Date().toISOString(),
    }
  }, {
    query: t.Object({
      sector:  t.Optional(t.String()),
      nivel:   t.Optional(t.String()),
      limit:   t.Optional(t.String()),
      refresh: t.Optional(t.String()),
    }),
  })

function now() { return Math.floor(Date.now() / 1000) }
