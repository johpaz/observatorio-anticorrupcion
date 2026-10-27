import { callLLM, type LLMCallOptions, type LLMResponse } from '@johpaz/hive-sdk'

type Llamar = (options: LLMCallOptions) => Promise<LLMResponse>

const CONTINUAR = 'Continúa exactamente donde quedaste, sin repetir lo ya escrito.'
const AVISO_TRUNCADA = '\n\n_(La respuesta era demasiado larga y se cortó. Pídeme que continúe o acota la consulta.)_'

/**
 * callLLM que no entrega respuestas cortadas como si fueran finales.
 *
 * Gemini devuelve `stop_reason: "max_tokens"` cuando agota el presupuesto de salida (en modelos con
 * razonamiento, parte se gasta pensando). Antes ese texto parcial se tomaba por respuesta completa:
 * el revisor la rechazaba por incompleta y el usuario veía una frase cortada a la mitad.
 * Ahora se pide continuar hasta `maxContinuaciones` veces y, si aun así no cabe, se avisa.
 */
export async function llamarCompleto(
  options: LLMCallOptions,
  llamar: Llamar = callLLM,
  maxContinuaciones = 2,
): Promise<LLMResponse> {
  let res = await llamar(options)
  const truncada = (r: LLMResponse) => r.stop_reason === 'max_tokens' && !r.tool_calls?.length

  let texto = res.content ?? ''
  for (let i = 0; i < maxContinuaciones && truncada(res); i++) {
    const siguiente = await llamar({
      ...options,
      messages: [...options.messages, { role: 'assistant', content: texto }, { role: 'user', content: CONTINUAR }],
    })
    if (siguiente.stop_reason === 'error') break
    texto += siguiente.content ?? ''
    res = { ...siguiente, content: texto, reasoning_content: res.reasoning_content ?? siguiente.reasoning_content }
  }

  return truncada(res) ? { ...res, content: texto + AVISO_TRUNCADA } : res
}
