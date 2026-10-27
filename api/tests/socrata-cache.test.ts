/**
 * Tests del caché de Socrata (datos.gov.co) en sus dos capas:
 *  - in-memory con TTL configurable (CACHE_TTL)
 *  - respaldo persistente en SQLite: si Socrata falla, se sirve la última
 *    copia local en vez de propagar el error (stale-on-error)
 * Fetch global mockeado: sin red. DB temporal: no toca anticorrup.db.
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

process.env.CACHE_TTL = '1' // 1 segundo, para probar expiración sin esperas largas
process.env.ANTICORRUP_DB_PATH = join(mkdtempSync(join(tmpdir(), 'socrata-test-')), 'test.db')

const { initDb } = await import('../src/db/client')
initDb()
const { socrataQuery } = await import('../src/services/socrata')

let fetchCalls: string[] = []
let nextResponse: () => Response | Promise<Response> = () => Response.json([{ ok: true }])

globalThis.fetch = (async (url: any) => {
  fetchCalls.push(String(url))
  return nextResponse()
}) as typeof fetch

beforeEach(() => {
  fetchCalls = []
  nextResponse = () => Response.json([{ ok: true }])
})

describe('Caché Socrata en memoria', () => {
  test('la misma consulta dentro del TTL hace una sola petición HTTP', async () => {
    const params = { $limit: '5', $where: `sector='CacheTest-${Date.now()}'` }
    const a = await socrataQuery('contratos', params)
    const b = await socrataQuery('contratos', params)
    expect(fetchCalls).toHaveLength(1)
    expect(b).toEqual(a)
  })

  test('consultas distintas no comparten caché', async () => {
    const stamp = Date.now()
    await socrataQuery('contratos', { $limit: '5', $where: `sector='A-${stamp}'` })
    await socrataQuery('contratos', { $limit: '5', $where: `sector='B-${stamp}'` })
    expect(fetchCalls).toHaveLength(2)
  })

  test('consultas concurrentes idénticas comparten una sola petición en curso', async () => {
    const params = { $limit: '5', $where: `sector='FLIGHT-${Date.now()}'` }
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    nextResponse = async () => {
      await gate
      return Response.json([{ shared: true }])
    }

    const requests = Array.from({ length: 10 }, () => socrataQuery('contratos', params))
    await Bun.sleep(10)
    expect(fetchCalls).toHaveLength(1)
    release()

    const results = await Promise.all(requests)
    expect(results.every(result => (result[0] as any).shared)).toBe(true)
    expect(fetchCalls).toHaveLength(1)
  })

  test('expirado el TTL se vuelve a consultar la fuente', async () => {
    const params = { $limit: '5', $where: `sector='TTL-${Date.now()}'` }
    await socrataQuery('contratos', params)
    await Bun.sleep(1100) // TTL = 1s
    await socrataQuery('contratos', params)
    expect(fetchCalls).toHaveLength(2)
  })

  test('la URL apunta al dataset SECOP II real de datos.gov.co (jbjy-vk9h)', async () => {
    await socrataQuery('contratos', { $limit: '1', $where: `sector='URL-${Date.now()}'` })
    expect(fetchCalls[0]).toStartWith('https://www.datos.gov.co/resource/jbjy-vk9h.json')
  })
})

describe('Respaldo persistente en SQLite (stale-on-error)', () => {
  test('si Socrata falla y nunca hubo copia local, el error se propaga', async () => {
    const params = { $limit: '5', $where: `sector='ERR-${Date.now()}'` }
    nextResponse = () => new Response('boom', { status: 500 })
    await expect(socrataQuery('contratos', params)).rejects.toThrow('Socrata 500')

    // El error no queda cacheado: el retry vuelve a la red
    nextResponse = () => Response.json([{ recovered: true }])
    const data = await socrataQuery('contratos', params)
    expect(fetchCalls).toHaveLength(2)
    expect(data).toEqual([{ recovered: true }])
  })

  test('si Socrata falla pero hay copia local, se sirve la copia en vez del error', async () => {
    const params = { $limit: '5', $where: `sector='STALE-${Date.now()}'` }

    nextResponse = () => Response.json([{ valor: 'copia-buena' }])
    await socrataQuery('contratos', params) // éxito → persiste en SQLite

    await Bun.sleep(1100) // expira el caché en memoria
    nextResponse = () => new Response('Socrata caído', { status: 503 })
    const data = await socrataQuery('contratos', params)

    expect(data).toEqual([{ valor: 'copia-buena' }]) // sirvió el respaldo
    expect(fetchCalls).toHaveLength(2)               // sí intentó la red primero
  })

  test('la copia servida por respaldo se cachea en memoria (no martilla a Socrata caído)', async () => {
    const params = { $limit: '5', $where: `sector='HOLD-${Date.now()}'` }

    nextResponse = () => Response.json([{ v: 1 }])
    await socrataQuery('contratos', params)

    await Bun.sleep(1100)
    nextResponse = () => new Response('down', { status: 503 })
    await socrataQuery('contratos', params)      // falla → respaldo (fetch #2)
    await socrataQuery('contratos', params)      // dentro del TTL → memoria, sin fetch
    expect(fetchCalls).toHaveLength(2)
  })

  test('un fallo de red (fetch rechazado) también activa el respaldo', async () => {
    const params = { $limit: '5', $where: `sector='NET-${Date.now()}'` }

    nextResponse = () => Response.json([{ v: 'ok' }])
    await socrataQuery('contratos', params)

    await Bun.sleep(1100)
    nextResponse = () => { throw new Error('socket hang up') }
    const data = await socrataQuery('contratos', params)
    expect(data).toEqual([{ v: 'ok' }])
  })
})
