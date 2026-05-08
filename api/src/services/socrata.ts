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

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`Socrata ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as unknown[]
  cache.set(key, { data, expires: now + TTL })
  return data
}
