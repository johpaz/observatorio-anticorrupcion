import { db } from '../db/client'
import { createLogger } from '../utils/logger'

const log = createLogger('dashboard-cache')
const TTL_SEC = Number(Bun.env.DASHBOARD_CACHE_TTL ?? 900)
const inFlight = new Map<string, Promise<unknown>>()

export type CacheStatus = 'fresh' | 'stale'

export interface CachedResponse<T> {
  data: T
  cache_status: CacheStatus
  updated_at: string
  refreshing: boolean
}

interface CacheRow {
  data: string
  updated_at: number
}

async function refreshResource<T>(key: string, loader: () => Promise<T>): Promise<CachedResponse<T>> {
  const existing = inFlight.get(key) as Promise<CachedResponse<T>> | undefined
  if (existing) return existing

  const request = (async () => {
    const data = await loader()
    const updatedAt = Math.floor(Date.now() / 1000)
    db.prepare(`
      INSERT INTO dashboard_cache (key, data, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `).run(key, JSON.stringify(data), updatedAt)
    return {
      data,
      cache_status: 'fresh' as const,
      updated_at: new Date(updatedAt * 1000).toISOString(),
      refreshing: false,
    }
  })().finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}

export async function cachedDashboard<T>(
  key: string,
  loader: () => Promise<T>,
  forceRefresh = false,
): Promise<CachedResponse<T>> {
  const row = db.query<CacheRow, [string]>(
    `SELECT data, updated_at FROM dashboard_cache WHERE key = ?`,
  ).get(key)

  if (forceRefresh) {
    try {
      return await refreshResource(key, loader)
    } catch (error) {
      if (!row) throw error
      log.warn(`actualización fallida para ${key}; se conserva la copia local: ${String(error)}`)
      return {
        data: JSON.parse(row.data) as T,
        cache_status: 'stale',
        updated_at: new Date(row.updated_at * 1000).toISOString(),
        refreshing: false,
      }
    }
  }

  if (row) {
    const fresh = row.updated_at > Math.floor(Date.now() / 1000) - TTL_SEC
    if (fresh) {
      return {
        data: JSON.parse(row.data) as T,
        cache_status: 'fresh',
        updated_at: new Date(row.updated_at * 1000).toISOString(),
        refreshing: false,
      }
    }

    void refreshResource(key, loader).catch(error =>
      log.warn(`renovación en segundo plano falló para ${key}: ${String(error)}`),
    )
    return {
      data: JSON.parse(row.data) as T,
      cache_status: 'stale',
      updated_at: new Date(row.updated_at * 1000).toISOString(),
      refreshing: true,
    }
  }

  return refreshResource(key, loader)
}

export function canonicalCacheKey(prefix: string, params: Record<string, string | undefined>): string {
  const normalized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
  return `${prefix}:${JSON.stringify(Object.fromEntries(normalized))}`
}
