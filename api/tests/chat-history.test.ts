import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

process.env.ANTICORRUP_DB_PATH = join(mkdtempSync(join(tmpdir(), 'chat-history-test-')), 'test.db')

const {
  clearChatHistory,
  db,
  initDb,
  loadVisibleChatHistory,
  resolveChatThread,
  saveChatMessage,
} = await import('../src/db/client')
const { withThreadLock } = await import('../src/chat/thread-lock')
const { chatRoutes } = await import('../src/routes/chat')
const { isTelegramResetCommand } = await import('../src/channels')

beforeAll(() => initDb())

function cookieHeader(response: Response): string {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('La respuesta no creó la cookie del navegador')
  return setCookie.split(';', 1)[0]!
}

describe('identidad y almacenamiento del historial', () => {
  test('la migración es idempotente', () => {
    expect(() => initDb()).not.toThrow()
    expect(() => initDb()).not.toThrow()
  })

  test('reconoce /new de Telegram sin confundir mensajes normales', () => {
    expect(isTelegramResetCommand('/new')).toBe(true)
    expect(isTelegramResetCommand('/new@ObservatorioBot')).toBe(true)
    expect(isTelegramResetCommand('/newsletter')).toBe(false)
  })

  test('reutiliza una sesión por identidad y aísla canales e identidades', () => {
    const externalId = crypto.randomUUID()
    const first = resolveChatThread('webchat', externalId)
    const second = resolveChatThread('webchat', externalId)
    const anotherBrowser = resolveChatThread('webchat', crypto.randomUUID())
    const telegram = resolveChatThread('telegram', externalId)

    expect(second).toBe(first)
    expect(anotherBrowser).not.toBe(first)
    expect(telegram).not.toBe(first)
  })

  test('Telegram adopta el sessionId y conserva filas legadas', () => {
    const sessionId = String(900_000_000 + Math.floor(Math.random() * 99_999_999))
    saveChatMessage(sessionId, 'user', 'mensaje legado')

    const resolved = resolveChatThread('telegram', sessionId)

    expect(resolved).toBe(sessionId)
    expect(db.query<{ count: number }, [string]>(`
      SELECT COUNT(*) AS count FROM chat_history WHERE thread_id = ?
    `).get(resolved)?.count).toBe(1)
  })

  test('Telegram separa participantes dentro del mismo grupo', () => {
    const groupId = `-100${Date.now()}`
    const firstUser = resolveChatThread('telegram', `${groupId}:101`)
    const secondUser = resolveChatThread('telegram', `${groupId}:202`)
    expect(firstUser).not.toBe(secondUser)
  })

  test('pagina solo mensajes visibles y restaura metadata completa', () => {
    const threadId = resolveChatThread('webchat', crypto.randomUUID())
    saveChatMessage(threadId, 'user', 'uno', { visible: true })
    saveChatMessage(threadId, 'tool', '{"interno":true}', { tool_call_id: 'tool-1' })
    saveChatMessage(threadId, 'assistant', 'dos', {
      visible: true,
      metadata: {
        reasoning: 'razón',
        iterations: 3,
        review: { approved: false, feedback: 'falta evidencia', missing: ['fuente'] },
        tool_calls: [{ id: 'tool-1', name: 'web_search', args: { query: 'NIT' }, result: { ok: true } }],
      },
    })
    saveChatMessage(threadId, 'user', 'tres', { visible: true })

    const newest = loadVisibleChatHistory(threadId, 2)
    expect(newest.messages.map(message => message.content)).toEqual(['dos', 'tres'])
    expect(newest.has_more).toBe(true)
    expect(newest.messages[0]?.reasoning).toBe('razón')
    expect(newest.messages[0]?.iterations).toBe(3)
    expect(newest.messages[0]?.tool_calls?.[0]?.result).toEqual({ ok: true })

    const previous = loadVisibleChatHistory(threadId, 2, newest.next_before_id!)
    expect(previous.messages.map(message => message.content)).toEqual(['uno'])
    expect(previous.has_more).toBe(false)
  })

  test('el reinicio elimina toda la conversación bajo un bloqueo serializado', async () => {
    const threadId = resolveChatThread('webchat', crypto.randomUUID())
    const order: string[] = []

    const first = withThreadLock(threadId, async () => {
      order.push('first:start')
      await Bun.sleep(10)
      saveChatMessage(threadId, 'user', 'temporal', { visible: true })
      order.push('first:end')
    })
    const reset = withThreadLock(threadId, () => {
      order.push('reset')
      return clearChatHistory(threadId)
    })

    await Promise.all([first, reset])
    expect(order).toEqual(['first:start', 'first:end', 'reset'])
    expect(loadVisibleChatHistory(threadId).messages).toEqual([])
  })
})

describe('API web basada en cookie', () => {
  test('crea cookie HttpOnly y restaura solo el historial de ese navegador', async () => {
    const firstResponse = await chatRoutes.handle(new Request('http://localhost/api/chat/history'))
    expect(firstResponse.status).toBe(200)
    const cookie = cookieHeader(firstResponse)
    const setCookie = firstResponse.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie.toLowerCase()).toContain('samesite=lax')

    const browserId = cookie.split('=', 2)[1]!
    const threadId = resolveChatThread('webchat', browserId)
    saveChatMessage(threadId, 'user', 'persistido', { visible: true })

    const restored = await chatRoutes.handle(new Request('http://localhost/api/chat/history', {
      headers: { Cookie: cookie },
    }))
    const body = await restored.json() as { messages: { content: string }[] }
    expect(body.messages.map(message => message.content)).toEqual(['persistido'])

    const isolated = await chatRoutes.handle(new Request('http://localhost/api/chat/history'))
    const isolatedBody = await isolated.json() as { messages: unknown[] }
    expect(isolatedBody.messages).toEqual([])
  })

  test('ignora thread_id y channel manipulados en POST', async () => {
    const sessionResponse = await chatRoutes.handle(new Request('http://localhost/api/chat/history'))
    const cookie = cookieHeader(sessionResponse)
    const browserId = cookie.split('=', 2)[1]!
    const expectedThread = resolveChatThread('webchat', browserId)

    const response = await chatRoutes.handle(new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        message: 'hola',
        thread_id: 'thread-de-otra-persona',
        channel: 'telegram',
        mode: 'chat',
      }),
    }))
    const body = await response.json() as { thread_id: string }
    expect(body.thread_id).toBe(expectedThread)
  })

  test('DELETE elimina el historial de la cookie actual', async () => {
    const sessionResponse = await chatRoutes.handle(new Request('http://localhost/api/chat/history'))
    const cookie = cookieHeader(sessionResponse)
    const browserId = cookie.split('=', 2)[1]!
    const threadId = resolveChatThread('webchat', browserId)
    saveChatMessage(threadId, 'user', 'borrar', { visible: true })

    const response = await chatRoutes.handle(new Request('http://localhost/api/chat/history', {
      method: 'DELETE',
      headers: { Cookie: cookie },
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, deleted: 1 })
    expect(loadVisibleChatHistory(threadId).messages).toEqual([])
  })
})
