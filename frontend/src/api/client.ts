const API_BASE = '/api'
const DASHBOARD_CACHE_TTL = 15 * 60 * 1000

interface ClientCacheEntry {
  data: unknown
  updatedAt: number
}

const responseCache = new Map<string, ClientCacheEntry>()
const inFlight = new Map<string, Promise<unknown>>()

async function requestData(url: string, endpoint: string, retries: number): Promise<any> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Error ${res.status} en ${endpoint}`)
    return await res.json()
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, retries === 2 ? 800 : 2000))
      return requestData(url, endpoint, retries - 1)
    }
    throw err
  }
}

async function fetchData(
  endpoint: string,
  params: Record<string, string> = {},
  retries = 2,
  shared = false,
): Promise<any> {
  const url = new URL(`${window.location.origin}${API_BASE}${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) url.searchParams.set(k, v)
  }
  const key = url.toString()
  const forceRefresh = params.refresh === '1'
  const sharedUrl = new URL(url)
  sharedUrl.searchParams.delete('refresh')
  const sharedKey = sharedUrl.toString()
  if (shared && !forceRefresh) {
    const cached = responseCache.get(sharedKey)
    if (cached && Date.now() - cached.updatedAt < DASHBOARD_CACHE_TTL) return cached.data
  }

  const pending = inFlight.get(sharedKey)
  if (shared && pending) return pending

  const request = requestData(key, endpoint, retries).then(data => {
    if (shared) {
      responseCache.set(sharedKey, {
        data,
        // La vigencia del cliente empieza cuando recibe la respuesta. La edad de
        // la fuente se administra de forma independiente en el caché del API.
        updatedAt: Date.now(),
      })
    }
    return data
  }).finally(() => inFlight.delete(sharedKey))

  if (shared) inFlight.set(sharedKey, request)
  return request
}

export function clearDashboardRequestCache(): void {
  responseCache.clear()
  inFlight.clear()
}

export interface ContratosMetadata {
  years: number[]
  departamentos: string[]
  sectores: string[]
  tipos: string[]
  estados: string[]
}

export interface ArchivosMetadata {
  years: number[]
  entidades: string[]
}

export interface ContratosDashboardData {
  kpis: any
  porSector: any[]
  porTipo: any[]
  porMes: any[]
  porDepto: any[]
  porEstado: any[]
  list: any[]
}

export interface ArchivosDashboardData {
  kpis: any
  porExtension: any[]
  porMes: any[]
  porEntidad: any[]
  list: any[]
}

export interface CachedDashboardResponse<T> {
  data: T
  cache_status: 'fresh' | 'stale'
  updated_at: string
  refreshing: boolean
}

export const contratosApi = {
  kpis: (p: Record<string, string>) => fetchData('/contratos/kpis', p),
  porSector: (p: Record<string, string>) => fetchData('/contratos/por-sector', p),
  porTipo: (p: Record<string, string>) => fetchData('/contratos/por-tipo', p),
  porMes: (p: Record<string, string>) => fetchData('/contratos/por-mes', p),
  porDepartamento: (p: Record<string, string>) => fetchData('/contratos/por-departamento', p),
  porEstado: (p: Record<string, string>) => fetchData('/contratos/por-estado', p),
  metadata: (): Promise<ContratosMetadata> => fetchData('/contratos/metadata'),
  list: (p: Record<string, string>) => fetchData('/contratos/list', p),
}

