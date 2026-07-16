import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import type { IncomingMessage, OutboundMessage } from '@johpaz/hive-agents-core/channels/base'

process.env.ANTICORRUP_DB_PATH = join(mkdtempSync(join(tmpdir(), 'telegram-channel-test-')), 'test.db')
process.env.GEMINI_API_KEY = 'test-key'

const initialWorkerRequests: unknown[] = []

mock.module('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async (request: any) => {
        const system = String(request.config?.systemInstruction ?? '')
        if (system.includes('revisor crítico')) {
          return geminiText('{"approved":true,"feedback":"Aprobado","missing":[]}')
        }
        if (system.includes('coordinador del Observatorio')) {
          const serialized = JSON.stringify(request.contents)
          return geminiText(serialized.includes('segunda pregunta')
            ? 'Respuesta final para la segunda pregunta'
            : 'Respuesta final para la primera pregunta')
        }

        const hasToolResult = request.contents.some((content: any) =>
          content.parts?.some((part: any) => part.functionResponse))
        if (!hasToolResult) {
          initialWorkerRequests.push(request.contents)
          return {
            candidates: [{
              finishReason: 'STOP',
              content: { parts: [{ functionCall: { name: 'buscar_contratista', args: { query: 'prueba' } } }] },
            }],
          }
        }
        return geminiText('Análisis sustentado con la herramienta interna.')
      },
    }
  },
}))

function geminiText(text: string): object {
  return {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
  }
}

const { initDb, loadVisibleChatHistory } = await import('../src/db/client')
const { handleIncomingChannelMessage } = await import('../src/channels')
const { markdownToTelegramHTML } = await import('@johpaz/hive-agents-core/channels/telegram')

beforeAll(() => initDb())

class FakeChannelManager {
  events: string[] = []
  messages: Array<{ type?: string; content?: string }> = []

  async send(_channel: string, _sessionId: string, message: Omit<OutboundMessage, 'sessionId'>): Promise<void> {
    this.events.push(`send:${message.type}`)
    this.messages.push(message)
  }

  async startTyping(): Promise<void> {
    this.events.push('typing:start')
  }

  async stopTyping(): Promise<void> {
    this.events.push('typing:stop')
  }
}

function telegramMessage(sessionId: string, content: string): IncomingMessage {
  return {
    sessionId,
    channel: 'telegram',
    accountId: 'default',
    peerId: sessionId,
    peerKind: 'direct',
    content,
  }
}

describe('flujo real de Telegram con historial', () => {
  test('narra herramientas, mantiene typing y recupera el turno anterior', async () => {
    const manager = new FakeChannelManager()
    const sessionId = String(800_000_000 + Math.floor(Math.random() * 99_999_999))

    await handleIncomingChannelMessage(manager, telegramMessage(sessionId, 'primera pregunta'))
    await handleIncomingChannelMessage(manager, telegramMessage(sessionId, 'segunda pregunta'))

    expect(loadVisibleChatHistory(sessionId).messages.map(message => message.content)).toEqual([
      'primera pregunta',
      'Respuesta final para la primera pregunta',
      'segunda pregunta',
      'Respuesta final para la segunda pregunta',
    ])
    expect(JSON.stringify(initialWorkerRequests[1])).toContain('primera pregunta')
    expect(JSON.stringify(initialWorkerRequests[1])).toContain('Respuesta final para la primera pregunta')
    expect(manager.messages.some(message => message.content === '🔎 Buscando el contratista…')).toBe(true)
    expect(manager.events.filter(event => event === 'typing:start').length).toBe(10)
    expect(manager.events.filter(event => event === 'typing:stop').length).toBe(2)
    expect(manager.events.at(-1)).toBe('typing:stop')
  })

  test('convierte enlaces, citas y formato Markdown a HTML de Telegram', () => {
    expect(markdownToTelegramHTML('# Informe\n\n**Riesgo:** alto\n\n> Fuente oficial\n\n[SECOP](https://www.datos.gov.co/)')).toBe(
      '<b>Informe</b>\n\n<b>Riesgo:</b> alto\n\n<blockquote>Fuente oficial</blockquote>\n\n<a href="https://www.datos.gov.co/">SECOP</a>',
    )
  })
})
