import { create } from 'zustand'
import type { AlertasResponse } from '../api/client'

export interface AlertasFilters {
  sector: string
}

export const ALERTAS_INITIAL: AlertasFilters = { sector: 'Transporte' }

interface CacheEntry { data: AlertasResponse; ts: number }
const CACHE_TTL = 15 * 60 * 1000

interface Store {
  filters: AlertasFilters
  loading: boolean
  data: AlertasResponse | null
  cache: Map<string, CacheEntry>

  setFilters: (f: AlertasFilters) => void
  setLoading: (v: boolean) => void
  setData: (d: AlertasResponse | null) => void
  getFromCache: (key: string) => AlertasResponse | null
  saveToCache: (key: string, data: AlertasResponse) => void
  clearCache: (key: string) => void
}

export const useAlertasStore = create<Store>((set, get) => ({
  filters: ALERTAS_INITIAL,
  loading: false,
  data: null,
  cache: new Map(),

  setFilters: (filters) => set({ filters }),
  setLoading: (loading) => set({ loading }),
  setData: (data) => set({ data }),

  getFromCache: (key) => {
    const entry = get().cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > CACHE_TTL) { get().cache.delete(key); return null }
    return entry.data
  },
  saveToCache: (key, data) => {
    get().cache.set(key, { data, ts: Date.now() })
  },
  clearCache: (key) => {
    get().cache.delete(key)
  },
}))

export const alertasCacheKey = (f: AlertasFilters) => f.sector
