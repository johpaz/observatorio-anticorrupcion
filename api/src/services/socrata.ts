import { db } from '../db/client'

const BASES: Record<string, string> = {
  contratos: 'https://www.datos.gov.co/resource/jbjy-vk9h.json',
  archivos: 'https://www.datos.gov.co/resource/dmgg-8hin.json',
}

interface CacheEntry {
  data: unknown[]
  expires: number
}

const cache = new Map<string, CacheEntry>()
const TTL = Number(Bun.env.CACHE_TTL ?? 300) * 1000

export async function socrataQuery(
  dataset: keyof typeof BASES,
  params: Record<string, string>
): Promise<unknown[]> {
  const key = `${dataset}:${JSON.stringify(params)}`
  const now = Date.now()

  const cached = cache.get(key)
  if (cached && cached.expires > now) return cached.data

  const url = new URL(BASES[dataset])
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }
  const token = Bun.env.SOCRATA_APP_TOKEN
  if (token) url.searchParams.set('$$app_token', token)

  try {
    // 45s: los agregados de datos.gov.co fluctúan entre 5s y 40s según su carga;
    // debe ser menor que el idleTimeout del servidor (60s en index.ts)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(45_000) })
    if (!res.ok) throw new Error(`Socrata ${res.status}: ${await res.text()}`)

    const data = (await res.json()) as unknown[]
    cache.set(key, { data, expires: now + TTL })
    // Copia persistente: respaldo local cuando datos.gov.co se degrada
    db.prepare(`INSERT OR REPLACE INTO socrata_cache (key, data, updated_at) VALUES (?, ?, unixepoch())`)
      .run(key, JSON.stringify(data))
    return data
  } catch (err) {
    // Socrata caído o lento: servir la última copia local en vez de fallar
    const stale = db.query<{ data: string; updated_at: number }, [string]>(
      `SELECT data, updated_at FROM socrata_cache WHERE key = ?`
    ).get(key)
    if (stale) {
      console.warn(
        `[socrata] fuente degradada — sirviendo copia local de ${dataset} ` +
        `(actualizada ${new Date(stale.updated_at * 1000).toISOString()}): ${String(err)}`
      )
      const data = JSON.parse(stale.data) as unknown[]
      // Se cachea en memoria para no martillar a Socrata mientras dura la caída
      cache.set(key, { data, expires: now + TTL })
      return data
    }
    throw err
  }
}
