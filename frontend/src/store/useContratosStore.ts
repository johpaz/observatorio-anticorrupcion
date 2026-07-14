import { create } from 'zustand'
import type { ContratosMetadata } from '../api/client'

export interface ContratosFilters {
  year: string
  quarter: string
  departamento: string
  sector: string
  tipo_de_contrato: string
  estado_contrato: string
}

export const CONTRATOS_INITIAL: ContratosFilters = {
  year: '', quarter: '', departamento: '', sector: '', tipo_de_contrato: '', estado_contrato: '',
}

interface DashboardData {
  kpis: any
  porSector: any[]
  porTipo: any[]
  porMes: any[]
  porDepto: any[]
  porEstado: any[]
  list: any[]
}

interface CacheEntry extends DashboardData {
  ts: number
}

const EMPTY_DATA: DashboardData = {
  kpis: {}, porSector: [], porTipo: [], porMes: [], porDepto: [], porEstado: [], list: [],
}

const CACHE_TTL = 15 * 60 * 1000

interface Store {
  metadata: ContratosMetadata | null
  metadataLoaded: boolean
  filters: ContratosFilters
  page: number
  loading: boolean
  data: DashboardData
  cache: Map<string, CacheEntry>

  setMetadata: (meta: ContratosMetadata) => void
  setFilters: (filters: ContratosFilters) => void
  setPage: (page: number) => void
  setLoading: (loading: boolean) => void
  setData: (data: DashboardData) => void
  getFromCache: (key: string) => DashboardData | null
  saveToCache: (key: string, data: DashboardData) => void
}

export const useContratosStore = create<Store>((set, get) => ({
  metadata: null,
  metadataLoaded: false,
  filters: CONTRATOS_INITIAL,
  page: 1,
  loading: false,
  data: EMPTY_DATA,
  cache: new Map(),

  setMetadata: (metadata) => set({ metadata, metadataLoaded: true }),
  setFilters: (filters) => set({ filters, page: 1 }),
  setPage: (page) => set({ page }),
  setLoading: (loading) => set({ loading }),
  setData: (data) => set({ data }),

  getFromCache: (key) => {
    const entry = get().cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > CACHE_TTL) {
      get().cache.delete(key)
      return null
    }
    const { ts: _ts, ...data } = entry
    return data
  },

  saveToCache: (key, data) => {
    get().cache.set(key, { ...data, ts: Date.now() })
  },
}))

export function cacheKey(filters: ContratosFilters, page: number): string {
  return JSON.stringify({ ...filters, page })
}
