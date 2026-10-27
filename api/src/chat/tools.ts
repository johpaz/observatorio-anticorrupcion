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
      name: 'contratos_de_contratista',
      description: 'Lista los contratos concretos de un contratista ya analizado (entidad, valor, fechas, estado, días adicionados, facturación), con la razón de cada bandera. Úsala para sustentar un hallazgo con casos reales. Datos de la base local; si el NIT no fue analizado, lo indica.',
      parameters: {
        type: 'object',
        properties: {
          nit: { type: 'string', description: 'NIT del contratista' },
          filtro: { type: 'string', enum: ['todos', 'vencidos', 'adiciones', 'baja_ejecucion'], description: 'Opcional: solo contratos vencidos sin cerrar, con días adicionados o con baja ejecución' },
          limite: { type: 'number', description: 'Máximo de contratos a devolver (por defecto 10, máximo 20)' },
        },
        required: ['nit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'comparar_contratistas',
      description: 'Compara de 2 a 5 contratistas por NIT en una sola llamada: score, nivel, banderas, sector y resumen de sanciones. Úsala en vez de pedir score y sanciones uno por uno.',
      parameters: {
        type: 'object',
        properties: {
          nits: { type: 'array', items: { type: 'string' }, description: 'NITs a comparar (2 a 5)' },
        },
        required: ['nits'],
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

    if (name === 'contratos_de_contratista') {
      const nit = String(args.nit ?? '').trim()
      const limite = Math.min(Math.max(Number(args.limite ?? 10) || 10, 1), 20)
      const filtro = String(args.filtro ?? 'todos')
      const filas = db.query(`SELECT contrato_id, entidad, valor, fecha_inicio, fecha_fin, estado, raw_json FROM contratos_cache WHERE nit = ? ORDER BY fecha_fin DESC`).all(nit) as any[]
      if (filas.length === 0) return { error: `No hay contratos de ${nit} en la base local: el contratista no ha sido analizado todavía.` }
      const seisMeses = Date.now() - 183 * 86_400_000
      const contratos = filas.map(r => {
        let raw: any = {}
        try { raw = JSON.parse(r.raw_json) } catch {}
        const valor = Number(raw.valor_del_contrato ?? r.valor ?? 0)
        const facturado = Number(raw.valor_facturado ?? 0)
        const dias = Number(raw.dias_adicionados ?? 0) || 0
        const estado = String(r.estado ?? '').toLowerCase()
        const estadoRaw = String(raw.estado_contrato ?? '').toLowerCase()
        const fin = r.fecha_fin ? Date.parse(r.fecha_fin) : NaN
        const razones: string[] = []
        if (!Number.isNaN(fin) && fin < seisMeses && (estado.includes('ejecuci') || estado.includes('prorrogado'))) razones.push('VENCIDO_SIN_CERRAR')
        if (dias > 0) razones.push(`ADICION_${dias}_DIAS`)
        if (valor > 5_000_000 && facturado / valor < 0.5 && (estadoRaw.includes('terminado') || estadoRaw.includes('cancelado'))) razones.push('BAJA_EJECUCION')
        return {
          contrato: r.contrato_id, entidad: r.entidad, valor, fecha_inicio: r.fecha_inicio, fecha_fin: r.fecha_fin, estado: r.estado,
          dias_adicionados: dias, valor_facturado: facturado, objeto: String(raw.objeto_del_contrato ?? '').slice(0, 160), razones,
        }
      })
      const sel = contratos.filter(c =>
        filtro === 'vencidos' ? c.razones.includes('VENCIDO_SIN_CERRAR')
        : filtro === 'adiciones' ? c.dias_adicionados > 0
        : filtro === 'baja_ejecucion' ? c.razones.includes('BAJA_EJECUCION')
        : true)
      return {
        nit,
        contratos_en_base: contratos.length,
        con_razon_de_bandera: contratos.filter(c => c.razones.length > 0).length,
        coinciden_con_filtro: sel.length,
        valor_total_coinciden: sel.reduce((a, c) => a + c.valor, 0),
        mostrando: Math.min(sel.length, limite),
        contratos: sel.slice(0, limite),
        nota: 'La base local guarda hasta 500 contratos por contratista; las banderas del score pueden contar más.',
      }
    }

    if (name === 'comparar_contratistas') {
      const nits = [...new Set((Array.isArray(args.nits) ? args.nits : []).map((n: any) => String(n).trim()).filter(Boolean))]
      if (nits.length < 2 || nits.length > 5) return { error: 'Indica entre 2 y 5 NITs distintos' }
      const comparados = await Promise.all(nits.map(async nit => {
        const row = db.query(`SELECT nombre, score_total, nivel_riesgo, sector, flags FROM scores WHERE nit = ?`).get(nit) as any
        const sanciones = await executeTool('verificar_sanciones', { nit })
        return {
          nit,
          ...(row
            ? { nombre: row.nombre, score_total: row.score_total, nivel_riesgo: row.nivel_riesgo, sector: row.sector, flags: JSON.parse(row.flags) }
            : { score: 'sin score: no ha sido analizado (no significa que esté libre de alertas)' }),
          sanciones: sanciones.error ? { error: sanciones.error } : { resumen: sanciones.resumen, multas: sanciones.multas?.length ?? 0 },
        }
      }))
      const ordenados = comparados.filter((c: any) => typeof c.score_total === 'number').sort((a: any, b: any) => b.score_total - a.score_total)
      return { comparados, mayor_score: ordenados[0]?.nit ?? null }
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
