import { db } from '../db/client'
import { socrataQuery } from './socrata'
import { createLogger } from '../utils/logger'

const log = createLogger('buscador')
const PROCURADURIA_URL = Bun.env.PROCURADURIA_URL ?? 'http://localhost:3000'

/** Ninguna fuente puede dejar la búsqueda colgada: pasado este tiempo se responde sin ella. */
const FUENTE_TIMEOUT_MS = Number(Bun.env.BUSQUEDA_TIMEOUT_MS ?? 15_000)

function conTimeout<T>(promesa: Promise<T>, ms = FUENTE_TIMEOUT_MS): Promise<T> {
  let timer: Timer
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`sin respuesta en ${ms} ms`)), ms)
  })
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer))
}

export type FuenteBusqueda = 'score' | 'secop' | 'sanciones'

export interface Candidato {
  nit: string
  nombre: string
  tipo?: string
  ubicacion?: string
  nivel_riesgo?: 'ROJO' | 'AMARILLO' | 'VERDE'
  score_total?: number
  /** Dónde apareció: permite a la UI mostrar si ya tiene antecedentes registrados */
  fuentes: FuenteBusqueda[]
  sanciones?: string[]
}

export interface ResultadoBusqueda {
  query: string
  candidatos: Candidato[]
  /** Fuentes que no respondieron; la búsqueda sigue con las demás */
  fuentes_fallidas: FuenteBusqueda[]
}

/** Un NIT/cédula se busca por número; cualquier cosa con letras se trata como nombre o razón social. */
export function esNombre(q: string): boolean {
  return /[a-záéíóúñü]/i.test(q)
}

function normalizar(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(q: string): string[] {
  return normalizar(q).split(' ').filter(t => t.length >= 2).slice(0, 6)
}

/**
 * SECOP II guarda los NIT de empresas con dígito de verificación (10 dígitos, empiezan en 8 o 9),
 * pero los contratos usan el NIT sin él. Las cédulas se dejan intactas.
 */
export function nitSinDv(raw: string, tipoEmpresa = ''): string {
  const digits = raw.replace(/\D/g, '')
  const esPersona = /persona natural/i.test(tipoEmpresa)
  if (!esPersona && digits.length === 10 && /^[89]/.test(digits)) return digits.slice(0, 9)
  return digits
}

function buscarEnScores(toks: string[]): Candidato[] {
  const where = toks.map(() => `UPPER(nombre) LIKE ?`).join(' AND ')
  const rows = db.query<any, string[]>(
    `SELECT nit, nombre, score_total, nivel_riesgo FROM scores
     WHERE nombre IS NOT NULL AND nombre != 'Desconocido' AND ${where}
     ORDER BY score_total DESC LIMIT 10`
  ).all(...toks.map(t => `%${t}%`))
  return rows.map(r => ({
    nit: r.nit, nombre: r.nombre, score_total: r.score_total, nivel_riesgo: r.nivel_riesgo, fuentes: ['score'] as FuenteBusqueda[],
  }))
}

async function buscarEnSecop(toks: string[]): Promise<Candidato[]> {
  const like = toks.map(t => `upper(nombre) like '%${t.replace(/'/g, "''")}%'`).join(' AND ')
  const rows = await socrataQuery('proveedores', {
    '$select': 'nit,nombre,tipo_empresa,departamento,municipio',
    '$where': `es_entidad='No' AND ${like}`,
    '$limit': '15',
  }) as any[]
  return rows.map(r => ({
    nit: nitSinDv(String(r.nit ?? ''), r.tipo_empresa),
    nombre: String(r.nombre ?? '').trim(),
    tipo: r.tipo_empresa,
    ubicacion: [r.municipio, r.departamento].filter((x: string) => x && !/no provisto/i.test(x)).join(', ') || undefined,
    fuentes: ['secop'] as FuenteBusqueda[],
  }))
}

async function buscarEnSanciones(q: string): Promise<Candidato[]> {
  const res = await fetch(`${PROCURADURIA_URL}/search?q=${encodeURIComponent(q)}&limit=15`, { signal: AbortSignal.timeout(5_000) })
  if (!res.ok) throw new Error(`sanciones ${res.status}`)
  const data = await res.json() as { results?: Record<string, any[]> }
  const etiquetas: Record<string, string> = {
    fiscales: 'Responsabilidad fiscal', disciplinarios: 'Sanción disciplinaria', multas: 'Multa SECOP', obras: 'Obra inconclusa',
  }
  const out: Candidato[] = []
  for (const [grupo, etiqueta] of Object.entries(etiquetas)) {
    for (const r of data.results?.[grupo] ?? []) {
      const nit = String(r.documento ?? '').replace(/\D/g, '')
      const nombre = String(r.nombre ?? '').replace(/\s+/g, ' ').trim()
      if (!nit || !nombre) continue
      out.push({ nit, nombre, fuentes: ['sanciones'], sanciones: [etiqueta] })
    }
  }
  return out
}

/** Une los resultados por número de documento, acumulando fuentes y sanciones. */
function fusionar(listas: Candidato[][]): Candidato[] {
  const porNit = new Map<string, Candidato>()
  for (const c of listas.flat()) {
    if (!c.nit) continue
    const prev = porNit.get(c.nit)
    if (!prev) { porNit.set(c.nit, { ...c, fuentes: [...c.fuentes], sanciones: c.sanciones ? [...c.sanciones] : undefined }); continue }
    prev.fuentes = [...new Set([...prev.fuentes, ...c.fuentes])]
    prev.sanciones = [...new Set([...(prev.sanciones ?? []), ...(c.sanciones ?? [])])]
    prev.tipo ??= c.tipo
    prev.ubicacion ??= c.ubicacion
    prev.nivel_riesgo ??= c.nivel_riesgo
    prev.score_total ??= c.score_total
    // El nombre de SECOP suele estar mejor escrito que el de los CSV de sanciones
    if (c.fuentes.includes('secop')) prev.nombre = c.nombre
  }
  // Primero los que tienen antecedentes o score ya calculado, luego por orden alfabético
  const peso = (c: Candidato) => (c.sanciones?.length ? 2 : 0) + (c.score_total !== undefined ? 1 : 0)
  return [...porNit.values()].sort((a, b) => peso(b) - peso(a) || a.nombre.localeCompare(b.nombre)).slice(0, 25)
}

export async function buscarPorNombre(q: string): Promise<ResultadoBusqueda> {
  const query = q.trim()
  const toks = tokens(query)
  const fuentes: FuenteBusqueda[] = ['score', 'secop', 'sanciones']
  if (toks.length === 0) return { query, candidatos: [], fuentes_fallidas: [] }

  const settled = await Promise.allSettled([
    Promise.resolve().then(() => buscarEnScores(toks)),
    conTimeout(buscarEnSecop(toks)),
    conTimeout(buscarEnSanciones(query)),
  ])

  const fuentes_fallidas: FuenteBusqueda[] = []
  const listas: Candidato[][] = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') listas.push(r.value)
    else {
      fuentes_fallidas.push(fuentes[i])
      log.warn(`búsqueda en ${fuentes[i]} falló: ${String(r.reason)}`)
    }
  })

  return { query, candidatos: fusionar(listas), fuentes_fallidas }
}
