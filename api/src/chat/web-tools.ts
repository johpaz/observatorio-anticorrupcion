import type { LLMToolDef } from '@johpaz/hive-agents-core/agent/llm-client'
import { createTools } from '@johpaz/hive-agents-core/tools/web'
import { createLogger } from '../utils/logger'

const log = createLogger('web-tools')
// El agente solo necesita búsqueda. No exponemos fetch ni automatización de browser.
const webTools = createTools().filter(tool => tool.name === 'web_search')
const webToolsByName = new Map(webTools.map(tool => [tool.name, tool]))

export const WEB_FUNCTION_DECLARATIONS: LLMToolDef[] = webTools.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}))

export function isWebTool(name: string): boolean {
  return webToolsByName.has(name)
}

export async function executeWebTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = webToolsByName.get(name)
  if (!tool) return { ok: false, error: `Herramienta web "${name}" no reconocida` }

  try {
    return await tool.execute(args)
  } catch (error) {
    log.error(`Falló ${name}`, error)
    return { ok: false, error: `Error al ejecutar ${name}: ${(error as Error).message}` }
  }
}
