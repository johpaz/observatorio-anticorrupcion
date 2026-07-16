import { callLLM, type LLMMessage, type LLMToolCall } from '@johpaz/hive-agents-core/agent/llm-client'
import { FUNCTION_DECLARATIONS, executeTool } from './tools'
import { loadChatHistory, saveChatMessage } from '../db/client'
import { runCollaborativeTask, type CollaborativeCallbacks, type CollaborativeResult } from './collaborative'
import { withThreadLock } from './thread-lock'

const GEMINI_API_KEY = Bun.env.GEMINI_API_KEY
const GEMINI_MODEL = Bun.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'

export const SYSTEM_PROMPT = `Eres un asistente experto en transparencia y contratación pública colombiana (SECOP II).
Tienes acceso a herramientas internas para consultar riesgo anticorrupción y sanciones, además de web_search para buscar información pública en internet.
Responde siempre en español, de forma clara y profesional.
Si te preguntan por un contratista específico, usa las herramientas para obtener datos reales.
Usa web_search cuando el usuario pida investigar en internet o cuando información externa o actual sea útil para responder. No hagas búsquedas web obligatorias si la tarea no las necesita.
Para SECOP, Procuraduría, Contraloría/CGR, SIRI, multas y sanciones, prioriza las herramientas internas oficiales; usa web_search únicamente como complemento o verificación adicional cuando aporte valor.
Cuando uses web_search, cita las URLs concretas, separa hechos confirmados de coincidencias no verificadas y no presentes un resultado del buscador como prueba suficiente por sí solo.
Cuando el contratista tenga multas SECOP, indica para cada una: el valor, la entidad que impuso la multa, la resolución, el contrato asociado y la fecha.
Importante: los scores de riesgo son indicativos basados en patrones estadísticos. No constituyen prueba de corrupción.
Cita siempre la fuente: SECOP II (datos.gov.co), Procuraduría (SIRI), CGR, SECOP Multas o la URL web concreta según corresponda.`

export interface ChatHandlerCallbacks extends CollaborativeCallbacks {
  onToolCall?: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void | Promise<void>
  onToolResult?: (toolResult: { id: string; name: string; result: any }) => void | Promise<void>
}

export interface ChatHandlerResult {
  success: boolean
  thread_id: string
  content: string
  reasoning?: string
  tool_calls: { id: string; name: string; args: Record<string, unknown>; result: any }[]
  iterations?: number
  review?: { approved: boolean; feedback: string; missing: string[] }
  error?: string
}

export interface ChatHandlerOptions {
  message: string
  thread_id?: string
  channel?: string
  mode?: 'chat' | 'task'
  callbacks?: ChatHandlerCallbacks
}

export async function handleChatMessage(options: ChatHandlerOptions): Promise<ChatHandlerResult> {
  const threadId = options.thread_id ?? crypto.randomUUID()
  return withThreadLock(threadId, () => handleChatMessageUnlocked({ ...options, thread_id: threadId }))
}

async function handleChatMessageUnlocked(options: ChatHandlerOptions & { thread_id: string }): Promise<ChatHandlerResult> {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      thread_id: options.thread_id,
      content: 'El agente de chat requiere una API key de Gemini. Configure la variable GEMINI_API_KEY.',
      tool_calls: [],
    }
  }

  const threadId = options.thread_id

  if (options.mode === 'task') {
    try {
      const result = await runCollaborativeTask({
        message: options.message,
        thread_id: threadId,
        channel: options.channel,
        callbacks: options.callbacks,
      })

      return {
        success: true,
        thread_id: result.thread_id,
        content: result.content,
        reasoning: result.reasoning,
        tool_calls: result.tool_calls,
        iterations: result.iterations,
        review: result.review,
      }
    } catch (err) {
      const content = `Error en el agente colaborativo: ${(err as Error).message}`
      saveChatMessage(threadId, 'assistant', content, { visible: true })
      return {
        success: false,
        thread_id: threadId,
        content,
        tool_calls: [],
      }
    }
  }

  // Simple chat mode
  const messages: LLMMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...loadChatHistory(threadId, 40),
    { role: 'user', content: options.message },
  ]

  saveChatMessage(threadId, 'user', options.message, { visible: true })

  const toolCallsSummary: { id: string; name: string; args: Record<string, unknown>; result: any }[] = []
  let finalReasoning = ''

  for (let turn = 0; turn < 5; turn++) {
    const response = await callLLM({
      provider: 'gemini',
      model: GEMINI_MODEL,
      apiKey: GEMINI_API_KEY,
      messages,
      tools: FUNCTION_DECLARATIONS,
      temperature: 0.2,
      maxTokens: 1024,
      signal: AbortSignal.timeout(60_000),
    })

    if (response.stop_reason === 'error') {
      saveChatMessage(threadId, 'assistant', response.content, {
        visible: true,
        metadata: {
          reasoning: response.reasoning_content,
          tool_calls: toolCallsSummary,
        },
      })
      return {
        success: false,
        thread_id: threadId,
        content: response.content,
        reasoning: response.reasoning_content,
        tool_calls: toolCallsSummary,
      }
    }

    if (response.reasoning_content) {
      finalReasoning = response.reasoning_content
    }

    if (!response.tool_calls || response.tool_calls.length === 0) {
      const content = response.content || 'Sin respuesta del modelo.'
      saveChatMessage(threadId, 'assistant', content, {
        visible: true,
        metadata: {
          reasoning: finalReasoning || undefined,
          tool_calls: toolCallsSummary,
        },
      })
      return {
        success: true,
        thread_id: threadId,
        content,
        reasoning: finalReasoning || undefined,
        tool_calls: toolCallsSummary,
      }
    }

    saveChatMessage(threadId, 'assistant', response.content, {
      tool_calls: response.tool_calls.map(tc => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      })),
    })

    messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.tool_calls,
    })

    for (const tc of response.tool_calls) {
      const args = (() => {
        try {
          return JSON.parse(tc.function.arguments || '{}')
        } catch {
          return {}
        }
      })()

      await options.callbacks?.onToolCall?.({ id: tc.id, name: tc.function.name, args })
      const result = await executeTool(tc.function.name, args)
      await options.callbacks?.onToolResult?.({ id: tc.id, name: tc.function.name, result })

      toolCallsSummary.push({ id: tc.id, name: tc.function.name, args, result })

      const toolResultContent = JSON.stringify(result)
      messages.push({
        role: 'tool',
        content: toolResultContent,
        tool_call_id: tc.id,
        name: tc.function.name,
      })

      saveChatMessage(threadId, 'tool', toolResultContent, { tool_call_id: tc.id })
    }
  }

  const fallbackContent = 'El agente realizó varias consultas pero no generó una respuesta final. Intenta reformular tu pregunta.'
  saveChatMessage(threadId, 'assistant', fallbackContent, {
    visible: true,
    metadata: {
      reasoning: finalReasoning || undefined,
      tool_calls: toolCallsSummary,
    },
  })
  return {
    success: true,
    thread_id: threadId,
    content: fallbackContent,
    reasoning: finalReasoning || undefined,
    tool_calls: toolCallsSummary,
  }
}
