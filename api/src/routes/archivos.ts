import { Elysia, t } from 'elysia'
import { socrataQuery } from '../services/socrata'

const QUARTER_RANGES: Record<string, [number, number]> = {
  '1': [1, 3], '2': [4, 6], '3': [7, 9], '4': [10, 12],
}

function sanitize(val: string): string {
  return val.replace(/'/g, "''").replace(/;/g, '')
}

function mergeWhere(base: string, extra: string): string {
  if (!base && !extra) return ''
  if (!base) return extra
  if (!extra) return base
  return `(${base}) AND (${extra})`
}

function buildWhere(params: { year?: string; quarter?: string; entidad?: string }): string {
  const conditions: string[] = []
  if (params.year && /^\d{4}$/.test(params.year))
    conditions.push(`date_extract_y(fecha_carga) = ${params.year}`)
  if (params.quarter && /^[1-4]$/.test(params.quarter)) {
    const [s, e] = QUARTER_RANGES[params.quarter]
    conditions.push(`date_extract_m(fecha_carga) between ${s} and ${e}`)
  }
  if (params.entidad) conditions.push(`entidad = '${sanitize(params.entidad)}'`)
  return conditions.join(' AND ')
}

const baseQuery = {
  year: t.Optional(t.String()),
  quarter: t.Optional(t.String()),
  entidad: t.Optional(t.String()),
}

export const archivosRoutes = new Elysia({ prefix: '/api/archivos' })
  .onError(({ error, set }) => { set.status = 500; return { error: String(error) } })

  .get('/kpis', async ({ query }) => {
    const params: Record<string, string> = {
      '$select': 'count(*) as total, sum(tamanno_archivo) as tamanno_total',
    }
    const where = buildWhere(query)
    if (where) params['$where'] = where
    const data = await socrataQuery('archivos', params) as any[]
    return data[0] ?? {}
  }, { query: t.Object(baseQuery) })

  .get('/por-extension', async ({ query }) => {
    const params: Record<string, string> = {
      '$select': 'extensi_n as extension, count(*) as total, sum(tamanno_archivo) as tamanno_total',
      '$group': 'extensi_n',
      '$order': 'total DESC',
      '$limit': '20',
    }
    params['$where'] = mergeWhere('extensi_n IS NOT NULL', buildWhere(query))
    return await socrataQuery('archivos', params)
  }, { query: t.Object(baseQuery) })

  .get('/por-mes', async ({ query }) => {
    const { year } = query
    const params: Record<string, string> = {
      '$select': 'date_trunc_ym(fecha_carga) as mes, count(*) as total, sum(tamanno_archivo) as tamanno_total',
      '$group': 'mes',
      '$order': 'mes ASC',
      '$limit': '60',
    }
    const base = 'fecha_carga IS NOT NULL'
    const extra = year && /^\d{4}$/.test(year) ? `date_extract_y(fecha_carga) = ${year}` : ''
    params['$where'] = mergeWhere(base, extra)
    return await socrataQuery('archivos', params)
  }, { query: t.Object({ year: t.Optional(t.String()) }) })

  .get('/por-entidad', async ({ query }) => {
    const params: Record<string, string> = {
      '$select': 'entidad, count(*) as total, sum(tamanno_archivo) as tamanno_total',
      '$group': 'entidad',
      '$order': 'total DESC',
      '$limit': '20',
    }
    params['$where'] = mergeWhere('entidad IS NOT NULL', buildWhere(query))
    return await socrataQuery('archivos', params)
  }, { query: t.Object(baseQuery) })

  .get('/metadata', async () => {
    const [years, entidades] = await Promise.all([
      socrataQuery('archivos', {
        '$select': 'date_extract_y(fecha_carga) as year',
        '$group': 'year', '$order': 'year DESC', '$limit': '10',
        '$where': 'fecha_carga IS NOT NULL',
      }),
      socrataQuery('archivos', {
        '$select': 'entidad', '$group': 'entidad',
        '$order': 'entidad ASC', '$limit': '300',
        '$where': 'entidad IS NOT NULL',
      }),
    ]) as any[][]

    return {
      years: (years as any[]).map(r => r.year).filter(Boolean).sort((a: number, b: number) => b - a),
      entidades: (entidades as any[]).map(r => r.entidad).filter(Boolean),
    }
  })

  .get('/list', async ({ query }) => {
    const { page = '1', limit = '20', ...filters } = query
    const where = buildWhere(filters)
    const params: Record<string, string> = {
      '$limit': limit,
      '$offset': String((Number(page) - 1) * Number(limit)),
      '$order': 'fecha_carga DESC',
    }
    if (where) params['$where'] = where
    return await socrataQuery('archivos', params)
  }, {
    query: t.Object({
      ...baseQuery,
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    })
  })
