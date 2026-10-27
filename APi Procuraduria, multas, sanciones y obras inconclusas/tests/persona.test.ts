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

describe('GET /search por nombre completo', () => {
  test('encuentra "nombre apellido" y "apellido nombre"', async () => {
    for (const q of ['juan perez', 'perez juan']) {
      const { body } = await get(`/search?q=${encodeURIComponent(q)}`)
      expect(body.results.disciplinarios.some((d: any) => d.documento === NIT_SANCIONADO)).toBe(true)
    }
  })
})

describe('GET /persona/:documento — coincidencia exacta de documentos', () => {
  beforeAll(() => {
    const db = getDb()
    db.run(`INSERT INTO fiscales (responsable, documento, entidad_afectada) VALUES ('EMPRESA CON DV SAS', '8605123303', 'ENTIDAD X')`)
    db.run(`INSERT INTO fiscales (responsable, documento, entidad_afectada) VALUES ('OTRA PERSONA', '1090123456789', 'ENTIDAD Y')`)
    db.run(`INSERT INTO multas_secop (entidad, nombre_responsable, cedula_responsable, valor_multa) VALUES ('E', 'BASURA', '0000000', 1)`)
    db.run(`INSERT INTO disciplinarios (documento, nombre1, apellido1) VALUES ('  79.861.465 ', 'JUAN', 'GOMEZ')`)
  })

  test('un documento no coincide con números que solo lo contienen', async () => {
    const { body } = await get('/persona/90123456')
    expect(body.fiscales).toHaveLength(0)
    const { body: b2 } = await get('/persona/1090123')
    expect(b2.fiscales).toHaveLength(0)
  })

  test('un NIT coincide con o sin dígito de verificación', async () => {
    for (const nit of ['860512330', '8605123303']) {
      const { body } = await get(`/persona/${nit}`)
      expect(body.fiscales.map((f: any) => f.responsable)).toEqual(['EMPRESA CON DV SAS'])
    }
  })

  test('documentos placeholder no coinciden con nada', async () => {
    for (const doc of ['0000000', '1111111', '123']) {
      const { body } = await get(`/persona/${doc}`)
      expect(body.resumen.total_registros).toBe(0)
    }
  })

  test('ignora puntos, guiones y espacios guardados en la fuente', async () => {
    const { body } = await get('/persona/79861465')
    expect(body.disciplinarios).toHaveLength(1)
  })
})

describe('depuración de filas repetidas', () => {
  test('migrateRefreshColumns elimina duplicados exactos y conserva las filas distintas', async () => {
    const { migrateRefreshColumns } = await import('../src/db/schema')
    const db = getDb()
    for (let i = 0; i < 3; i++) {
      db.run(`INSERT INTO obras (cod_obra, nombre_entidad, valor_contrato, identificacion) VALUES ('OB-DUP', 'ALCALDIA REPETIDA', 100, '800111222')`)
    }
    db.run(`INSERT INTO obras (cod_obra, nombre_entidad, valor_contrato, identificacion) VALUES ('OB-OTRA', 'ALCALDIA REPETIDA', 100, '800111222')`)
    migrateRefreshColumns()
    const filas = db.query(`SELECT cod_obra FROM obras WHERE nombre_entidad = 'ALCALDIA REPETIDA' ORDER BY cod_obra`).all() as any[]
    expect(filas.map(f => f.cod_obra)).toEqual(['OB-DUP', 'OB-OTRA'])
  })
})

describe('instalación nueva: siembra con filas repetidas y migración', () => {
  test('migrateRefreshColumns no falla cuando el índice único ya existe y hay duplicados sin clave', async () => {
    const { migrateRefreshColumns, createSchema } = await import('../src/db/schema')
    const db = getDb()
    createSchema() // deja creado idx_disc_clave, como en el arranque de una base vacía
    for (let i = 0; i < 3; i++) {
      db.run(`INSERT INTO disciplinarios (id_sancion, documento, tipo_sancion_aplicada, fecha_sancion, nombre1, apellido1)
              VALUES ('S-1', '555111222', 'DESTITUCION', '2020-01-01', 'ANA', 'RUIZ')`)
      db.run(`INSERT INTO multas_secop (ref_contrato, resolucion, cedula_responsable, nombre_responsable)
              VALUES ('C-1', 'R-1', '555111222', 'ANA RUIZ')`)
    }
    expect(() => migrateRefreshColumns()).not.toThrow()
    expect((db.query(`SELECT COUNT(*) c FROM disciplinarios WHERE documento = '555111222'`).get() as any).c).toBe(1)
    expect((db.query(`SELECT COUNT(*) c FROM multas_secop WHERE cedula_responsable = '555111222'`).get() as any).c).toBe(1)
  })
})
