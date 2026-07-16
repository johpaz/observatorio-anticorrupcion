import { afterEach, describe, expect, test } from 'bun:test'
import {
  WEB_FUNCTION_DECLARATIONS,
  executeWebTool,
  isWebTool,
} from '../src/chat/web-tools'
import { FUNCTION_DECLARATIONS } from '../src/chat/tools'
import { SYSTEM_PROMPT } from '../src/chat/handler'
import { COORDINATOR_PROMPT, REVIEWER_PROMPT, WORKER_PROMPT } from '../src/chat/collaborative'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('tools web del agente', () => {
  test('publica únicamente web_search como tool web', () => {
    const names = WEB_FUNCTION_DECLARATIONS.map(tool => tool.function.name)

    expect(names).toEqual(['web_search'])
    expect(FUNCTION_DECLARATIONS.filter(tool => isWebTool(tool.function.name)).map(tool => tool.function.name))
      .toEqual(['web_search'])
    expect(isWebTool('web_fetch')).toBe(false)
    expect(isWebTool('browser_navigate')).toBe(false)
  })

  test('web_search ejecuta la implementación compartida de Hive', async () => {
    globalThis.fetch = (async () => new Response(`
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnoticia">Noticia verificable</a>
      <a class="result__snippet">Resumen de la fuente</a>
    `)) as typeof fetch

    const result = await executeWebTool('web_search', {
      query: 'contratación pública Colombia',
      numResults: 3,
    }) as any

    expect(result.ok).toBe(true)
    expect(result.results).toEqual([{
      title: 'Noticia verificable',
      url: 'https://example.com/noticia',
      snippet: 'Resumen de la fuente',
    }])
  })

  test('web_search conserva DuckDuckGo como principal y usa Bing solo ante anti-bot', async () => {
    let requests = 0
    globalThis.fetch = (async (input: string | URL | Request) => {
      requests++
      const url = String(input)
      if (url.includes('duckduckgo.com')) return new Response('anomaly challenge', { status: 202 })
      return new Response(`<?xml version="1.0"?><rss><channel><item>
        <title>Fuente pública</title>
        <link>https://example.com/fuente?id=1&amp;tipo=oficial</link>
        <description>Resultado público verificable</description>
      </item></channel></rss>`)
    }) as typeof fetch

    const result = await executeWebTool('web_search', { query: 'datos abiertos Colombia', numResults: 2 }) as any

    expect(requests).toBe(2)
    expect(result.engine).toBe('bing')
    expect(result.results[0].url).toBe('https://example.com/fuente?id=1&tipo=oficial')
  })

  test('los prompts usan web_search de forma contextual y no obligatoria', () => {
    expect(SYSTEM_PROMPT).toContain('web_search')
    expect(WORKER_PROMPT).toContain('web_search')
    expect(REVIEWER_PROMPT).toContain('No exijas búsquedas web cuando la tarea no las necesite')
    expect(COORDINATOR_PROMPT).toContain('fuentes internas oficiales')
  })

  test('rechaza nombres que no pertenecen al registro web', async () => {
    expect(isWebTool('tool_inexistente')).toBe(false)
    expect(await executeWebTool('tool_inexistente', {})).toEqual({
      ok: false,
      error: 'Herramienta web "tool_inexistente" no reconocida',
    })
  })
})
