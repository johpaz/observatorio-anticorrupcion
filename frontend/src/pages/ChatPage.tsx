import { useState, useRef, useEffect } from 'react'
import { useSeo } from '../utils/useSeo'
import MarkdownRenderer from '../components/MarkdownRenderer'
import ReasoningAccordion from '../components/ReasoningAccordion'

interface ToolCallInfo {
  id: string
  name: string
  args: Record<string, unknown>
  result?: any
}

interface ReviewInfo {
  approved: boolean
  feedback: string
  missing: string[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  toolCalls?: ToolCallInfo[]
  iterations?: number
  review?: ReviewInfo
  isStreaming?: boolean
}

interface ChatResponse {
  success: boolean
  thread_id: string
  content?: string
  reasoning?: string
  tool_calls?: { id: string; name: string; args: Record<string, unknown>; result: any }[]
  iterations?: number
  review?: ReviewInfo
  error?: string
}

const SUGERENCIAS = [
  '¿Cuáles son los contratistas de mayor riesgo en Transporte?',
  'Muéstrame información sobre el NIT 860066942',
  '¿Qué contratistas tienen flag SANCIONADO_DISCIPLINARIO?',
  'Lista los contratistas ROJO del sector Salud y Protección Social',
]

function ToolCallBadge({ call }: { call: ToolCallInfo }) {
  const [open, setOpen] = useState(false)
  const hasResult = call.result !== undefined
  return (
    <div style={{ marginTop: 8, borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', background: '#f8fafc',
          border: 'none', padding: '10px 14px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span className="num" style={{ fontSize: 11, color: '#004884', fontWeight: 600 }}>
          ⚙️ {call.name} {hasResult ? '✓' : '...'}
        </span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: '12px 14px',
          fontSize: 11, fontFamily: 'var(--font-mono)',
          background: '#f1f5f9', color: '#334155',
          overflowX: 'auto', maxHeight: 240,
          borderTop: '1px solid #e2e8f0'
        }}>
          {JSON.stringify({ args: call.args, result: call.result }, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ReviewBadge({ review }: { review: ReviewInfo }) {
  return (
    <div style={{
      marginTop: 8,
      borderRadius: 8,
      border: `1px solid ${review.approved ? '#86efac' : '#fde047'}`,
      background: review.approved ? '#f0fdf4' : '#fefce8',
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: review.approved ? '#166534' : '#854d0e' }}>
        {review.approved ? '✅ Revisión aprobada' : '⚠️ Revisión rechazada'}
      </div>
      <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>{review.feedback}</div>
      {review.missing.length > 0 && (
        <ul style={{ fontSize: 11, color: '#334155', margin: '4px 0 0 16px', padding: 0 }}>
          {review.missing.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
    </div>
  )
}

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 6,
      maxWidth: '100%',
    }} className="animate-[rise_0.25s_ease-out_both]">
      <div className="smcaps text-[10px]" style={{ color: 'var(--ink-3)', paddingLeft: isUser ? 0 : 4 }}>
        {isUser ? 'Tú' : 'Agente Inteligente SECOP II'}
      </div>
      <div style={{
        maxWidth: '85%',
        background: isUser ? 'linear-gradient(135deg, #004884, #002f56)' : '#ffffff',
        color: isUser ? '#ffffff' : '#2d3748',
        border: isUser ? 'none' : '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: 13.5,
        lineHeight: 1.6,
        boxShadow: isUser ? '0 4px 14px rgba(0, 72, 132, 0.15)' : '0 4px 20px rgba(0, 72, 132, 0.03)',
      }}>
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        ) : (
          <MarkdownRenderer>{msg.content}</MarkdownRenderer>
        )}
      </div>
      {!isUser && msg.reasoning && (
        <div style={{ maxWidth: '85%', width: '100%' }}>
          <ReasoningAccordion reasoning={msg.reasoning} />
        </div>
      )}
      {!isUser && msg.iterations !== undefined && (
        <div style={{ maxWidth: '85%', fontSize: 10, color: '#64748b' }}>
          Iteraciones: {msg.iterations}
        </div>
      )}
      {!isUser && msg.review && (
        <div style={{ maxWidth: '85%', width: '100%' }}>
          <ReviewBadge review={msg.review} />
        </div>
      )}
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div style={{ maxWidth: '85%', width: '100%' }}>
          {msg.toolCalls.map((tc, i) => <ToolCallBadge key={i} call={tc} />)}
        </div>
      )}
      {!isUser && msg.isStreaming && (
        <div style={{ fontSize: 10, color: '#64748b' }}>Pensando...</div>
      )}
    </div>
  )
}

