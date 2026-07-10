import { Database } from 'bun:sqlite'
import { join } from 'path'

const DB_PATH = join(import.meta.dir, '../../../../anticorrup.db')
const SECOP_API = Bun.env.SECOP_API_URL ?? 'http://localhost:3001'
const PROCURADURIA_API = Bun.env.PROCURADURIA_URL ?? 'http://localhost:3000'

function openDb() {
  try {
    return new Database(DB_PATH, { readonly: true, create: false })
  } catch {
    return null
  }
}

export const secopTools = [
  {
    name: 'buscar_contratista',
    description: 'Busca contratistas en SECOP II por nombre, NIT o entidad contratante. Usa búsqueda de texto completo sobre la base de datos de scores de riesgo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Nombre del contratista, NIT, o entidad' },
      },
      required: ['query'],
    },
    execute: async ({ query }: { query: string }) => {
      const db = openDb()
      if (!db) return { error: 'Base de datos no disponible' }
      try {
        const rows = db.query(
          `SELECT nit, nombre, score_total, nivel_riesgo, sector
           FROM scores_fts WHERE scores_fts MATCH ? ORDER BY rank LIMIT 10`
        ).all(query)
        db.close()
        return rows.length > 0 ? rows : { mensaje: 'No se encontraron contratistas con ese criterio' }
      } catch {
        // Fallback to LIKE if FTS5 not populated yet
        const rows = db.query(
          `SELECT nit, nombre, score_total, nivel_riesgo, sector FROM scores
           WHERE nombre LIKE ? OR nit LIKE ? LIMIT 10`
        ).all(`%${query}%`, `%${query}%`)
        db.close()
        return rows
      }
    },
  },

  {
    name: 'obtener_score_riesgo',
    description: 'Obtiene el score de riesgo anticorrupción completo de un contratista dado su NIT. Incluye banderas de alerta y nivel de riesgo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nit: { type: 'string', description: 'Número de Identificación Tributaria del contratista' },
      },
      required: ['nit'],
    },
    execute: async ({ nit }: { nit: string }) => {
      const db = openDb()
      if (!db) return { error: 'Base de datos no disponible' }
      const row = db.query(`SELECT * FROM scores WHERE nit = ?`).get(nit) as any
      db.close()
      if (!row) return { error: `NIT ${nit} no encontrado. Puede requerir cálculo primero.` }
      return {
        nit: row.nit,
        nombre: row.nombre,
        score_total: row.score_total,
        nivel_riesgo: row.nivel_riesgo,
        sector: row.sector,
        flags: JSON.parse(row.flags),
        calculado_at: new Date(row.calculado_at * 1000).toISOString(),
      }
    },
  },

  {
    name: 'alertas_sector',
    description: 'Lista los contratistas con mayor score de riesgo en un sector de contratación pública colombiana.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sector: { type: 'string', description: 'Sector SECOP II (ej: Transporte, Salud y Protección Social, Educación Nacional)' },
        nivel: { type: 'string', enum: ['ROJO', 'AMARILLO', 'VERDE'], description: 'Filtrar por nivel de riesgo' },
        limit: { type: 'number', description: 'Número máximo de resultados (default 10)' },
      },
      required: ['sector'],
    },
    execute: async ({ sector, nivel, limit = 10 }: { sector: string; nivel?: string; limit?: number }) => {
      const db = openDb()
      if (!db) return { error: 'Base de datos no disponible' }
      const where = nivel ? 'sector = ? AND nivel_riesgo = ?' : 'sector = ?'
      const args: any[] = nivel ? [sector, nivel, Math.min(limit, 50)] : [sector, Math.min(limit, 50)]
      const rows = db.query(
        `SELECT nit, nombre, score_total, nivel_riesgo, flags
         FROM scores WHERE ${where} ORDER BY score_total DESC LIMIT ?`
      ).all(...args) as any[]
      db.close()
      return rows.map(r => ({ ...r, flags: JSON.parse(r.flags) }))
    },
  },

  {
    name: 'contratos_contratista',
    description: 'Obtiene el historial de contratos SECOP II de un NIT con detalles de entidades, valores y estados.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nit: { type: 'string', description: 'NIT del contratista' },
        limit: { type: 'number', description: 'Número de contratos a retornar (default 20)' },
      },
      required: ['nit'],
    },
    execute: async ({ nit, limit = 20 }: { nit: string; limit?: number }) => {
      const db = openDb()
      if (!db) return { error: 'Base de datos no disponible' }
      const rows = db.query(
        `SELECT entidad, valor, estado, fecha_inicio, fecha_fin, sector
         FROM contratos_cache WHERE nit = ? ORDER BY fecha_fin DESC LIMIT ?`
      ).all(nit, Math.min(limit, 50))
      db.close()
      return rows.length > 0 ? rows : { mensaje: 'No hay contratos en caché para este NIT. Consulte el endpoint /api/contratista/:nit primero.' }
    },
  },

  {
    name: 'verificar_sanciones',
    description: 'Verifica si un NIT tiene antecedentes disciplinarios (Procuraduría), responsabilidades fiscales (CGR) o multas SECOP.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nit: { type: 'string', description: 'NIT del contratista' },
      },
      required: ['nit'],
    },
    execute: async ({ nit }: { nit: string }) => {
      try {
        const res = await fetch(`${PROCURADURIA_API}/persona/${encodeURIComponent(nit)}`, {
          signal: AbortSignal.timeout(5_000),
        })
        if (!res.ok) return { error: 'API de sanciones no disponible' }
        const data = await res.json() as any
        return {
          nit,
          resumen: data.resumen,
          disciplinarios: data.disciplinarios?.slice(0, 3),
          fiscales: data.fiscales?.slice(0, 3),
          multas: data.multas?.slice(0, 3),
        }
      } catch {
        return { error: 'No se pudo conectar con la API de Procuraduría/CGR' }
      }
    },
  },

  {
    name: 'calcular_score_nit',
    description: 'Solicita el cálculo del score de riesgo para un NIT directamente a la API SECOP. Útil cuando el NIT no está en caché.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nit: { type: 'string', description: 'NIT del contratista a evaluar' },
      },
      required: ['nit'],
    },
    execute: async ({ nit }: { nit: string }) => {
      try {
        const res = await fetch(`${SECOP_API}/api/contratista/${encodeURIComponent(nit)}?refresh=1`, {
          signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) return { error: `Error al calcular score: ${res.status}` }
        const data = await res.json() as any
        return {
          nit: data.nit,
          nombre: data.nombre,
          score_total: data.score_total,
          nivel_riesgo: data.nivel_riesgo,
          flags: data.flags,
          sancionado_paco: data.sancionado_paco,
        }
      } catch {
        return { error: 'No se pudo calcular el score. Verifique que la API SECOP esté activa.' }
      }
    },
  },
]

export type SecopTool = typeof secopTools[number]
