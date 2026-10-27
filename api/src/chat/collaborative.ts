import type { LLMMessage, LLMToolCall } from '@johpaz/hive-sdk'
import { llamarCompleto } from './llm'
import { FUNCTION_DECLARATIONS, executeTool } from './tools'
import { loadChatHistory, saveChatMessage } from '../db/client'

const GEMINI_API_KEY = Bun.env.GEMINI_API_KEY
const GEMINI_MODEL = Bun.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'

export const WORKER_PROMPT = `Eres un analista experto en contratación pública colombiana (SECOP II) y riesgo anticorrupción.
Tu trabajo es ejecutar la tarea que te asigne el coordinador.
Usa las herramientas disponibles siempre que necesites datos reales. Para listar contratistas por bandera de riesgo usa buscar_por_bandera en una sola llamada; para un sector, alertas_sector. Entrega siempre la lista concreta (NIT, nombre, score) y no te limites a describir las fuentes. No tienes acceso a internet: si algo no está en las fuentes oficiales internas, indícalo y no lo inventes.
Si solo tienes un nombre o razón social, búscalo con buscar_contratista y confirma el NIT; coincidir por nombre no prueba que sea la misma persona. Búsqueda por nombre: llama buscar_contratista UNA vez y muestra la lista de coincidencias (NIT, nombre, score y sanciones que ya traiga). No consultes score ni sanciones de cada coincidencia ni repitas la búsqueda; ofrece profundizar si el usuario elige una. Nunca afirmes que algo no existe (multas, sanciones, contratos) si no consultaste esa fuente en esta conversación: di 'no lo consulté' o consúltala. Si una búsqueda no devuelve nada, responde solo 'no se encontraron coincidencias' y nombra únicamente las fuentes que realmente consultaste; no describas verificaciones en Procuraduría, CGR o SECOP que no hiciste. Si alertas_sector o buscar_por_bandera devuelven sectores_validos, reintenta UNA vez con uno de ellos. Para sustentar un hallazgo con casos reales usa contratos_de_contratista; para comparar 2 a 5 contratistas usa comparar_contratistas en una sola llamada, no score y sanciones uno por uno.
Responde en español, con fuentes citadas.
Si la tarea requiere múltiples pasos, muéstralos claramente.
Cuando el contratista tenga multas SECOP, detalla para cada una: el valor, la entidad que impuso la multa, la resolución, el contrato asociado y la fecha.
Importante: los scores de riesgo son indicativos basados en patrones estadísticos. No constituyen prueba de corrupción.
Cita siempre la fuente: SECOP II (datos.gov.co), Procuraduría (SIRI), CGR, SECOP Multas según corresponda.`

export const REVIEWER_PROMPT = `Eres un revisor crítico y exigente de un equipo de análisis anticorrupción.
Evalúa si el siguiente trabajo cumple EXACTAMENTE al 100% con la tarea solicitada.
Si las herramientas devolvieron cero resultados, una respuesta que lo declara con claridad, indica el alcance de la búsqueda y no inventa datos está COMPLETA: apruébala; no exijas listas que las fuentes no contienen.
Si la tarea es solo buscar o listar coincidencias por nombre, la lista de coincidencias basta: no exijas score ni sanciones de cada una. Verifica que las afirmaciones estén respaldadas por las herramientas adecuadas. Para datos cubiertos por SECOP y los registros internos de sanciones, exige esas fuentes oficiales internas como base. El equipo no tiene acceso a internet: no exijas ni aceptes afirmaciones que no provengan de las herramientas.
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
No inventes datos. Si algo no pudo verificarse, dilo explícitamente. Limítate a lo que contiene el trabajo revisado: no añadas fuentes, verificaciones ni listas de bases de datos que no aparezcan en él. Si no hay resultados, dilo en una o dos frases. 'Sin score calculado' significa que el contratista no ha sido analizado, no que esté libre de alertas.
Prioriza las fuentes internas oficiales para SECOP y sanciones y expresa con precisión cualquier incertidumbre o falta de verificación.
Importante: los scores de riesgo son indicativos basados en patrones estadísticos. No constituyen prueba de corrupción.`

export interface CollaborativeCallbacks {
  onThread?: (threadId: string) => void | Promise<void>
  onIteration?: (iteration: number, maxIterations: number) => void | Promise<void>
  onWorkerStart?: () => void | Promise<void>
  onWorkerDone?: (result: { content: string; reasoning?: string }) => void | Promise<void>
  onToolCall?: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void | Promise<void>
  onToolResult?: (toolResult: { id: string; name: string; result: any }) => void | Promise<void>
  onReviewStart?: () => void | Promise<void>
  onReview?: (review: ReviewResult) => void | Promise<void>
  onCoordinatorStart?: () => void | Promise<void>
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
    const response = await llamarCompleto({
      provider: 'gemini',
      model: GEMINI_MODEL,
      apiKey: GEMINI_API_KEY!,
      messages,
      tools: FUNCTION_DECLARATIONS,
      temperature: 0.2,
      maxTokens: 8192,
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
    await callbacks.onReviewStart?.()
    const reviewResponse = await llamarCompleto({
      provider: 'gemini',
      model: GEMINI_MODEL,
      apiKey: GEMINI_API_KEY,
      messages: [
        { role: 'system', content: REVIEWER_PROMPT },
        { role: 'user', content: `TAREA:\n${options.message}\n\nTRABAJO ENTREGADO (iteración ${iteration}):\n${lastWorkerResult}` },
      ],
      temperature: 0.1,
      maxTokens: 4096,
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
  await callbacks.onCoordinatorStart?.()
  const coordinatorResponse = await llamarCompleto({
    provider: 'gemini',
    model: GEMINI_MODEL,
    apiKey: GEMINI_API_KEY,
    messages: [
      { role: 'system', content: COORDINATOR_PROMPT },
      { role: 'user', content: `TAREA ORIGINAL DEL USUARIO:\n${options.message}\n\nTRABAJO APROBADO POR EL REVISOR:\n${lastWorkerResult}\n\n${!review.approved ? 'Nota: se alcanzó el máximo de iteraciones sin aprobación completa.' : ''}` },
    ],
    temperature: 0.2,
    maxTokens: 8192,
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
