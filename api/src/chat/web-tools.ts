import type { LLMToolDef } from '@johpaz/hive-agents-core/agent/llm-client'
import {
  createTools,
  initializeBrowserService,
} from '@johpaz/hive-agents-core/tools/web'
import type { Config } from '@johpaz/hive-agents-core/config'
import { createLogger } from '../utils/logger'

const log = createLogger('web-tools')
const webTools = createTools()
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

/**
 * Detecta Chromium al iniciar, pero conserva el lanzamiento perezoso de Hive:
 * el proceso del browser solo se crea cuando el agente usa una tool browser_*.
 */
export async function initializeWebTools(): Promise<boolean> {
  if (Bun.env.WEB_TOOLS_ENABLED === '0') {
    log.info('Herramientas web desactivadas con WEB_TOOLS_ENABLED=0')
    return false
  }

  const config: Config = {
    tools: {
      browser: {
        enabled: Bun.env.BROWSER_ENABLED !== '0',
        headless: Bun.env.BROWSER_HEADLESS !== '0',
        timeoutMs: Number(Bun.env.BROWSER_TIMEOUT_MS) || 30_000,
      },
    },
  }

  if (!config.tools?.browser?.enabled) {
    log.info('Browser desactivado; web_search y web_fetch siguen disponibles')
    return false
  }

  const browser = initializeBrowserService(config)
  const available = await browser.start()
  if (available) log.info('Chromium detectado; browser disponible bajo demanda')
  else log.warn('Chromium no detectado; web_search y web_fetch siguen disponibles')
  return available
}
