import { create } from 'zustand'
import type { ContratistaResponse } from '../api/client'

interface CacheEntry { data: ContratistaResponse; ts: number }
const CACHE_TTL = 10 * 60 * 1000

interface Store {
  loading: boolean
  cache: Map<string, CacheEntry>

  setLoading: (v: boolean) => void
  getProfile: (nit: string) => ContratistaResponse | null
  saveProfile: (nit: string, data: ContratistaResponse) => void
}

export const useContratistasStore = create<Store>((set, get) => ({
  loading: false,
  cache: new Map(),

  setLoading: (loading) => set({ loading }),

  getProfile: (nit) => {
    const entry = get().cache.get(nit)
    if (!entry) return null
    if (Date.now() - entry.ts > CACHE_TTL) { get().cache.delete(nit); return null }
    return entry.data
  },

  saveProfile: (nit, data) => {
    get().cache.set(nit, { data, ts: Date.now() })
  },
}))
