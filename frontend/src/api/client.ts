const API_BASE = '/api'

async function fetchData(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${window.location.origin}${API_BASE}${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Error ${res.status} en ${endpoint}`)
  return res.json()
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
