const API_BASE = '/api'

async function fetchData(endpoint: string, params: Record<string, string> = {}, retries = 2): Promise<any> {
  const url = new URL(`${window.location.origin}${API_BASE}${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) url.searchParams.set(k, v)
  }
  try {
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Error ${res.status} en ${endpoint}`)
    return await res.json()
  } catch (err) {
    // Reintentos con backoff (0.8s, 2s): cubren reinicios del API en dev (--watch)
    // y microcortes del proxy sin que el usuario vea el error
    if (retries > 0) {
      await new Promise(r => setTimeout(r, retries === 2 ? 800 : 2000))
      return fetchData(endpoint, params, retries - 1)
    }
    throw err
  }
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
