import { Elysia, t } from 'elysia'
import { db } from '../db/client'

const GEMINI_API_KEY = Bun.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-3-flash-preview'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const PROCURADURIA_URL = Bun.env.PROCURADURIA_URL ?? 'http://localhost:3000'

const SYSTEM_PROMPT = `Eres un asistente experto en transparencia y contratación pública colombiana (SECOP II).
Tienes acceso a herramientas para consultar la base de datos de riesgo anticorrupción y los registros de sanciones.
Responde siempre en español, de forma clara y profesional.
Si te preguntan por un contratista específico, usa las herramientas para obtener datos reales.
Importante: los scores de riesgo son indicativos basados en patrones estadísticos. No constituyen prueba de corrupción.
Cita siempre la fuente: SECOP II (datos.gov.co), Procuraduría (SIRI), CGR o SECOP Multas según corresponda.`

// Gemini usa functionDeclarations (no input_schema, sino parameters directamente)
const FUNCTION_DECLARATIONS = [
  {
    name: 'buscar_contratista',
    description: 'Busca contratistas en la base de datos de scores SECOP II por nombre, NIT o sector.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nombre, NIT o término de búsqueda' },
      },
      required: ['query'],
    },
  },
  {
    name: 'obtener_score_riesgo',
    description: 'Obtiene el score de riesgo anticorrupción completo de un contratista dado su NIT.',
    parameters: {
      type: 'object',
      properties: {
        nit: { type: 'string', description: 'NIT del contratista' },
      },
      required: ['nit'],
    },
  },
  {
    name: 'alertas_sector',
    description: 'Lista los contratistas de mayor riesgo en un sector de contratación pública colombiana.',
    parameters: {
      type: 'object',
      properties: {
        sector: { type: 'string', description: 'Sector SECOP II (ej: Transporte, Salud y Protección Social, Educación Nacional)' },
        nivel:  { type: 'string', description: 'Nivel de riesgo a filtrar: ROJO, AMARILLO o VERDE' },
      },
      required: ['sector'],
    },
  },
  {
    name: 'verificar_sanciones',
    description: 'Verifica antecedentes disciplinarios (Procuraduría/SIRI), fiscales (CGR) y multas SECOP de un NIT.',
    parameters: {
      type: 'object',
      properties: {
        nit: { type: 'string', description: 'NIT del contratista' },
      },
      required: ['nit'],
    },
  },
]

async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  try {
    if (name === 'buscar_contratista') {
      const q = `%${args.query}%`
      const rows = db.query(
        `SELECT nit, nombre, score_total, nivel_riesgo, sector FROM scores
         WHERE nombre LIKE ? OR nit LIKE ? ORDER BY score_total DESC LIMIT 8`
      ).all(q, q)
      return rows.length > 0 ? rows : { mensaje: 'No se encontraron contratistas con ese criterio' }
    }

    if (name === 'obtener_score_riesgo') {
      const row = db.query(`SELECT * FROM scores WHERE nit = ?`).get(args.nit) as any
      if (!row) return { error: `NIT ${args.nit} no encontrado en la base de datos` }
      return { ...row, flags: JSON.parse(row.flags) }
    }

    if (name === 'alertas_sector') {
      const { sector, nivel } = args
      const where = nivel ? 'sector = ? AND nivel_riesgo = ?' : 'sector = ?'
      const params: any[] = nivel ? [sector, nivel, 10] : [sector, 10]
      const rows = db.query(
        `SELECT nit, nombre, score_total, nivel_riesgo, flags FROM scores
         WHERE ${where} ORDER BY score_total DESC LIMIT ?`
      ).all(...params) as any[]
      return rows.map(r => ({ ...r, flags: JSON.parse(r.flags) }))
    }

    if (name === 'verificar_sanciones') {
      const res = await fetch(`${PROCURADURIA_URL}/persona/${encodeURIComponent(args.nit)}`, {
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) return { error: 'API de sanciones no disponible' }
      const data = await res.json() as any
      return {
        resumen: data.resumen,
        disciplinarios: data.disciplinarios?.slice(0, 3),
        fiscales: data.fiscales?.slice(0, 3),
      }
    }
  } catch (e) {
    return { error: String(e) }
  }
  return { error: `Herramienta "${name}" no reconocida` }
}

async function callGemini(contents: any[]): Promise<any> {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  return res.json()
}

export const chatRoutes = new Elysia({ prefix: '/api/chat' })
  .onError(({ error, set }) => { set.status = 500; return { error: String(error) } })

  .post('/', async ({ body }) => {
    if (!GEMINI_API_KEY) {
      return {
        answer: 'El agente de chat requiere una API key de Gemini. Configure la variable GEMINI_API_KEY.',
        tool_calls: [],
      }
    }

    const contents: any[] = [
      { role: 'user', parts: [{ text: body.message }] },
    ]

    let data = await callGemini(contents)
    const toolResults: any[] = []

    // Agentic loop: ejecutar function calls hasta respuesta de texto
    for (let turn = 0; turn < 5; turn++) {
      const candidate = data.candidates?.[0]
      const parts: any[] = candidate?.content?.parts ?? []
      const funcCalls = parts.filter((p: any) => p.functionCall)

      if (funcCalls.length === 0) break

      // Agregar respuesta del modelo al historial
      contents.push({ role: 'model', parts })

      // Ejecutar cada tool y construir respuesta
      const responseParts: any[] = []
      for (const part of funcCalls) {
        const { name, args } = part.functionCall
        const result = await executeTool(name, args ?? {})
        toolResults.push({ tool: name, input: args, result })
        responseParts.push({
          functionResponse: { name, response: { result } },
        })
      }

      contents.push({ role: 'user', parts: responseParts })
      data = await callGemini(contents)
    }

    const parts: any[] = data.candidates?.[0]?.content?.parts ?? []
    const textPart = parts.find((p: any) => p.text)

    return {
      answer: textPart?.text ?? 'Sin respuesta del modelo.',
      tool_calls: toolResults,
    }
  }, {
    body: t.Object({
      message: t.String({ minLength: 2 }),
    }),
  })
