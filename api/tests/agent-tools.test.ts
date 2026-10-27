/**
 * El agente solo usa fuentes oficiales internas: no expone búsqueda en internet
 * y sus prompts no la mencionan (el modelo no debe intentar llamar a una tool que no existe).
 */
import { describe, expect, test } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

const dir = mkdtempSync(join(tmpdir(), 'agent-tools-test-'))
process.env.ANTICORRUP_DB_PATH = join(dir, 'test.db')
process.env.PROVEEDORES_DB_PATH = join(dir, 'proveedores.db')
process.env.PROVEEDORES_PAGE_SIZE = '10'
process.env.PROVEEDORES_MIN_FILAS = '2'
process.env.PROCURADURIA_URL = 'http://procuraduria.test'

const PROVEEDORES = [
  { nit: '1053855091', nombre: 'heyvin camilo rincon galvis', tipo_empresa: 'Persona Natural colombiana', departamento: 'No Provisto', municipio: 'No Provisto' },
  { nit: '8605123303', nombre: 'SERVIENTREGA S.A', tipo_empresa: 'Sociedad Anónima', departamento: 'No Provisto', municipio: 'No Provisto' },
  { nit: '74861695', nombre: 'RAFAEL NOSSA MOLANO', tipo_empresa: 'Persona Natural colombiana', departamento: 'Boyacá', municipio: 'Tunja' },
  { nit: '900555666', nombre: 'EMPRESA LIMPIA SAS', tipo_empresa: 'Sociedad', departamento: 'No Provisto', municipio: 'No Provisto' },
]
const SANCIONADOS = [
  { documento: '1053855091', nombre: 'HEYVIN RINCON', registros: 1, ultima: '2020-01-01', valor_total: null },
  { documento: '860512330', nombre: 'SERVIENTREGA', registros: 3, ultima: null, valor_total: null },
  { documento: '74861695', nombre: 'RAFAEL NOSSA', registros: 2, ultima: '2019-05-05', valor_total: null },
  { documento: '555000111', nombre: 'NO ES PROVEEDOR', registros: 9, ultima: null, valor_total: null },
]
globalThis.fetch = (async (url: any) => {
  const u = String(url)
  if (u.includes('datos.gov.co')) return Response.json(PROVEEDORES)
  if (u.includes('/documentos/')) return Response.json({ documentos: SANCIONADOS })
  return Response.json({})
}) as typeof fetch

const { FUNCTION_DECLARATIONS, executeTool } = await import('../src/chat/tools')
const { initDb, db } = await import('../src/db/client')
const { llamarCompleto } = await import('../src/chat/llm')
const { refrescarProveedores } = await import('../src/services/proveedores')
initDb()
const { SYSTEM_PROMPT } = await import('../src/chat/handler')
const { COORDINATOR_PROMPT, REVIEWER_PROMPT, WORKER_PROMPT } = await import('../src/chat/collaborative')

describe('herramientas del agente', () => {
  test('solo expone las herramientas internas de contratación y sanciones', () => {
    expect(FUNCTION_DECLARATIONS.map(t => t.function.name)).toEqual([
      'buscar_contratista',
      'obtener_score_riesgo',
      'alertas_sector',
      'buscar_por_bandera',
      'verificar_sanciones',
    ])
  })

  test('web_search ya no existe: se responde como herramienta no reconocida', async () => {
    expect(await executeTool('web_search', { query: 'NIT' })).toEqual({ error: 'Herramienta "web_search" no reconocida' })
  })

  test('los prompts no mencionan búsqueda web y avisan que no hay acceso a internet', () => {
    for (const prompt of [SYSTEM_PROMPT, WORKER_PROMPT, REVIEWER_PROMPT, COORDINATOR_PROMPT]) {
      expect(prompt).not.toContain('web_search')
    }
    expect(SYSTEM_PROMPT).toContain('No tienes acceso a internet')
    expect(WORKER_PROMPT).toContain('No tienes acceso a internet')
    expect(SYSTEM_PROMPT).toContain('buscar_contratista')
  })
})

