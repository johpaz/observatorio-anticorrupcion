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

function buildWhere(params: {
  year?: string
  quarter?: string
  departamento?: string
  sector?: string
  tipo_de_contrato?: string
  estado_contrato?: string
}): string {
  const conditions: string[] = []
  if (params.year && /^\d{4}$/.test(params.year))
    conditions.push(`date_extract_y(fecha_de_firma) = ${params.year}`)
  if (params.quarter && /^[1-4]$/.test(params.quarter)) {
    const [s, e] = QUARTER_RANGES[params.quarter]
    conditions.push(`date_extract_m(fecha_de_firma) between ${s} and ${e}`)
  }
  if (params.departamento) conditions.push(`departamento = '${sanitize(params.departamento)}'`)
  if (params.sector) conditions.push(`sector = '${sanitize(params.sector)}'`)
  if (params.tipo_de_contrato) conditions.push(`tipo_de_contrato = '${sanitize(params.tipo_de_contrato)}'`)
  if (params.estado_contrato) conditions.push(`estado_contrato = '${sanitize(params.estado_contrato)}'`)
  return conditions.join(' AND ')
}

const baseQuery = {
  year: t.Optional(t.String()),
  quarter: t.Optional(t.String()),
  departamento: t.Optional(t.String()),
  sector: t.Optional(t.String()),
  tipo_de_contrato: t.Optional(t.String()),
  estado_contrato: t.Optional(t.String()),
}

export const contratosRoutes = new Elysia({ prefix: '/api/contratos' })
  .onError(({ error, set }) => { set.status = 500; return { error: String(error) } })

  .get('/kpis', async ({ query }) => {
    const where = buildWhere(query)

    if (where) {
      const params: Record<string, string> = {
        '$select': 'count(*) as total, sum(valor_del_contrato) as valor_total, avg(valor_del_contrato) as valor_promedio',
        '$where': where,
      }
      const data = await socrataQuery('contratos', params) as any[]
      return data[0] ?? {}
    }

    // Sin filtros, count(*) plano sobre todo el dataset excede el timeout de Socrata;
    // el conteo agrupado por año y la suma directa sí responden (~6s, luego cacheado).
    const [porAnio, sumRow] = await Promise.all([
      socrataQuery('contratos', {
        '$select': 'date_extract_y(fecha_de_firma) as anio, count(*) as total',
        '$group': 'anio',
        '$limit': '50',
      }),
      socrataQuery('contratos', { '$select': 'sum(valor_del_contrato) as valor_total' }),
    ]) as [any[], any[]]

    const total = porAnio.reduce((acc, r) => acc + Number(r.total ?? 0), 0)
    const valor_total = Number(sumRow[0]?.valor_total ?? 0)
    return {
      total: String(total),
      valor_total: String(valor_total),
      valor_promedio: total > 0 ? String(valor_total / total) : '0',
    }
  }, { query: t.Object(baseQuery) })

  .get('/por-sector', async ({ query }) => {
    const params: Record<string, string> = {
      '$select': 'sector, count(*) as total, sum(valor_del_contrato) as valor_total',
      '$group': 'sector',
      '$order': 'valor_total DESC',
      '$limit': '15',
    }
    params['$where'] = mergeWhere('sector IS NOT NULL', buildWhere(query))
    return await socrataQuery('contratos', params)
  }, { query: t.Object(baseQuery) })

  .get('/por-tipo', async ({ query }) => {
    const params: Record<string, string> = {
      '$select': 'tipo_de_contrato, count(*) as total',
      '$group': 'tipo_de_contrato',
      '$order': 'total DESC',
      '$limit': '15',
    }
    params['$where'] = mergeWhere('tipo_de_contrato IS NOT NULL', buildWhere(query))
    return await socrataQuery('contratos', params)
  }, { query: t.Object(baseQuery) })

  .get('/por-mes', async ({ query }) => {
    const { year } = query
    const params: Record<string, string> = {
      '$select': 'date_trunc_ym(fecha_de_firma) as mes, count(*) as total, sum(valor_del_contrato) as valor_total',
      '$group': 'mes',
      '$order': 'mes ASC',
      '$limit': '60',
    }
    const base = 'fecha_de_firma IS NOT NULL'
    const extra = year && /^\d{4}$/.test(year) ? `date_extract_y(fecha_de_firma) = ${year}` : ''
    params['$where'] = mergeWhere(base, extra)
    return await socrataQuery('contratos', params)
  }, { query: t.Object({ year: t.Optional(t.String()) }) })

  .get('/por-departamento', async ({ query }) => {
    const params: Record<string, string> = {
      '$select': 'departamento, count(*) as total, sum(valor_del_contrato) as valor_total',
      '$group': 'departamento',
      '$order': 'valor_total DESC',
      '$limit': '15',
    }
    params['$where'] = mergeWhere('departamento IS NOT NULL', buildWhere(query))
    return await socrataQuery('contratos', params)
  }, { query: t.Object(baseQuery) })

  .get('/por-estado', async ({ query }) => {
    const params: Record<string, string> = {
      '$select': 'estado_contrato, count(*) as total',
      '$group': 'estado_contrato',
      '$order': 'total DESC',
    }
    params['$where'] = mergeWhere('estado_contrato IS NOT NULL', buildWhere(query))
    return await socrataQuery('contratos', params)
  }, { query: t.Object(baseQuery) })

  .get('/metadata', async () => {
    const [years, departamentos, sectores, tipos, estados] = await Promise.all([
      socrataQuery('contratos', {
        '$select': 'date_extract_y(fecha_de_firma) as year',
        '$group': 'year', '$order': 'year DESC', '$limit': '20',
        '$where': 'fecha_de_firma IS NOT NULL',
      }),
      socrataQuery('contratos', {
        '$select': 'departamento', '$group': 'departamento',
        '$order': 'departamento ASC', '$limit': '150',
        '$where': 'departamento IS NOT NULL',
      }),
      socrataQuery('contratos', {
        '$select': 'sector', '$group': 'sector',
        '$order': 'sector ASC', '$limit': '80',
        '$where': 'sector IS NOT NULL',
      }),
      socrataQuery('contratos', {
        '$select': 'tipo_de_contrato', '$group': 'tipo_de_contrato',
        '$order': 'tipo_de_contrato ASC', '$limit': '40',
        '$where': 'tipo_de_contrato IS NOT NULL',
      }),
      socrataQuery('contratos', {
        '$select': 'estado_contrato', '$group': 'estado_contrato',
        '$order': 'estado_contrato ASC',
        '$where': 'estado_contrato IS NOT NULL',
      }),
    ]) as any[][]

    return {
      years: (years as any[]).map(r => r.year).filter(Boolean).sort((a: number, b: number) => b - a),
      departamentos: (departamentos as any[]).map(r => r.departamento).filter(Boolean),
      sectores: (sectores as any[]).map(r => r.sector).filter(Boolean),
      tipos: (tipos as any[]).map(r => r.tipo_de_contrato).filter(Boolean),
      estados: (estados as any[]).map(r => r.estado_contrato).filter(Boolean),
    }
  })

  .get('/list', async ({ query }) => {
    const { page = '1', limit = '20', ...filters } = query
    const where = buildWhere(filters)
    const params: Record<string, string> = {
      '$limit': limit,
      '$offset': String((Number(page) - 1) * Number(limit)),
      '$order': 'fecha_de_firma DESC',
    }
    if (where) params['$where'] = where
    return await socrataQuery('contratos', params)
  }, {
    query: t.Object({
      ...baseQuery,
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    })
  })
