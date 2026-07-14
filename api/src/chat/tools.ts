import { db } from '../db/client'
import type { LLMToolDef } from '@johpaz/hive-agents-core/agent/llm-client'

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
]

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
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
