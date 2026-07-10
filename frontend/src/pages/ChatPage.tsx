import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { tool: string; result: any }[]
}

const SUGERENCIAS = [
  '¿Cuáles son los contratistas de mayor riesgo en Transporte?',
  'Muéstrame información sobre el NIT 860066942',
  '¿Qué contratistas tienen flag SANCIONADO_DISCIPLINARIO?',
  'Lista los contratistas ROJO del sector Salud y Protección Social',
]

function ToolCallBadge({ call }: { call: { tool: string; result: any } }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 8, borderRadius: 4, border: '1px solid var(--rule)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', background: 'var(--paper-2)',
          border: 'none', padding: '7px 12px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span className="num" style={{ fontSize: 11, color: 'var(--indigo)' }}>
          ⚙ herramienta: {call.tool}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: '10px 12px',
          fontSize: 10.5, fontFamily: 'var(--font-mono)',
          background: 'var(--card)', color: 'var(--ink-3)',
          overflowX: 'auto', maxHeight: 240,
        }}>
          {JSON.stringify(call.result, null, 2)}
        </pre>
      )}
    </div>
  )
}

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 6, maxWidth: '100%',
    }}>
      <div className="smcaps" style={{ color: 'var(--ink-4)', paddingLeft: isUser ? 0 : 2 }}>
        {isUser ? 'tú' : 'agente secop ii'}
      </div>
      <div style={{
        maxWidth: '80%',
        background: isUser ? 'var(--ink)' : 'var(--card)',
        color: isUser ? 'var(--paper)' : 'var(--ink)',
        border: isUser ? 'none' : '1px solid var(--rule)',
        borderRadius: 4,
        padding: '10px 14px',
        fontSize: 13.5, lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div style={{ maxWidth: '80%', width: '100%' }}>
          {msg.toolCalls.map((tc, i) => <ToolCallBadge key={i} call={tc} />)}
        </div>
      )}
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json() as { answer: string; tool_calls: any[] }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        toolCalls: data.tool_calls ?? [],
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error al conectar con el agente. Verifique que la API esté activa.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rise" style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '28px 40px 0',
    }}>

      {/* Header */}
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <div className="smcaps">SECOP II · AGENTE IA</div>
        <h1 className="serif" style={{
          margin: '6px 0 4px', fontSize: 28, fontWeight: 600,
          letterSpacing: -0.5, color: 'var(--ink)',
        }}>
          Chat con los Datos
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-4)' }}>
          Consulta scores de riesgo, contratistas y sanciones en lenguaje natural.
          Respaldado por SQLite FTS5 + Procuraduría API.
        </p>
      </div>

      {/* Conversation */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex',
        flexDirection: 'column', gap: 20,
        paddingBottom: 24, minHeight: 0,
      }}>

        {messages.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="smcaps" style={{ marginBottom: 12 }}>Sugerencias</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGERENCIAS.map(s => (
                <button key={s} className="btn-ghost" onClick={() => send(s)}
                  style={{ textAlign: 'left', padding: '9px 14px', fontSize: 13 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <Bubble key={i} msg={m} />)}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="smcaps" style={{ color: 'var(--ink-4)' }}>agente secop ii</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--ink-4)',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid var(--rule)',
        padding: '16px 0 24px',
        display: 'flex', gap: 10,
      }}>
        <input
          className="field"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Pregunta sobre contratistas, sectores o riesgo…"
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button className="btn-accent" onClick={() => send()} disabled={loading || !input.trim()}
          style={{ padding: '7px 20px', flexShrink: 0, opacity: loading || !input.trim() ? 0.5 : 1 }}>
          Enviar
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
