import { db } from '../db/client'
import type { LLMToolDef } from '@johpaz/hive-agents-core/agent/llm-client'
import { WEB_FUNCTION_DECLARATIONS, executeWebTool, isWebTool } from './web-tools'

const PROCURADURIA_URL = Bun.env.PROCURADURIA_URL ?? 'http://localhost:3000'

export const FUNCTION_DECLARATIONS: LLMToolDef[] = [
  {
    type: 'function',
    function: {
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
  },
  {
    type: 'function',
    function: {
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
  },
  {
    type: 'function',
    function: {
      name: 'alertas_sector',
      description: 'Lista los contratistas de mayor riesgo en un sector de contratación pública colombiana.',
      parameters: {
        type: 'object',
        properties: {
          sector: { type: 'string', description: 'Sector SECOP II (ej: Transporte, Salud y Protección Social, Educación Nacional)' },
          nivel: { type: 'string', description: 'Nivel de riesgo a filtrar: ROJO, AMARILLO o VERDE' },
        },
        required: ['sector'],
      },
    },
  },
  {
    type: 'function',
    function: {
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
  },
  {
    type: 'function',
    function: {
      name: 'buscar_financiacion_politica',
      description: 'Busca exclusivamente posibles aportes o financiación de campañas y partidos políticos en Colombia usando el NIT del contratista. Devuelve fuentes web que deben verificarse antes de atribuir un aporte.',
      parameters: {
        type: 'object',
        properties: {
          nit: { type: 'string', description: 'NIT del contratista, sin puntos ni espacios' },
          nombre: { type: 'string', description: 'Nombre del contratista para validar identidad y descartar homónimos' },
        },
        required: ['nit'],
      },
    },
  },
  // La búsqueda genérica se conserva internamente para la tool política,
  // pero no se expone al LLM para evitar búsquedas web fuera de ese alcance.
  ...WEB_FUNCTION_DECLARATIONS.filter(tool => tool.function.name !== 'web_search'),
]

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  try {
    if (isWebTool(name)) return await executeWebTool(name, args)

    if (name === 'buscar_financiacion_politica') {
      const nit = String(args.nit ?? '').replace(/\D/g, '')
      if (nit.length < 6) return { error: 'El NIT es obligatorio para investigar financiación política' }

      const identidad = args.nombre ? ` "${String(args.nombre)}"` : ''
      const queries = [
        `"${nit}"${identidad} "Cuentas Claras"`,
        `"${nit}"${identidad} campaña política Colombia aporte`,
        `"${nit}"${identidad} partido político Colombia financiación donación`,
      ]
      const searches = await Promise.all(queries.map(async query => ({
        query,
        result: await executeWebTool('web_search', { query, numResults: 5 }) as any,
      })))

      const seen = new Set<string>()
      const fuentes = searches.flatMap(({ query, result }) =>
        result.ok ? (result.results ?? []).map((item: any) => ({ ...item, consulta: query })) : []
      ).filter((item: any) => item.url && !seen.has(item.url) && seen.add(item.url))

      return {
        nit,
        nombre: args.nombre,
        fuentes,
        consultas: searches.map(({ query, result }) => ({
          query,
          ok: Boolean(result.ok),
          engine: result.engine,
          error: result.error,
        })),
        advertencia: fuentes.length > 0
          ? 'Los resultados son candidatos: verifica NIT, identidad y contenido con browser antes de atribuir un aporte.'
          : 'No se encontraron registros en las fuentes consultadas; esto no demuestra que nunca hayan existido aportes.',
      }
    }

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
        multas: data.multas?.map((m: any) => ({
          entidad: m.entidad,
          nit_entidad: m.nit_entidad,
          resolucion: m.resolucion,
          contrato: m.ref_contrato,
          valor_multa: m.valor_multa,
          fecha_imposicion: m.fecha_imposicion,
          url: m.url,
        })),
      }
    }
  } catch (e) {
    return { error: String(e) }
  }
  return { error: `Herramienta "${name}" no reconocida` }
}
