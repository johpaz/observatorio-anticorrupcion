import { db } from '../db/client'
import { buscarPorNombre, esNombre } from '../services/buscador'
import { contratistasConSancion, type FuenteSancion } from '../services/cruce'
import type { LLMToolDef } from '@johpaz/hive-sdk'

const PROCURADURIA_URL = Bun.env.PROCURADURIA_URL ?? 'http://localhost:3000'

/** Banderas de sanciones: se responden cruzando la fuente completa con el registro de proveedores. */
const FUENTE_DE_BANDERA: Record<string, FuenteSancion> = {
  SANCIONADO_DISCIPLINARIO: 'disciplinarios',
  RESPONSABILIDAD_FISCAL: 'fiscales',
  MULTA_SECOP: 'multas',
}

/** Banderas que puede tener un score (ver docs/diccionario_datos.md). */
export const BANDERAS = [
  'VENCIDOS_SIN_CERRAR', 'EXTENSION_MAYOR_1_ANO', 'MULTIPLES_ADICIONES', 'CONCENTRACION_ENTIDADES',
  'BAJA_EJECUCION', 'SANCIONADO_DISCIPLINARIO', 'RESPONSABILIDAD_FISCAL', 'MULTA_SECOP', 'ANOMALIA_ESTADISTICA',
] as const

