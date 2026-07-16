import { callLLM, type LLMMessage, type LLMResponse, type LLMToolCall } from '@johpaz/hive-agents-core/agent/llm-client'
import { FUNCTION_DECLARATIONS, executeTool } from './tools'
import { loadChatHistory, saveChatMessage } from '../db/client'

const GEMINI_API_KEY = Bun.env.GEMINI_API_KEY
const GEMINI_MODEL = Bun.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'

export const WORKER_PROMPT = `Eres un analista experto en contratación pública colombiana (SECOP II) y riesgo anticorrupción.
Tu trabajo es ejecutar la tarea que te asigne el coordinador.
Usa las herramientas disponibles siempre que necesites datos reales.
Usa web_search cuando el usuario solicite investigar en internet o cuando información externa o actual sea útil. No hagas búsquedas web obligatorias si la tarea no las necesita.
Para SECOP, Procuraduría, Contraloría/CGR, SIRI, multas y sanciones, prioriza las herramientas internas oficiales; usa web_search como complemento o verificación adicional cuando aporte valor.
Cuando uses web_search, incluye las URLs encontradas, separa hechos confirmados de coincidencias no verificadas y no trates un resultado del buscador como prueba suficiente por sí solo.
Responde en español, con fuentes citadas.
Si la tarea requiere múltiples pasos, muéstralos claramente.
Cuando el contratista tenga multas SECOP, detalla para cada una: el valor, la entidad que impuso la multa, la resolución, el contrato asociado y la fecha.
Importante: los scores de riesgo son indicativos basados en patrones estadísticos. No constituyen prueba de corrupción.
Cita siempre la fuente: SECOP II (datos.gov.co), Procuraduría (SIRI), CGR, SECOP Multas o la URL web concreta según corresponda.`

export const REVIEWER_PROMPT = `Eres un revisor crítico y exigente de un equipo de análisis anticorrupción.
Evalúa si el siguiente trabajo cumple EXACTAMENTE al 100% con la tarea solicitada.
Verifica que las afirmaciones estén respaldadas por las herramientas adecuadas. Para datos cubiertos por SECOP y los registros internos de sanciones, exige esas fuentes oficiales como base; acepta web_search como complemento cuando sea útil o cuando el usuario lo haya solicitado.
No exijas búsquedas web cuando la tarea no las necesite. Si se usó web_search, comprueba que incluya URLs y que distinga hechos confirmados de coincidencias no verificadas.
Responde ÚNICAMENTE con un JSON válido y nada más:
{
  "approved": boolean,
  "feedback": "string con correcciones específicas, lo que falta o 'Aprobado'",
  "missing": ["lista de puntos pendientes"]
}
No agregues texto fuera del JSON.`

export const COORDINATOR_PROMPT = `Eres Bee, el coordinador del Observatorio Anticorrupción de Colombia.
Recibes un trabajo ya revisado y aprobado por el revisor.
Entrega la respuesta final al usuario de forma clara, profesional y con las fuentes citadas.
Si el contratista tiene multas SECOP, asegúrate de incluir el valor, la entidad que impuso cada multa, la resolución, el contrato asociado y la fecha.
No inventes datos. Si algo no pudo verificarse, dilo explícitamente.
Prioriza las fuentes internas oficiales para SECOP y sanciones. Si el trabajo usó web_search, conserva las URLs relevantes y expresa con precisión cualquier incertidumbre o falta de verificación.
Importante: los scores de riesgo son indicativos basados en patrones estadísticos. No constituyen prueba de corrupción.`

export interface CollaborativeCallbacks {
  onThread?: (threadId: string) => void | Promise<void>
  onIteration?: (iteration: number, maxIterations: number) => void | Promise<void>
  onWorkerStart?: () => void | Promise<void>
  onWorkerDone?: (result: { content: string; reasoning?: string }) => void | Promise<void>
  onToolCall?: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void | Promise<void>
  onToolResult?: (toolResult: { id: string; name: string; result: any }) => void | Promise<void>
  onReview?: (review: ReviewResult) => void | Promise<void>
  onCoordinatorDone?: (result: { content: string; reasoning?: string }) => void | Promise<void>
}

export interface ReviewResult {
  approved: boolean
  feedback: string
  missing: string[]
}

export interface CollaborativeResult {
  thread_id: string
  content: string
  reasoning?: string
  tool_calls: { id: string; name: string; args: Record<string, unknown>; result: any }[]
  iterations: number
  review: ReviewResult
}

export interface CollaborativeOptions {
  message: string
  thread_id?: string
  channel?: string
  maxIterations?: number
  callbacks?: CollaborativeCallbacks
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found')
  return match[0]
}

function parseReview(text: string): ReviewResult {
  try {
    const json = extractJson(text)
    const parsed = JSON.parse(json)
    return {
      approved: Boolean(parsed.approved),
      feedback: String(parsed.feedback ?? ''),
      missing: Array.isArray(parsed.missing) ? parsed.missing.map(String) : [],
    }
  } catch {
    return {
      approved: false,
      feedback: text,
      missing: ['No se pudo parsear la revisión como JSON'],
    }
  }
}

