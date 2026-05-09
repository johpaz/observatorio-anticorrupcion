import { Elysia, t } from 'elysia'
import { db } from '../db/client'
import { scoreNit } from '../services/scorer'

export const contratistaRoutes = new Elysia({ prefix: '/api/contratista' })
  .onError(({ error, set }) => { set.status = 500; return { error: String(error) } })

  .get('/:nit', async ({ params, query }) => {
    const nit = decodeURIComponent(params.nit).trim()
    if (!nit) return { error: 'NIT requerido' }

    if (query.refresh === '1') {
      db.prepare(`DELETE FROM scores WHERE nit = ?`).run(nit)
    }

    const scoreResult = await scoreNit(nit)

    const contratos = db.query<any, [string]>(
      `SELECT contrato_id, entidad, valor, fecha_inicio, fecha_fin, estado, sector
        FROM contratos_cache WHERE nit = ?
        ORDER BY fecha_fin DESC LIMIT 20`
    ).all(nit)

    const scoreRow = db.query<any, [string]>(
      `SELECT calculado_at FROM scores WHERE nit = ?`
    ).get(nit)

    return {
      ...scoreResult,
      contratos,
      cached: query.refresh !== '1',
      calculado_at: scoreRow
        ? new Date(scoreRow.calculado_at * 1000).toISOString()
        : new Date().toISOString(),
    }
  }, {
    params: t.Object({ nit: t.String() }),
    query: t.Object({ refresh: t.Optional(t.String()) }),
  })
