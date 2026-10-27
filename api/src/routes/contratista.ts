import { Elysia, t } from 'elysia'
import { db } from '../db/client'
import { scoreNit } from '../services/scorer'
import { getSanciones } from '../services/procuraduria'
import { buscarPorNombre } from '../services/buscador'

export const contratistaRoutes = new Elysia({ prefix: '/api/contratista' })
  .onError(({ error, set }) => { set.status = 500; return { error: String(error) } })

  // Búsqueda por nombre o razón social; debe declararse antes de '/:nit'
  .get('/buscar', async ({ query, set }) => {
    const q = query.q.trim()
    if (q.length < 3) { set.status = 400; return { error: 'Escribe al menos 3 caracteres' } }
    return buscarPorNombre(q)
  }, {
    query: t.Object({ q: t.String() }),
  })

  .get('/:nit', async ({ params, query }) => {
    const nit = decodeURIComponent(params.nit).trim()
    if (!nit) return { error: 'NIT requerido' }

    if (query.refresh === '1') {
      db.prepare(`DELETE FROM scores WHERE nit = ?`).run(nit)
    }

    const [scoreResult, sanciones] = await Promise.all([scoreNit(nit), getSanciones(nit)])

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
      // Detalle de antecedentes para la UI (null si la fuente no responde)
      sanciones: sanciones
        ? {
            resumen: sanciones.resumen,
            fiscales: sanciones.fiscales.slice(0, 10),
            disciplinarios: sanciones.disciplinarios.slice(0, 10),
            multas: sanciones.multas.slice(0, 10),
            obras: sanciones.obras.slice(0, 10),
          }
        : null,
      cached: query.refresh !== '1',
      calculado_at: scoreRow
        ? new Date(scoreRow.calculado_at * 1000).toISOString()
        : new Date().toISOString(),
    }
  }, {
    params: t.Object({ nit: t.String() }),
    query: t.Object({ refresh: t.Optional(t.String()) }),
  })