export const archivosApi = {
  kpis: (p: Record<string, string>) => fetchData('/archivos/kpis', p),
  porExtension: (p: Record<string, string>) => fetchData('/archivos/por-extension', p),
  porMes: (p: Record<string, string>) => fetchData('/archivos/por-mes', p),
  porEntidad: (p: Record<string, string>) => fetchData('/archivos/por-entidad', p),
  metadata: (): Promise<ArchivosMetadata> => fetchData('/archivos/metadata'),
  list: (p: Record<string, string>) => fetchData('/archivos/list', p),
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

export interface AlertasResponse {
  total: number
  scores: ScoreResult[]
  cached: boolean
  /** true = datos servidos de SQLite mientras se recalculan en segundo plano */
  stale: boolean
  sector: string
  nivel: string | null
  generated_at: string
}

export interface DashboardBootstrap {
  home: {
    contratos: Record<string, unknown>
    alertas: Record<string, unknown>
  }
  contratos: { metadata: ContratosMetadata; data: ContratosDashboardData }
  archivos: { metadata: ArchivosMetadata; data: ArchivosDashboardData }
  alertas: {
    sectores: string[]
    stats: Record<string, unknown>
    data: AlertasResponse
  }
}

export const dashboardApi = {
  bootstrap: (refresh = false): Promise<CachedDashboardResponse<DashboardBootstrap>> =>
    fetchData('/dashboard/bootstrap', refresh ? { refresh: '1' } : {}, 2, true),
  contratos: (
    params: Record<string, string>,
    refresh = false,
  ): Promise<CachedDashboardResponse<ContratosDashboardData>> =>
    fetchData('/contratos/dashboard', refresh ? { ...params, refresh: '1' } : params, 2, true),
  archivos: (
    params: Record<string, string>,
    refresh = false,
  ): Promise<CachedDashboardResponse<ArchivosDashboardData>> =>
    fetchData('/archivos/dashboard', refresh ? { ...params, refresh: '1' } : params, 2, true),
}

export interface ContratoSummary {
  contrato_id: string
  entidad: string | null
  valor: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: string | null
  sector: string | null
}

export interface SancionesResumen {
  tiene_antecedentes_fiscales: boolean
  tiene_antecedentes_disciplinarios: boolean
  tiene_multas_secop: boolean
  tiene_obras_relacionadas: boolean
  total_registros: number
}

export interface SancionesDetalle {
  resumen: SancionesResumen
  fiscales: {
    responsable?: string
    entidad_afectada?: string
    departamento?: string
    municipio?: string
  }[]
  disciplinarios: {
    nombre1?: string
    apellido1?: string
    tipo_sancion_aplicada?: string
    institucion?: string
    fecha_sancion?: string
    duracion_anos?: number
  }[]
  multas: {
    entidad?: string
    resolucion?: string
    valor_multa?: number
    fecha_imposicion?: string
    ref_contrato?: string
  }[]
  obras: {
    nombre_entidad?: string
    objeto?: string
    valor_contrato?: number
    estado?: string
    avance?: number
    departamento?: string
  }[]
}

export interface ContratistaResponse extends ScoreResult {
  contratos: ContratoSummary[]
  sanciones: SancionesDetalle | null
  cached: boolean
  calculado_at: string
}

export interface DesgloseAnio {
  anio: string
  trimestre: number
  contratos: number
  valor: number
}

export interface DesgloseGrupo {
  contratos: number
  valor: number
}

export interface AlertasDesglose {
  sector: string
  por_anio: DesgloseAnio[]
  por_entidad: ({ entidad: string } & DesgloseGrupo)[]
  por_departamento: ({ departamento: string } & DesgloseGrupo)[]
}

export const alertasApi = {
  get: (p: { sector?: string; nivel?: string; limit?: string; refresh?: string }): Promise<AlertasResponse> =>
    fetchData('/alertas', p as Record<string, string>),
  desglose: (sector: string): Promise<AlertasDesglose> =>
    fetchData('/alertas/desglose', { sector }),
  sectores: (): Promise<string[]> =>
    fetchData('/alertas/sectores').then(d => d.sectores ?? []),
}

export const contratistaApi = {
  get: (nit: string, refresh = false): Promise<ContratistaResponse> =>
    fetchData(`/contratista/${encodeURIComponent(nit)}`, refresh ? { refresh: '1' } : {}),
}
