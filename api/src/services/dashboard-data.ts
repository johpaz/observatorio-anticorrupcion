import { db } from '../db/client'
import { getSectores } from '../routes/alertas'
import { hasSanctionFlag, scoreSectorBatch } from './scorer'
import { socrataQuery } from './socrata'

const QUARTER_RANGES: Record<string, [number, number]> = {
  '1': [1, 3], '2': [4, 6], '3': [7, 9], '4': [10, 12],
}

export interface ContratosFilters {
  year?: string
  quarter?: string
  departamento?: string
  sector?: string
  tipo_de_contrato?: string
  estado_contrato?: string
  page?: string
  limit?: string
}

export interface ArchivosFilters {
  year?: string
  quarter?: string
  entidad?: string
  page?: string
  limit?: string
}

function sanitize(value: string): string {
  return value.replace(/'/g, "''").replace(/;/g, '')
}

function mergeWhere(base: string, extra: string): string {
  if (!base) return extra
  if (!extra) return base
  return `(${base}) AND (${extra})`
}

function contratosWhere(params: ContratosFilters): string {
  const conditions: string[] = []
  if (params.year && /^\d{4}$/.test(params.year))
    conditions.push(`date_extract_y(fecha_de_firma) = ${params.year}`)
  if (params.quarter && /^[1-4]$/.test(params.quarter)) {
    const [start, end] = QUARTER_RANGES[params.quarter]
    conditions.push(`date_extract_m(fecha_de_firma) between ${start} and ${end}`)
  }
  if (params.departamento) conditions.push(`departamento = '${sanitize(params.departamento)}'`)
  if (params.sector) conditions.push(`sector = '${sanitize(params.sector)}'`)
  if (params.tipo_de_contrato) conditions.push(`tipo_de_contrato = '${sanitize(params.tipo_de_contrato)}'`)
  if (params.estado_contrato) conditions.push(`estado_contrato = '${sanitize(params.estado_contrato)}'`)
  return conditions.join(' AND ')
}

function archivosWhere(params: ArchivosFilters): string {
  const conditions: string[] = []
  if (params.year && /^\d{4}$/.test(params.year))
    conditions.push(`date_extract_y(fecha_carga) = ${params.year}`)
  if (params.quarter && /^[1-4]$/.test(params.quarter)) {
    const [start, end] = QUARTER_RANGES[params.quarter]
    conditions.push(`date_extract_m(fecha_carga) between ${start} and ${end}`)
  }
  if (params.entidad) conditions.push(`entidad = '${sanitize(params.entidad)}'`)
  return conditions.join(' AND ')
}

export async function loadContratosMetadata() {
  const [years, departamentos, sectores, tipos, estados] = await Promise.all([
    socrataQuery('contratos', {
      '$select': 'date_extract_y(fecha_de_firma) as year', '$group': 'year',
      '$order': 'year DESC', '$limit': '20', '$where': 'fecha_de_firma IS NOT NULL',
    }),
    socrataQuery('contratos', {
      '$select': 'departamento', '$group': 'departamento', '$order': 'departamento ASC',
      '$limit': '150', '$where': 'departamento IS NOT NULL',
    }),
    socrataQuery('contratos', {
      '$select': 'sector', '$group': 'sector', '$order': 'sector ASC',
      '$limit': '80', '$where': 'sector IS NOT NULL',
    }),
    socrataQuery('contratos', {
      '$select': 'tipo_de_contrato', '$group': 'tipo_de_contrato',
      '$order': 'tipo_de_contrato ASC', '$limit': '40', '$where': 'tipo_de_contrato IS NOT NULL',
    }),
    socrataQuery('contratos', {
      '$select': 'estado_contrato', '$group': 'estado_contrato',
      '$order': 'estado_contrato ASC', '$where': 'estado_contrato IS NOT NULL',
    }),
  ]) as any[][]

  return {
    years: years.map(row => row.year).filter(Boolean).sort((a: number, b: number) => b - a),
    departamentos: departamentos.map(row => row.departamento).filter(Boolean),
    sectores: sectores.map(row => row.sector).filter(Boolean),
    tipos: tipos.map(row => row.tipo_de_contrato).filter(Boolean),
    estados: estados.map(row => row.estado_contrato).filter(Boolean),
  }
}

export async function loadContratosDashboard(filters: ContratosFilters = {}) {
  const where = contratosWhere(filters)
  const page = Math.max(Number(filters.page ?? 1), 1)
  const limit = Math.min(Math.max(Number(filters.limit ?? 20), 1), 100)

  const kpisPromise = where
    ? socrataQuery('contratos', {
        '$select': 'count(*) as total, sum(valor_del_contrato) as valor_total, avg(valor_del_contrato) as valor_promedio',
        '$where': where,
      }).then((rows: any[]) => rows[0] ?? {})
    : Promise.all([
        socrataQuery('contratos', {
          '$select': 'date_extract_y(fecha_de_firma) as anio, count(*) as total',
          '$group': 'anio', '$limit': '50',
        }),
        socrataQuery('contratos', { '$select': 'sum(valor_del_contrato) as valor_total' }),
      ]).then(([years, sums]: any[][]) => {
        const total = years.reduce((sum, row) => sum + Number(row.total ?? 0), 0)
        const value = Number(sums[0]?.valor_total ?? 0)
        return {
          total: String(total), valor_total: String(value),
          valor_promedio: total > 0 ? String(value / total) : '0',
        }
      })

  const [kpis, porSector, porTipo, porMes, porDepto, porEstado, list] = await Promise.all([
    kpisPromise,
    socrataQuery('contratos', {
      '$select': 'sector, count(*) as total, sum(valor_del_contrato) as valor_total',
      '$group': 'sector', '$order': 'valor_total DESC', '$limit': '15',
      '$where': mergeWhere('sector IS NOT NULL', where),
    }),
    socrataQuery('contratos', {
      '$select': 'tipo_de_contrato, count(*) as total', '$group': 'tipo_de_contrato',
      '$order': 'total DESC', '$limit': '15',
      '$where': mergeWhere('tipo_de_contrato IS NOT NULL', where),
    }),
    socrataQuery('contratos', {
      '$select': 'date_trunc_ym(fecha_de_firma) as mes, count(*) as total, sum(valor_del_contrato) as valor_total',
      '$group': 'mes', '$order': 'mes ASC', '$limit': '60',
      '$where': mergeWhere('fecha_de_firma IS NOT NULL',
        filters.year && /^\d{4}$/.test(filters.year) ? `date_extract_y(fecha_de_firma) = ${filters.year}` : ''),
    }),
    socrataQuery('contratos', {
      '$select': 'departamento, count(*) as total, sum(valor_del_contrato) as valor_total',
      '$group': 'departamento', '$order': 'valor_total DESC', '$limit': '15',
      '$where': mergeWhere('departamento IS NOT NULL', where),
    }),
    socrataQuery('contratos', {
      '$select': 'estado_contrato, count(*) as total', '$group': 'estado_contrato',
      '$order': 'total DESC', '$where': mergeWhere('estado_contrato IS NOT NULL', where),
    }),
    socrataQuery('contratos', {
      '$limit': String(limit), '$offset': String((page - 1) * limit), '$order': 'fecha_de_firma DESC',
      ...(where ? { '$where': where } : {}),
    }),
  ])

  return { kpis, porSector, porTipo, porMes, porDepto, porEstado, list }
}

export async function loadArchivosMetadata() {
  const [years, entidades] = await Promise.all([
    socrataQuery('archivos', {
      '$select': 'date_extract_y(fecha_carga) as year', '$group': 'year',
      '$order': 'year DESC', '$limit': '10', '$where': 'fecha_carga IS NOT NULL',
    }),
    socrataQuery('archivos', {
      '$select': 'entidad', '$group': 'entidad', '$order': 'entidad ASC',
      '$limit': '300', '$where': 'entidad IS NOT NULL',
    }),
  ]) as any[][]
  return {
    years: years.map(row => row.year).filter(Boolean).sort((a: number, b: number) => b - a),
    entidades: entidades.map(row => row.entidad).filter(Boolean),
  }
}

export async function loadArchivosDashboard(filters: ArchivosFilters = {}) {
  const where = archivosWhere(filters)
  const page = Math.max(Number(filters.page ?? 1), 1)
  const limit = Math.min(Math.max(Number(filters.limit ?? 20), 1), 100)
  const monthWhere = mergeWhere('fecha_carga IS NOT NULL',
    filters.year && /^\d{4}$/.test(filters.year) ? `date_extract_y(fecha_carga) = ${filters.year}` : '')

  const [kpisRows, porExtension, porMes, porEntidad, list] = await Promise.all([
    socrataQuery('archivos', {
      '$select': 'count(*) as total, sum(tamanno_archivo) as tamanno_total',
      ...(where ? { '$where': where } : {}),
    }),
    socrataQuery('archivos', {
      '$select': 'extensi_n as extension, count(*) as total, sum(tamanno_archivo) as tamanno_total',
      '$group': 'extensi_n', '$order': 'total DESC', '$limit': '20',
      '$where': mergeWhere('extensi_n IS NOT NULL', where),
    }),
    socrataQuery('archivos', {
      '$select': 'date_trunc_ym(fecha_carga) as mes, count(*) as total, sum(tamanno_archivo) as tamanno_total',
      '$group': 'mes', '$order': 'mes ASC', '$limit': '60', '$where': monthWhere,
    }),
    socrataQuery('archivos', {
      '$select': 'entidad, count(*) as total, sum(tamanno_archivo) as tamanno_total',
      '$group': 'entidad', '$order': 'total DESC', '$limit': '20',
      '$where': mergeWhere('entidad IS NOT NULL', where),
    }),
    socrataQuery('archivos', {
      '$limit': String(limit), '$offset': String((page - 1) * limit), '$order': 'fecha_carga DESC',
      ...(where ? { '$where': where } : {}),
    }),
  ]) as any[][]

  return { kpis: kpisRows[0] ?? {}, porExtension, porMes, porEntidad, list }
}

function alertStats() {
  const rows = db.query<{ nivel_riesgo: string; c: number }, []>(
    `SELECT nivel_riesgo, COUNT(*) c FROM scores GROUP BY nivel_riesgo`,
  ).all()
  const counts = Object.fromEntries(rows.map(row => [row.nivel_riesgo, row.c]))
  const contracts = db.query<{ c: number; value: number | null }, []>(
    `SELECT COUNT(*) c, SUM(valor) value FROM contratos_cache`,
  ).get()
  return {
    total: rows.reduce((sum, row) => sum + row.c, 0),
    rojos: counts.ROJO ?? 0, amarillos: counts.AMARILLO ?? 0, verdes: counts.VERDE ?? 0,
    contratos_analizados: contracts?.c ?? 0, valor_analizado: contracts?.value ?? 0,
  }
}

export async function loadAlertasBootstrap() {
  const sectores = await getSectores()
  const sector = sectores.includes('Transporte') ? 'Transporte' : sectores[0] ?? 'Transporte'
  let rows = db.query<any, [string]>(
    `SELECT * FROM scores WHERE sector = ? ORDER BY score_total DESC LIMIT 30`,
  ).all(sector)

  if (rows.length === 0) rows = await scoreSectorBatch(sector, 30)

  const scores = rows.map(row => {
    const flags: string[] = Array.isArray(row.flags) ? row.flags : JSON.parse(row.flags)
    return { ...row, flags, sancionado_paco: hasSanctionFlag(flags) }
  })
  const oldest = db.query<{ value: number }, [string]>(
    `SELECT COALESCE(MIN(calculado_at), unixepoch()) value FROM scores WHERE sector = ?`,
  ).get(sector)?.value ?? Math.floor(Date.now() / 1000)

  return {
    sectores,
    stats: alertStats(),
    data: {
      total: scores.length, scores, cached: true, stale: false, sector, nivel: null,
      generated_at: new Date(oldest * 1000).toISOString(),
    },
  }
}

export async function loadDashboardBootstrap() {
  const [contratosMetadata, contratosData, archivosMetadata, archivosData, alertas] = await Promise.all([
    loadContratosMetadata(), loadContratosDashboard(),
    loadArchivosMetadata(), loadArchivosDashboard(), loadAlertasBootstrap(),
  ])
  return {
    home: { contratos: contratosData.kpis, alertas: alertas.stats },
    contratos: { metadata: contratosMetadata, data: contratosData },
    archivos: { metadata: archivosMetadata, data: archivosData },
    alertas,
  }
}
