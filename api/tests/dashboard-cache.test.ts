import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

process.env.DASHBOARD_CACHE_TTL = '1'
process.env.ANTICORRUP_DB_PATH = join(mkdtempSync(join(tmpdir(), 'dashboard-cache-test-')), 'test.db')

const { initDb } = await import('../src/db/client')
const { cachedDashboard } = await import('../src/services/dashboard-cache')

beforeAll(() => initDb())

describe('caché consolidado del dashboard', () => {
  test('diez cargas concurrentes comparten una sola ejecución', async () => {
    let calls = 0
    const loader = async () => {
      calls++
      await Bun.sleep(10)
      return { value: 'ok' }
    }

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => cachedDashboard('concurrent', loader)),
    )
    expect(calls).toBe(1)
    expect(responses.every(response => response.data.value === 'ok')).toBe(true)
  })

  test('una copia vencida responde de inmediato y se renueva en segundo plano', async () => {
    let version = 1
    await cachedDashboard('stale', async () => ({ version }))
    await Bun.sleep(1100)

    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    version = 2
    const stale = await cachedDashboard('stale', async () => {
      await gate
      return { version }
    })

    expect(stale.cache_status).toBe('stale')
    expect(stale.refreshing).toBe(true)
    expect(stale.data.version).toBe(1)

    const refreshedPromise = cachedDashboard('stale', async () => ({ version }), true)
    release()
    const refreshed = await refreshedPromise
    expect(refreshed.cache_status).toBe('fresh')
    expect(refreshed.data.version).toBe(2)
  })

  test('si la renovación falla conserva la última copia', async () => {
    await cachedDashboard('fallback', async () => ({ safe: true }))
    const response = await cachedDashboard('fallback', async () => {
      throw new Error('fuente caída')
    }, true)
    expect(response.cache_status).toBe('stale')
    expect(response.data.safe).toBe(true)
  })
})