describe('buscar_por_bandera', () => {
  const fila = (nit: string, nombre: string, score: number, flags: string[], sector = 'Transporte') =>
    db.prepare(`INSERT OR REPLACE INTO scores (nit, nombre, score_total, nivel_riesgo, flags, sector) VALUES (?,?,?,?,?,?)`)
      .run(nit, nombre, score, score > 60 ? 'ROJO' : 'AMARILLO', JSON.stringify(flags), sector)

  test('banderas de sanciones: sin copia del registro de proveedores explica que aún se descarga (no "no encontré")', async () => {
    const r = await executeTool('buscar_por_bandera', { bandera: 'SANCIONADO_DISCIPLINARIO' })
    expect(r.error).toContain('aún se está descargando')
  })

  test('banderas de sanciones: cruza la fuente completa con los proveedores de SECOP II, aunque no estén analizados', async () => {
    await refrescarProveedores()
    fila('860512330', 'SERVIENTREGA SA', 40, ['MULTA_SECOP'])
    const r = await executeTool('buscar_por_bandera', { bandera: 'sancionado_disciplinario' })
    expect(r.total_contratistas_con_la_bandera).toBe(3) // el 4.º sancionado no es proveedor
    // más registros primero; el NIT con dígito de verificación se normaliza al que usan los contratos
    expect(r.contratistas.map((c: any) => c.nit)).toEqual(['860512330', '74861695', '1053855091'])
    expect(r.contratistas[0]).toMatchObject({ nombre: 'SERVIENTREGA S.A', registros: 3, score_total: 40, nivel_riesgo: 'AMARILLO' })
    expect(r.contratistas[1].score_total).toBeUndefined() // sin score calculado: igual aparece
  })

  test('respeta el límite y avisa que el filtro por sector no aplica a sanciones', async () => {
    const r = await executeTool('buscar_por_bandera', { bandera: 'SANCIONADO_DISCIPLINARIO', limite: 1, sector: 'Salud' })
    expect(r.mostrando).toBe(1)
    expect(r.total_contratistas_con_la_bandera).toBe(3)
    expect(r.aviso).toContain('sector')
  })

  test('banderas de contratos: lista los analizados, de mayor a menor score, y filtra por sector', async () => {
    fila('900000001', 'A SAS', 70, ['VENCIDOS_SIN_CERRAR(3/10)', 'EXTENSION_MAYOR_1_ANO(1/10)'])
    fila('900000002', 'B SAS', 45, ['VENCIDOS_SIN_CERRAR(2/5)'], 'Salud')
    fila('900000003', 'C SAS', 20, ['EXTENSION_MAYOR_1_ANO(2/9)'])
    const r = await executeTool('buscar_por_bandera', { bandera: 'VENCIDOS_SIN_CERRAR' })
    expect(r.total_con_bandera).toBe(2)
    expect(r.contratistas.map((c: any) => c.nit)).toEqual(['900000001', '900000002'])
    const s = await executeTool('buscar_por_bandera', { bandera: 'VENCIDOS_SIN_CERRAR', sector: 'Salud' })
    expect(s.contratistas.map((c: any) => c.nit)).toEqual(['900000002'])
  })

  test('una bandera inventada devuelve las válidas para que el modelo corrija', async () => {
    const r = await executeTool('buscar_por_bandera', { bandera: 'FLAG_INEXISTENTE' })
    expect(r.error).toContain('no válida')
    expect(r.banderas_validas).toContain('SANCIONADO_DISCIPLINARIO')
  })
})

describe('llamarCompleto (respuestas cortadas por límite de tokens)', () => {
  const opciones: any = { provider: 'gemini', model: 'x', apiKey: 'k', messages: [{ role: 'user', content: 'lista' }] }

  test('si la respuesta llega cortada pide continuar y concatena el texto', async () => {
    const llamadas: any[] = []
    const partes = [
      { content: 'Primera parte, ', stop_reason: 'max_tokens' },
      { content: 'segunda parte.', stop_reason: 'stop' },
    ]
    const res = await llamarCompleto(opciones, (async (o: any) => { llamadas.push(o); return partes[llamadas.length - 1] }) as any)
    expect(res.content).toBe('Primera parte, segunda parte.')
    expect(res.stop_reason).toBe('stop')
    expect(llamadas[1].messages.at(-2)).toEqual({ role: 'assistant', content: 'Primera parte, ' })
  })

  test('si sigue sin caber tras las continuaciones, avisa en vez de entregar texto cortado en silencio', async () => {
    const res = await llamarCompleto(opciones, (async () => ({ content: 'texto ', stop_reason: 'max_tokens' })) as any, 1)
    expect(res.content).toContain('se cortó')
  })

  test('una respuesta completa pasa sin llamadas extra', async () => {
    let n = 0
    const res = await llamarCompleto(opciones, (async () => { n++; return { content: 'ok', stop_reason: 'stop' } }) as any)
    expect(n).toBe(1)
    expect(res.content).toBe('ok')
  })
})

describe('sectores aproximados', () => {
  test('alertas_sector y buscar_por_bandera aceptan nombres aproximados y sin tildes', async () => {
    db.prepare(`INSERT OR REPLACE INTO scores (nit, nombre, score_total, nivel_riesgo, flags, sector) VALUES (?,?,?,?,?,?)`)
      .run('777', 'CONTRATISTA DEPORTIVO', 80, 'ROJO', '["VENCIDOS_SIN_CERRAR(3/5)"]', 'deportes')
    for (const entrada of ['deportes', 'Deporte', 'DEPORTES', 'Deporte y Recreación']) {
      const r: any = await executeTool('alertas_sector', { sector: entrada })
      expect(Array.isArray(r) ? r.map((x: any) => x.nit) : r).toContain('777')
    }
    const b: any = await executeTool('buscar_por_bandera', { bandera: 'VENCIDOS_SIN_CERRAR', sector: 'deporte' })
    expect(b.total_con_bandera).toBe(1)
  })

  test('un sector inexistente devuelve la lista de sectores válidos, no una lista vacía engañosa', async () => {
    const r: any = await executeTool('alertas_sector', { sector: 'Astronomía' })
    expect(r.error).toContain('no existe')
    expect(r.sectores_validos).toContain('deportes')
  })
})