async function runWorkerLoop(
  messages: LLMMessage[],
  options: { threadId: string; callbacks?: CollaborativeCallbacks; onToolResult?: (tc: LLMToolCall, result: any) => void }
): Promise<{ content: string; reasoning?: string }> {
  let workerReasoning = ''

  for (let turn = 0; turn < 5; turn++) {
    const response = await callLLM({
      provider: 'gemini',
      model: GEMINI_MODEL,
      apiKey: GEMINI_API_KEY!,
      messages,
      tools: FUNCTION_DECLARATIONS,
      temperature: 0.2,
      maxTokens: 2048,
      signal: AbortSignal.timeout(60_000),
    })

    if (response.stop_reason === 'error') {
      throw new Error(response.content)
    }

    if (response.reasoning_content) {
      workerReasoning += (workerReasoning ? '\n' : '') + response.reasoning_content
    }

    if (!response.tool_calls || response.tool_calls.length === 0) {
      return { content: response.content || 'Sin respuesta del worker.', reasoning: workerReasoning || undefined }
    }

    messages.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls })

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
      options.onToolResult?.(tc, result)

      const toolResultContent = JSON.stringify(result)
      messages.push({
        role: 'tool',
        content: toolResultContent,
        tool_call_id: tc.id,
        name: tc.function.name,
      })
    }
  }

  const last = messages.at(-1)
  return {
    content: typeof last?.content === 'string' ? last.content : 'El worker no generó una respuesta final.',
    reasoning: workerReasoning || undefined,
  }
}

export async function runCollaborativeTask(options: CollaborativeOptions): Promise<CollaborativeResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada')
  }

  const threadId = options.thread_id ?? crypto.randomUUID()
  const maxIterations = Math.min(Math.max(options.maxIterations ?? 3, 1), 8)
  const callbacks = options.callbacks ?? {}

  await callbacks.onThread?.(threadId)

  // Load previous history to maintain context
  const history = loadChatHistory(threadId, 30)

  // Save user message
  saveChatMessage(threadId, 'user', options.message, { visible: true })

  const allToolCalls: { id: string; name: string; args: Record<string, unknown>; result: any }[] = []

  let workerMessages: LLMMessage[] = [
    { role: 'system', content: WORKER_PROMPT },
    ...history,
    { role: 'user', content: options.message },
  ]

  let lastWorkerResult = ''
  let lastWorkerReasoning = ''
  let review: ReviewResult = { approved: false, feedback: '', missing: [] }
  let completedIterations = 0

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    completedIterations = iteration
    await callbacks.onIteration?.(iteration, maxIterations)

    await callbacks.onWorkerStart?.()
    const workerResult = await runWorkerLoop(workerMessages, {
      threadId,
      callbacks,
      onToolResult: (tc, result) => {
        allToolCalls.push({ id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments || '{}'), result })
        callbacks.onToolResult?.({ id: tc.id, name: tc.function.name, result })
      },
    })
    lastWorkerResult = workerResult.content
    lastWorkerReasoning = workerResult.reasoning ?? ''
    await callbacks.onWorkerDone?.({ content: lastWorkerResult, reasoning: lastWorkerReasoning })

    // Reviewer
    const reviewResponse = await callLLM({
      provider: 'gemini',
      model: GEMINI_MODEL,
      apiKey: GEMINI_API_KEY,
      messages: [
        { role: 'system', content: REVIEWER_PROMPT },
        { role: 'user', content: `TAREA:\n${options.message}\n\nTRABAJO ENTREGADO (iteración ${iteration}):\n${lastWorkerResult}` },
      ],
      temperature: 0.1,
      maxTokens: 2048,
      signal: AbortSignal.timeout(60_000),
    })

    review = parseReview(reviewResponse.content)
    await callbacks.onReview?.(review)

    if (review.approved) break

    if (iteration < maxIterations) {
      workerMessages.push({ role: 'assistant', content: lastWorkerResult })
      workerMessages.push({
        role: 'user',
        content: `El revisor no aprobó el trabajo. Corregí según este feedback:\n${review.feedback}\nPendientes:\n- ${review.missing.join('\n- ') || 'Ver detalles del feedback'}`,
      })
    }
  }

  // Coordinator final response
  const coordinatorResponse = await callLLM({
    provider: 'gemini',
    model: GEMINI_MODEL,
    apiKey: GEMINI_API_KEY,
    messages: [
      { role: 'system', content: COORDINATOR_PROMPT },
      { role: 'user', content: `TAREA ORIGINAL DEL USUARIO:\n${options.message}\n\nTRABAJO APROBADO POR EL REVISOR:\n${lastWorkerResult}\n\n${!review.approved ? 'Nota: se alcanzó el máximo de iteraciones sin aprobación completa.' : ''}` },
    ],
    temperature: 0.2,
    maxTokens: 2048,
    signal: AbortSignal.timeout(60_000),
  })

  await callbacks.onCoordinatorDone?.({
    content: coordinatorResponse.content,
    reasoning: coordinatorResponse.reasoning_content,
  })

  // Persist final messages
  saveChatMessage(threadId, 'assistant', coordinatorResponse.content, {
    visible: true,
    metadata: {
      reasoning: coordinatorResponse.reasoning_content,
      tool_calls: allToolCalls,
      iterations: completedIterations,
      review,
    },
  })

  return {
    thread_id: threadId,
    content: coordinatorResponse.content,
    reasoning: coordinatorResponse.reasoning_content,
    tool_calls: allToolCalls,
    iterations: completedIterations,
    review,
  }
}
