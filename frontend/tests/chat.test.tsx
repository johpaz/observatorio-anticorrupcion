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

const baseFetch = (async (input: any) => {
  const url = String(input)
  if (failAll) return new Response('down', { status: 503 })

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
})

afterEach(cleanup)

describe('ChatPage: markdown, reasoning y datos', () => {
  test('renderiza markdown en la respuesta del asistente', async () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>)

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

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'contratistas en Transporte' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(screen.getByText(/buscar_contratista/)).toBeTruthy())
  })

  test('envía thread_id en mensajes posteriores', async () => {
    let secondBody: any = null
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input)
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

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'primera' } })
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(screen.getByText('Hola')).toBeTruthy())

    fireEvent.change(input, { target: { value: 'segunda' } })
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(secondBody?.thread_id).toBe('thread-123'))
  })

  test('responde desde /api/chat', async () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>)

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'hola' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(screen.getByText('Hola')).toBeTruthy())
  })

  test('muestra error si /api/chat falla', async () => {
    failAll = true
    render(<MemoryRouter><ChatPage /></MemoryRouter>)

    const input = screen.getByPlaceholderText(/Pregunta sobre contratistas/)
    fireEvent.change(input, { target: { value: 'hola' } })
    fireEvent.click(screen.getByText('Enviar'))

    await waitFor(() => expect(screen.getByText(/Error al conectar con el agente/)).toBeTruthy())
  })
})