export const FUNCTION_DECLARATIONS: LLMToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_contratista',
      description: 'Busca contratistas por nombre, razón social, NIT o cédula en SECOP II, los registros de sanciones y los scores ya calculados. Devuelve el NIT de cada coincidencia y si registra antecedentes.',
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
      description: 'Lista los contratistas de mayor riesgo en un sector. Acepta nombres aproximados ("defensa", "deporte"); si no existe, devuelve la lista de sectores válidos. Si devuelve una lista vacía, el sector existe pero no tiene contratistas con ese nivel: dilo así.',
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
      name: 'buscar_por_bandera',
      description: 'Lista los contratistas que tienen una bandera de riesgo concreta, sin recorrer sector por sector. Para SANCIONADO_DISCIPLINARIO, RESPONSABILIDAD_FISCAL y MULTA_SECOP cruza la fuente oficial completa (SIRI, CGR, multas SECOP) con todos los proveedores registrados en SECOP II y devuelve el total real. Para las demás banderas lista los contratistas ya analizados. Úsala para preguntas como "¿qué contratistas tienen la bandera X?" y entrega la lista que devuelva; para el detalle de uno, usa verificar_sanciones u obtener_score_riesgo con su NIT.',
      parameters: {
        type: 'object',
        properties: {
          bandera: { type: 'string', description: `Código de la bandera. Valores válidos: ${BANDERAS.join(', ')}` },
          sector: { type: 'string', description: 'Opcional: limitar a un sector SECOP II' },
          limite: { type: 'number', description: 'Cuántos devolver (por defecto 15, máximo 30)' },
        },
        required: ['bandera'],
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

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Resuelve el sector que escribió el modelo ("Defensa y Seguridad", "deporte") al nombre exacto guardado. */
export function resolverSector(entrada: string): { sector: string } | { error: string; sectores_validos: string[] } {
  const validos = (db.query(`SELECT DISTINCT sector FROM scores WHERE sector IS NOT NULL AND sector != '' ORDER BY sector`).all() as { sector: string }[]).map(r => r.sector)
  const q = sinTildes(entrada)
  const norm = validos.map(v => [v, sinTildes(v)] as const)
  const hit =
    norm.find(([, n]) => n === q) ??
    norm.find(([, n]) => q && (n.includes(q) || q.includes(n))) ??
    // plural/singular: "deportes" ↔ "deporte"
    norm.find(([, n]) => q.length >= 4 && (n.includes(q.replace(/e?s$/, '')) || q.includes(n.replace(/e?s$/, ''))))
  return hit ? { sector: hit[0] } : { error: `Sector "${entrada}" no existe en el observatorio`, sectores_validos: validos }
}

export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  try {
    if (name === 'buscar_contratista') {
      if (esNombre(String(args.query ?? ''))) {
        const r = await buscarPorNombre(String(args.query))
        return r.candidatos.length > 0
          ? { candidatos: r.candidatos.slice(0, 8), fuentes_fallidas: r.fuentes_fallidas, nota: 'Coincidir por nombre no confirma identidad: verifica el NIT antes de concluir.' }
          : { mensaje: 'No se encontraron contratistas con ese criterio', fuentes_fallidas: r.fuentes_fallidas }
      }
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
      const { nivel } = args
      const resuelto = resolverSector(String(args.sector ?? ''))
      if ('error' in resuelto) return resuelto
      const sector = resuelto.sector
      const where = nivel ? 'sector = ? AND nivel_riesgo = ?' : 'sector = ?'
      const params: any[] = nivel ? [sector, nivel, 10] : [sector, 10]
      const rows = db.query(
        `SELECT nit, nombre, score_total, nivel_riesgo, flags FROM scores
         WHERE ${where} ORDER BY score_total DESC LIMIT ?`
      ).all(...params) as any[]
      return rows.map(r => ({ ...r, flags: JSON.parse(r.flags) }))
    }

    if (name === 'buscar_por_bandera') {
      const bandera = String(args.bandera ?? '').trim().toUpperCase()
      if (!(BANDERAS as readonly string[]).includes(bandera)) {
        return { error: `Bandera "${args.bandera}" no válida`, banderas_validas: BANDERAS }
      }
      const limite = Math.min(Math.max(Number(args.limite ?? 15) || 15, 1), 30)

      const fuente = FUENTE_DE_BANDERA[bandera]
      if (fuente) {
        const lista = await contratistasConSancion(fuente)
        const pagina = lista.slice(0, limite)
        const conScore = new Map(
          (db.query(`SELECT nit, score_total, nivel_riesgo FROM scores WHERE nit IN (${pagina.map(() => '?').join(',') || "''"})`)
            .all(...pagina.map(c => c.nit)) as any[]).map(r => [r.nit, r]),
        )
        return {
          bandera,
          total_contratistas_con_la_bandera: lista.length,
          mostrando: pagina.length,
          contratistas: pagina.map(c => ({ ...c, ...(conScore.get(c.nit) ? { score_total: conScore.get(c.nit).score_total, nivel_riesgo: conScore.get(c.nit).nivel_riesgo } : {}) })),
          nota: 'Proveedores registrados en SECOP II cuyo documento figura en la fuente de sanciones (coincidencia exacta de documento). No implica que tengan contratos vigentes; verifica el detalle con verificar_sanciones.',
          ...(args.sector ? { aviso: 'El filtro por sector no aplica a las banderas de sanciones y se ignoró.' } : {}),
        }
      }

      // Las banderas con parámetro se guardan como CODIGO(n/total); las simples, como CODIGO
      const patrones = [`%"${bandera}"%`, `%"${bandera}(%`]
      let sector: string | null = null
      if (args.sector) {
        const resuelto = resolverSector(String(args.sector))
        if ('error' in resuelto) return resuelto
        sector = resuelto.sector
      }
      const where = `(flags LIKE ? OR flags LIKE ?)${sector ? ' AND sector = ?' : ''}`
      const params: any[] = sector ? [...patrones, sector] : patrones

      const total = (db.query(`SELECT COUNT(*) c FROM scores WHERE ${where}`).get(...params) as { c: number }).c
      const rows = db.query(
        `SELECT nit, nombre, score_total, nivel_riesgo, sector, flags FROM scores
         WHERE ${where} ORDER BY score_total DESC LIMIT ?`
      ).all(...params, limite) as any[]
      const analizados = (db.query(`SELECT COUNT(*) c FROM scores`).get() as { c: number }).c

      return {
        bandera,
        sector: sector ?? 'todos',
        total_con_bandera: total,
        mostrando: rows.length,
        total_contratistas_analizados: analizados,
        contratistas: rows.map(r => ({ ...r, flags: JSON.parse(r.flags) })),
        nota: 'Solo incluye contratistas ya analizados por el observatorio, no todo SECOP II.',
      }
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
