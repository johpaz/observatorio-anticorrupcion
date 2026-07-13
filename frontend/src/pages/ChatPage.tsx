import { useState, useRef, useEffect } from 'react'
import { useSeo } from '../utils/useSeo'

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
          ⚙️ herramienta utilizada: {call.tool}
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
        whiteSpace: 'pre-wrap',
        boxShadow: isUser ? '0 4px 14px rgba(0, 72, 132, 0.15)' : '0 4px 20px rgba(0, 72, 132, 0.03)',
      }}>
        {msg.content}
      </div>
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div style={{ maxWidth: '85%', width: '100%' }}>
          {msg.toolCalls.map((tc, i) => <ToolCallBadge key={i} call={tc} />)}
        </div>
      )}
    </div>
  )
}

export default function ChatPage() {
  useSeo('Agente IA de Transparencia', 'Consulta con inteligencia artificial los antecedentes de contratistas, sanciones y riesgos en la contratación pública colombiana.')
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
        content: 'Error al conectar con el agente. Verifique que la API esté activa y respondiendo.',
      }])
    } finally {
      setLoading(false)
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
          Respaldado por SQLite FTS5 + Procuraduría API.
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

        {loading && (
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
