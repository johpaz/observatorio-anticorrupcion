import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChatPage from '../src/pages/ChatPage'

let failAll = false

function createSSEResponse(events: { event: string; data: any }[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

async function waitForHistory(): Promise<void> {
  await waitFor(() => expect(screen.queryByText('Cargando conversación…')).toBeNull())
}

const baseFetch = (async (input: any) => {
  const url = String(input)
  if (failAll) return new Response('down', { status: 503 })

  if (url.includes('/api/chat/history')) {
    return Response.json({ messages: [], next_before_id: null, has_more: false })
  }

  if (url.includes('/api/chat')) {
    return createSSEResponse([
      { event: 'thread', data: { thread_id: 'thread-123' } },
      { event: 'coordinator_done', data: { content: '**Hola** usuario.\n\n- Item 1\n- Item 2\n\n`código`', reasoning: 'Pensamiento final' } },
      { event: 'done', data: { thread_id: 'thread-123', content: '**Hola** usuario.\n\n- Item 1\n- Item 2\n\n`código`', reasoning: 'Pensamiento final', tool_calls: [] } },
    ])
  }

  return new Response('not mocked: ' + url, { status: 404 })
}) as typeof fetch

globalThis.fetch = baseFetch

beforeEach(() => {
  failAll = false
  globalThis.fetch = baseFetch
  window.confirm = () => true
})

afterEach(cleanup)

describe('ChatPage: markdown, reasoning y datos', () => {
  test('renderiza markdown en la respuesta del asistente', async () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>)
    await waitForHistory()

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'hola' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(screen.getByText('Hola')).toBeTruthy())
    expect(screen.getByText('Item 1')).toBeTruthy()
    expect(screen.getByText('Item 2')).toBeTruthy()
    expect(screen.getByText('código')).toBeTruthy()
  })

  test('muestra reasoning colapsado y se expande al hacer clic', async () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>)
    await waitForHistory()

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'NIT 123' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(screen.getByText(/Ver razonamiento/)).toBeTruthy())
    expect(screen.queryByText(/Pensamiento final/)).toBeNull()

    fireEvent.click(screen.getByText(/Ver razonamiento/))
    expect(screen.getByText(/Pensamiento final/)).toBeTruthy()
  })

  test('muestra tool calls cuando vienen en la respuesta', async () => {
    globalThis.fetch = (async (input: any) => {
      const url = String(input)
      if (url.includes('/api/chat/history')) {
        return Response.json({ messages: [], next_before_id: null, has_more: false })
      }
      if (url.includes('/api/chat')) {
        return createSSEResponse([
          { event: 'thread', data: { thread_id: 'thread-123' } },
          { event: 'tool_call', data: { id: '1', name: 'buscar_contratista', args: { query: 'Transporte' } } },
          { event: 'tool_result', data: { id: '1', name: 'buscar_contratista', result: [{ nit: '123', nombre: 'Acme' }] } },
          { event: 'coordinator_done', data: { content: 'Encontré estos contratistas.' } },
          { event: 'done', data: { thread_id: 'thread-123', content: 'Encontré estos contratistas.', tool_calls: [{ id: '1', name: 'buscar_contratista', args: { query: 'Transporte' } }] } },
        ])
      }
      return new Response('not mocked: ' + url, { status: 404 })
    }) as typeof fetch

    render(<MemoryRouter><ChatPage /></MemoryRouter>)
    await waitForHistory()

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'contratistas en Transporte' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(screen.getByText(/buscar_contratista/)).toBeTruthy())
  })

  test('la identidad queda en cookie y no envía thread_id', async () => {
    let secondBody: any = null
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input)
      if (url.includes('/api/chat/history')) {
        return Response.json({ messages: [], next_before_id: null, has_more: false })
      }
      if (url.includes('/api/chat') && init?.body) {
        const body = JSON.parse(init.body)
        if (body.message === 'segunda') secondBody = body
      }
      return createSSEResponse([
        { event: 'thread', data: { thread_id: 'thread-123' } },
        { event: 'done', data: { thread_id: 'thread-123', content: '**Hola** usuario.' } },
      ])
    }) as typeof fetch

    render(<MemoryRouter><ChatPage /></MemoryRouter>)
    await waitForHistory()

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'primera' } })
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(screen.getByText('Hola')).toBeTruthy())

    fireEvent.change(input, { target: { value: 'segunda' } })
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(secondBody?.message).toBe('segunda'))
    expect(secondBody.thread_id).toBeUndefined()
    expect(secondBody.channel).toBeUndefined()
  })

  test('restaura conversación completa al cargar la página', async () => {
    globalThis.fetch = (async (input: any) => {
      const url = String(input)
      if (url.includes('/api/chat/history')) {
        return Response.json({
          messages: [
            { id: 1, role: 'user', content: 'Consulta anterior', created_at: 1 },
            {
              id: 2,
              role: 'assistant',
              content: 'Respuesta anterior',
              reasoning: 'Razonamiento guardado',
              iterations: 2,
              review: { approved: true, feedback: 'Aprobado', missing: [] },
              tool_calls: [{ id: 't1', name: 'web_search', args: { query: 'NIT' }, result: { ok: true } }],
              created_at: 2,
            },
          ],
          next_before_id: null,
          has_more: false,
        })
      }
      return new Response('not mocked', { status: 404 })
    }) as typeof fetch

    render(<MemoryRouter><ChatPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Consulta anterior')).toBeTruthy())
    expect(screen.getByText('Respuesta anterior')).toBeTruthy()
    expect(screen.getByText('Iteraciones: 2')).toBeTruthy()
    expect(screen.getByText('✅ Revisión aprobada')).toBeTruthy()
    expect(screen.getByText(/web_search/)).toBeTruthy()
    expect(screen.getByText(/Ver razonamiento/)).toBeTruthy()
  })

  test('Nueva conversación confirma, elimina en API y limpia la vista', async () => {
    let deleted = false
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input)
      if (url.includes('/api/chat/history') && init?.method === 'DELETE') {
        deleted = true
        return Response.json({ success: true, deleted: 2 })
      }
      if (url.includes('/api/chat/history')) {
        return Response.json({
          messages: [{ id: 1, role: 'user', content: 'Mensaje para borrar', created_at: 1 }],
          next_before_id: null,
          has_more: false,
        })
      }
      return new Response('not mocked', { status: 404 })
    }) as typeof fetch

    render(<MemoryRouter><ChatPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Mensaje para borrar')).toBeTruthy())

    fireEvent.click(screen.getByText('Nueva conversación'))
    await waitFor(() => expect(deleted).toBe(true))
    await waitFor(() => expect(screen.queryByText('Mensaje para borrar')).toBeNull())
    expect(screen.getByText('Preguntas sugeridas')).toBeTruthy()
  })

  test('responde desde /api/chat', async () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>)
    await waitForHistory()

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'hola' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(screen.getByText('Hola')).toBeTruthy())
  })

  test('muestra error si /api/chat falla', async () => {
    failAll = true
    render(<MemoryRouter><ChatPage /></MemoryRouter>)
    await waitForHistory()

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'hola' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(screen.getByText(/Error al conectar con el agente/)).toBeTruthy())
  })
})
