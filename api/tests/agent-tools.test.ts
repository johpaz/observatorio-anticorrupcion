/**
 * El agente solo usa fuentes oficiales internas: no expone búsqueda en internet
 * y sus prompts no la mencionan (el modelo no debe intentar llamar a una tool que no existe).
 */
import { describe, expect, test } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

process.env.ANTICORRUP_DB_PATH = join(mkdtempSync(join(tmpdir(), 'agent-tools-test-')), 'test.db')

const { FUNCTION_DECLARATIONS, executeTool } = await import('../src/chat/tools')
const { SYSTEM_PROMPT } = await import('../src/chat/handler')
const { COORDINATOR_PROMPT, REVIEWER_PROMPT, WORKER_PROMPT } = await import('../src/chat/collaborative')

describe('herramientas del agente', () => {
  test('solo expone las herramientas internas de contratación y sanciones', () => {
    expect(FUNCTION_DECLARATIONS.map(t => t.function.name)).toEqual([
      'buscar_contratista',
      'obtener_score_riesgo',
      'alertas_sector',
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
