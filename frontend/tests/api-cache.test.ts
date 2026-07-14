import { beforeEach, describe, expect, test } from 'bun:test'
import { clearDashboardRequestCache, dashboardApi } from '../src/api/client'

let calls = 0

beforeEach(() => {
  calls = 0
  clearDashboardRequestCache()
})

describe('caché compartido del dashboard', () => {
  test('diez consumidores concurrentes comparten una sola llamada bootstrap', async () => {
    globalThis.fetch = (async () => {
      calls++
      await Bun.sleep(10)
      return Response.json({
        data: {}, cache_status: 'fresh', updated_at: new Date().toISOString(), refreshing: false,
      })
    }) as typeof fetch

    await Promise.all(Array.from({ length: 10 }, () => dashboardApi.bootstrap()))
    expect(calls).toBe(1)
  })

  test('navegaciones posteriores reutilizan el bootstrap durante quince minutos', async () => {
    globalThis.fetch = (async () => {
      calls++
      return Response.json({
        data: { marker: calls }, cache_status: 'fresh',
        updated_at: new Date().toISOString(), refreshing: false,
      })
    }) as typeof fetch

    const first = await dashboardApi.bootstrap()
    const second = await dashboardApi.bootstrap()
    expect(second).toEqual(first)
    expect(calls).toBe(1)
  })
})
