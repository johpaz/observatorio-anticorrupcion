import { Elysia, t } from 'elysia'
import { handleChatMessage } from '../chat/handler'
import {
  clearChatHistory,
  loadVisibleChatHistory,
  resolveChatThread,
} from '../db/client'
import { withThreadLock } from '../chat/thread-lock'

const BROWSER_COOKIE = 'observatorio_browser_id'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface BrowserCookie {
  value: unknown
  set(options: {
    value: string
    httpOnly: boolean
    sameSite: 'lax'
    path: string
    maxAge: number
    secure: boolean
  }): unknown
}

function resolveWebThread(cookie: Record<string, BrowserCookie>): string {
  const browserCookie = cookie[BROWSER_COOKIE]
  const currentValue = typeof browserCookie?.value === 'string' ? browserCookie.value : ''
  const browserId = UUID_PATTERN.test(currentValue) ? currentValue : crypto.randomUUID()

  if (browserId !== currentValue) {
    browserCookie?.set({
      value: browserId,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      secure: Bun.env.NODE_ENV === 'production',
    })
  }

  return resolveChatThread('webchat', browserId)
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function isStreamRequested(body: { stream?: boolean }, headers: Headers): boolean {
  if (body.stream === true) return true
  const accept = headers.get('accept') ?? ''
  return accept.includes('text/event-stream')
}

export const chatRoutes = new Elysia({ prefix: '/api/chat' })
  .onError(({ error, set }) => { set.status = 500; return { success: false, error: String(error) } })

  .get('/history', ({ cookie, query }) => {
    const threadId = resolveWebThread(cookie as unknown as Record<string, BrowserCookie>)
    return loadVisibleChatHistory(threadId, query.limit ?? 50, query.before_id)
  }, {
    query: t.Object({
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      before_id: t.Optional(t.Numeric({ minimum: 1 })),
    }),
  })

  .delete('/history', async ({ cookie }) => {
    const threadId = resolveWebThread(cookie as unknown as Record<string, BrowserCookie>)
    const deleted = await withThreadLock(threadId, () => clearChatHistory(threadId))
    return { success: true, deleted }
  })

  .post('/', async ({ body, request, set, cookie }) => {
    // Browser identity is server-owned. thread_id and channel remain accepted in
    // the body only for backward compatibility and are deliberately ignored.
    const threadId = resolveWebThread(cookie as unknown as Record<string, BrowserCookie>)

    if (isStreamRequested(body, request.headers)) {
      set.headers['Content-Type'] = 'text/event-stream'
      set.headers['Cache-Control'] = 'no-cache'
      set.headers['Connection'] = 'keep-alive'

      let pingInterval: Timer | null = null

      const stream = new ReadableStream({
        start(controller) {
          let closed = false
          const enqueue = (event: string, data: unknown) => {
            if (closed) return
            try {
              controller.enqueue(new TextEncoder().encode(sseEvent(event, data)))
            } catch {
              closed = true
            }
          }

          pingInterval = setInterval(() => {
            enqueue('ping', { ts: Date.now() })
          }, 15_000)

          handleChatMessage({
            message: body.message,
            thread_id: threadId,
            channel: 'webchat',
            mode: body.mode ?? 'chat',
            callbacks: {
              onThread: (threadId) => enqueue('thread', { thread_id: threadId }),
              onIteration: (iteration, maxIterations) => enqueue('iteration', { iteration, max_iterations: maxIterations }),
              onWorkerStart: () => enqueue('worker_start', {}),
              onWorkerDone: (result) => enqueue('worker_done', result),
              onToolCall: (toolCall) => enqueue('tool_call', toolCall),
              onToolResult: (toolResult) => enqueue('tool_result', toolResult),
              onReview: (review) => enqueue('review', review),
              onCoordinatorDone: (result) => enqueue('coordinator_done', result),
            },
          }).then((result) => {
            if (closed) return
            enqueue('done', {
              thread_id: result.thread_id,
              content: result.content,
              reasoning: result.reasoning,
              tool_calls: result.tool_calls,
              iterations: result.iterations,
              review: result.review,
            })
            if (pingInterval) clearInterval(pingInterval)
            controller.close()
          }).catch((err) => {
            if (closed) return
            enqueue('error', { error: String(err) })
            if (pingInterval) clearInterval(pingInterval)
            controller.close()
          })
        },
        cancel() {
          if (pingInterval) clearInterval(pingInterval)
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Non-streaming JSON response
    const result = await handleChatMessage({
      message: body.message,
      thread_id: threadId,
      channel: 'webchat',
      mode: body.mode ?? 'chat',
    })

    return result
  }, {
    body: t.Object({
      message: t.String({ minLength: 2 }),
      thread_id: t.Optional(t.String()),
      channel: t.Optional(t.String()),
      mode: t.Optional(t.Union([t.Literal('chat'), t.Literal('task')])),
      stream: t.Optional(t.Boolean()),
    }),
  })
