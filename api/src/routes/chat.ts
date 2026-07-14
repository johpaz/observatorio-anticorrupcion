import { Elysia, t } from 'elysia'
import { handleChatMessage } from '../chat/handler'

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

  .post('/', async ({ body, request, set }) => {
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
            thread_id: body.thread_id,
            channel: body.channel,
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
      thread_id: body.thread_id,
      channel: body.channel,
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
