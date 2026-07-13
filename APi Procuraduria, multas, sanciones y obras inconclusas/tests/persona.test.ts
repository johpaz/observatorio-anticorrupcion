/**
 * Tests del servicio de sanciones (Procuraduría/SIRI, CGR, multas SECOP, obras).
 * Valida el contrato del endpoint /persona/:documento que consume el scorer
 * de la API principal (checkSanciones), y las estadísticas agregadas.
 *
 * Usa una DB temporal con fixtures — no toca data.db.
 */
import { describe, test, expect, beforeAll } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { Elysia } from 'elysia'

process.env.DATA_DB_PATH = join(mkdtempSync(join(tmpdir(), 'procu-test-')), 'data.db')

const { getDb } = await import('../src/db/database')
const { createSchema } = await import('../src/db/schema')
const { searchRoutes } = await import('../src/routes/search')

const app = new Elysia().use(searchRoutes)
const get = async (path: string) => {
  const res = await app.handle(new Request(`http://local${path}`))
  return { status: res.status, body: await res.json() }
}

const NIT_SANCIONADO = '900123456'
const NIT_LIMPIO = '800999888'

beforeAll(() => {
  createSchema()
  const db = getDb()

  db.run(
    `INSERT INTO fiscales (responsable, documento, entidad_afectada, departamento, municipio)
     VALUES ('PEREZ GOMEZ JUAN', ?, 'ALCALDIA DE PRUEBA', 'CUNDINAMARCA', 'SOACHA')`,
    [NIT_SANCIONADO],
  )
  db.run(
    `INSERT INTO disciplinarios (documento, nombre1, apellido1, institucion, tipo_sancion_aplicada, depto_origen)
     VALUES (?, 'JUAN', 'PEREZ', 'GOBERNACION DE PRUEBA', 'DESTITUCION', 'CUNDINAMARCA')`,
    [NIT_SANCIONADO],
  )
  db.run(
    `INSERT INTO multas_secop (entidad, nombre_responsable, cedula_responsable, valor_multa)
     VALUES ('ENTIDAD DE PRUEBA', 'PEREZ GOMEZ JUAN', ?, 15000000)`,
    [NIT_SANCIONADO],
  )
})

describe('GET /persona/:documento (contrato consumido por el scorer)', () => {
  test('documento con registros → resumen con los booleanos correctos', async () => {
    const { status, body } = await get(`/persona/${NIT_SANCIONADO}`)
    expect(status).toBe(200)
    expect(body.resumen).toEqual({
      tiene_antecedentes_fiscales: true,
      tiene_antecedentes_disciplinarios: true,
      tiene_multas_secop: true,
      tiene_obras_relacionadas: false,
      total_registros: 3,
    })
    expect(body.fiscales).toHaveLength(1)
    expect(body.disciplinarios).toHaveLength(1)
    expect(body.multas).toHaveLength(1)
  })

  test('documento limpio → todos los booleanos en false y 0 registros', async () => {
    const { body } = await get(`/persona/${NIT_LIMPIO}`)
    expect(body.resumen).toEqual({
      tiene_antecedentes_fiscales: false,
      tiene_antecedentes_disciplinarios: false,
      tiene_multas_secop: false,
      tiene_obras_relacionadas: false,
      total_registros: 0,
    })
  })

  test('la forma del resumen coincide con SancionesResumen de la API principal', async () => {
    const { body } = await get(`/persona/${NIT_SANCIONADO}`)
    // Campos exactos que lee api/src/services/procuraduria.ts
    for (const key of [
      'tiene_antecedentes_fiscales',
      'tiene_antecedentes_disciplinarios',
      'tiene_multas_secop',
      'tiene_obras_relacionadas',
    ]) {
      expect(typeof body.resumen[key]).toBe('boolean')
    }
    expect(typeof body.resumen.total_registros).toBe('number')
  })
})

describe('GET /stats', () => {
  test('los totales reflejan las filas insertadas', async () => {
    const { body } = await get('/stats')
    expect(body.totales.fiscales).toBe(1)
    expect(body.totales.disciplinarios).toBe(1)
    expect(body.totales.multas_secop).toBe(1)
    expect(body.totales.obras).toBe(0)
    expect(body.valor_total_multas).toBe(15000000)
  })
})

describe('GET /search', () => {
  test('encuentra al sancionado por nombre en las fuentes correctas', async () => {
    const { body } = await get('/search?q=PEREZ')
    expect(body.totales.fiscales).toBe(1)
    expect(body.totales.multas).toBe(1)
    expect(body.results.fiscales[0].documento).toBe(NIT_SANCIONADO)
  })

  test('término de menos de 2 caracteres es rechazado', async () => {
    const res = await app.handle(new Request('http://local/search?q=P'))
    expect(res.status).not.toBe(200)
  })
})
