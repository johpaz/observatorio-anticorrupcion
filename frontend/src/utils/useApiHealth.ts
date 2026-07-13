import { useEffect, useState } from 'react'

export type ApiHealth = 'ok' | 'down' | 'checking'

const HEALTHY_INTERVAL = 30_000 // API sana: ping cada 30s
const DOWN_INTERVAL = 5_000     // API caída: reintento cada 5s

/** Heartbeat contra /api/health — el proxy solo expone /api/*. */
export function useApiHealth(): ApiHealth {
  const [status, setStatus] = useState<ApiHealth>('checking')

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    const ping = async () => {
      let ok = false
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3_000) })
        ok = res.ok
      } catch {
        ok = false
      }
      if (!alive) return
      setStatus(ok ? 'ok' : 'down')
      timer = setTimeout(ping, ok ? HEALTHY_INTERVAL : DOWN_INTERVAL)
    }

    ping()
    return () => { alive = false; clearTimeout(timer) }
  }, [])

  return status
}
