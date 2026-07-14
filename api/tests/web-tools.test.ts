import { afterEach, describe, expect, test } from 'bun:test'
import {
  WEB_FUNCTION_DECLARATIONS,
  executeWebTool,
  isWebTool,
} from '../src/chat/web-tools'
import { executeTool, FUNCTION_DECLARATIONS } from '../src/chat/tools'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('tools web del agente', () => {
  test('publica las tools de Hive en el formato esperado por el LLM', () => {
    const names = WEB_FUNCTION_DECLARATIONS.map(tool => tool.function.name)

    expect(names).toContain('web_search')
    expect(names).toContain('web_fetch')
    expect(names).toContain('browser_navigate')
    expect(names).toContain('browser_extract')
    expect(names).toContain('browser_click')
    expect(names).toContain('browser_type')
    expect(names).toContain('browser_wait')
    expect(names).toContain('browser_screenshot')
    expect(names).toContain('browser_script')
    expect(new Set(names).size).toBe(names.length)
    expect(names.every(isWebTool)).toBe(true)
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

  test('web_fetch limpia HTML antes de entregarlo al agente', async () => {
    globalThis.fetch = (async () => new Response(
      '<html><style>.x{display:none}</style><script>ignore()</script><body><h1>Fuente</h1><p>Contenido útil</p></body></html>',
      { headers: { 'content-type': 'text/html' } },
    )) as typeof fetch

    const result = await executeWebTool('web_fetch', { url: 'https://example.com' }) as any

    expect(result.ok).toBe(true)
    expect(result.content).toBe('Fuente Contenido útil')
    expect(result.content).not.toContain('ignore')
  })

  test('web_search conserva DuckDuckGo como principal y usa Bing solo ante anti-bot', async () => {
    let requests = 0
    globalThis.fetch = (async (input: string | URL | Request) => {
      requests++
      const url = String(input)
      if (url.includes('duckduckgo.com')) return new Response('anomaly challenge', { status: 202 })
      return new Response(`<?xml version="1.0"?><rss><channel><item>
        <title>Registro político</title>
        <link>https://example.com/aporte?id=1&amp;fuente=cne</link>
        <description>Aporte de campaña verificado</description>
      </item></channel></rss>`)
    }) as typeof fetch

    const result = await executeWebTool('web_search', { query: 'NIT campaña', numResults: 2 }) as any

    expect(requests).toBe(2)
    expect(result.engine).toBe('bing')
    expect(result.results[0].url).toBe('https://example.com/aporte?id=1&fuente=cne')
  })

  test('buscar_financiacion_politica exige NIT y no consulta órganos de control', async () => {
    const declaration = FUNCTION_DECLARATIONS.find(tool => tool.function.name === 'buscar_financiacion_politica')
    expect(declaration?.function.parameters).toMatchObject({ required: ['nit'] })
    expect(FUNCTION_DECLARATIONS.some(tool => tool.function.name === 'web_search')).toBe(false)
    expect(await executeTool('buscar_financiacion_politica', { nit: 'sin-numeros' })).toEqual({
      error: 'El NIT es obligatorio para investigar financiación política',
    })

    const requestedUrls: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.includes('duckduckgo.com')) return new Response('anomaly challenge', { status: 202 })
      return new Response(`<?xml version="1.0"?><rss><channel><item>
        <title>Posible registro</title><link>https://example.com/fuente</link>
        <description>Resultado candidato</description>
      </item></channel></rss>`)
    }) as typeof fetch

    const result = await executeTool('buscar_financiacion_politica', {
      nit: '900.123.456-7',
      nombre: 'Contratista Ejemplo',
    })
    const decodedRequests = requestedUrls.map(decodeURIComponent).join('\n').toLowerCase()

    expect(result.nit).toBe('9001234567')
    expect(result.fuentes).toHaveLength(1)
    expect(decodedRequests).toContain('9001234567')
    expect(decodedRequests).not.toContain('procuradur')
    expect(decodedRequests).not.toContain('contralor')
    expect(decodedRequests).not.toContain('siri')
    expect(decodedRequests).not.toContain('sancion')
  })

  test('rechaza nombres que no pertenecen al registro web', async () => {
    expect(isWebTool('tool_inexistente')).toBe(false)
    expect(await executeWebTool('tool_inexistente', {})).toEqual({
      ok: false,
      error: 'Herramienta web "tool_inexistente" no reconocida',
    })
  })
})