export default function ChatPage() {
  useSeo('Agente IA de Transparencia', 'Consulta con inteligencia artificial los antecedentes de contratistas, sanciones y riesgos en la contratación pública colombiana.')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function callChatEndpoint(msg: string): Promise<void> {
    abortRef.current = new AbortController()

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message: msg,
        thread_id: threadId ?? undefined,
        channel: 'webchat',
        mode: 'task',
        stream: true,
      }),
      signal: abortRef.current.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      let errorMsg = `${res.status} ${res.statusText}`
      try {
        const json = JSON.parse(text) as ChatResponse
        errorMsg = json.error ?? errorMsg
      } catch { /* ignore */ }
      throw new Error(errorMsg)
    }

    if (!res.body) throw new Error('Respuesta vacía del servidor')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentThreadId = threadId
    let currentToolCalls: ToolCallInfo[] = []
    let currentReview: ReviewInfo | undefined
    let currentIterations = 0
    let finalContent = ''
    let finalReasoning: string | undefined

    const updateAssistant = () => {
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            content: finalContent || last.content,
            reasoning: finalReasoning ?? last.reasoning,
            toolCalls: currentToolCalls.length > 0 ? currentToolCalls : last.toolCalls,
            iterations: currentIterations || last.iterations,
            review: currentReview ?? last.review,
            isStreaming: true,
          }
        }
        return next
      })
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let eventName = ''
      let eventData = ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
          eventData = ''
        } else if (line.startsWith('data:')) {
          eventData = line.slice(5).trim()
        } else if (line.trim() === '' && eventName && eventData) {
          try {
            const data = JSON.parse(eventData)
            switch (eventName) {
              case 'thread':
                if (data.thread_id) {
                  currentThreadId = data.thread_id
                  setThreadId(data.thread_id)
                }
                break
              case 'iteration':
                currentIterations = data.iteration
                updateAssistant()
                break
              case 'tool_call':
                currentToolCalls.push({
                  id: data.id,
                  name: data.name,
                  args: data.args,
                })
                updateAssistant()
                break
              case 'tool_result':
                currentToolCalls = currentToolCalls.map(tc =>
                  tc.id === data.id ? { ...tc, result: data.result } : tc
                )
                updateAssistant()
                break
              case 'worker_done':
                finalContent = data.content
                updateAssistant()
                break
              case 'review':
                currentReview = data
                updateAssistant()
                break
              case 'coordinator_done':
                finalContent = data.content
                finalReasoning = data.reasoning
                updateAssistant()
                break
              case 'done':
                finalContent = data.content
                finalReasoning = data.reasoning
                currentIterations = data.iterations
                currentReview = data.review
                if (data.thread_id) {
                  currentThreadId = data.thread_id
                  setThreadId(data.thread_id)
                }
                break
              case 'error':
                throw new Error(data.error)
            }
          } catch (err) {
            console.error('Error parsing SSE event:', err, eventName, eventData)
          }
          eventName = ''
          eventData = ''
        }
      }
    }

    setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant') {
        next[next.length - 1] = {
          ...last,
          content: finalContent || last.content,
          reasoning: finalReasoning ?? last.reasoning,
          toolCalls: currentToolCalls.length > 0 ? currentToolCalls : last.toolCalls,
          iterations: currentIterations || last.iterations,
          review: currentReview ?? last.review,
          isStreaming: false,
        }
      }
      return next
    })
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])
    setLoading(true)

    try {
      await callChatEndpoint(msg)
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            content: `Error al conectar con el agente: ${(err as Error).message}. Verifica que el servicio esté activo.`,
            isStreaming: false,
          }
        }
        return next
      })
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  return (
    <div className="rise flex flex-col h-full p-8 pb-0 text-slate-800 bg-[var(--bg-main)]">

      {/* Header */}
      <div className="mb-6 shrink-0">
        <div className="smcaps text-[#004884] font-bold">SECOP II · AGENTE IA</div>
        <h1 className="serif text-2xl font-bold tracking-tight text-[#004884] mt-1">
          Chat de Consulta Analítica
        </h1>
        <p className="text-sm text-slate-650 mt-1">
          Consulta scores de riesgo, contratistas, sanciones y obras inconclusas en lenguaje natural.
          Por debajo corre <span className="font-semibold text-[#004884]">Hive Agents</span>: un loop colaborativo (worker → reviewer → coordinator) que habla con los datos de SECOP II y la Procuraduría.
        </p>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6 pb-6 pr-2">
        {messages.length === 0 && (
          <div className="mt-2 space-y-4">
            <div className="smcaps text-slate-500 font-bold">Preguntas sugeridas</div>
            <div className="flex flex-col gap-3">
              {SUGERENCIAS.map(s => (
                <button key={s} className="btn-ghost text-left shadow-sm" onClick={() => send(s)} style={{ display: 'block', width: '100%' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <Bubble key={i} msg={m} />)}

        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="smcaps text-[10px] text-slate-500 font-bold">Agente Inteligente</div>
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: `pulse-chat 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-slate-200 py-6 flex gap-3">
        <input
          className="field shadow-sm"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Pregunta sobre contratistas, sectores, scores de riesgo, sanciones..."
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button className="btn-accent" onClick={() => send()} disabled={loading || !input.trim()}>
          <span>Enviar</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes pulse-chat {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.25); filter: drop-shadow(0 0 4px #004884); }
        }
      `}</style>
    </div>
  )
}
