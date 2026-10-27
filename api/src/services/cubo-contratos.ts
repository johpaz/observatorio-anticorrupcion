import { db } from '../db/client'
import { createLogger } from '../utils/logger'

const log = createLogger('cubo-contratos')

const BASE = 'https://www.datos.gov.co/resource/jbjy-vk9h.json'
const PAGE = Number(Bun.env.CUBO_PAGE_SIZE ?? 50_000)
const REFRESH_DAYS = Number(Bun.env.CUBO_REFRESH_DAYS ?? 2)
const REVISION_MS = 6 * 3_600_000
const SIN_FECHA = 0

export interface FiltrosCubo {
  year?: string
  quarter?: string
  departamento?: string
  sector?: string
  tipo_de_contrato?: string
  estado_contrato?: string
}

let creado = false
function asegurarTablas() {
  if (creado) return
  db.exec(`
    CREATE TABLE IF NOT EXISTS contratos_cubo (
      anio         INTEGER NOT NULL,
      mes          TEXT    NOT NULL,
      departamento TEXT    NOT NULL,
      sector       TEXT    NOT NULL,
      tipo         TEXT    NOT NULL,
      estado       TEXT    NOT NULL,
      n            INTEGER NOT NULL,
      nv           INTEGER NOT NULL,
      valor        REAL    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cubo_anio ON contratos_cubo(anio);
    CREATE TABLE IF NOT EXISTS cubo_meta (
      anio           INTEGER PRIMARY KEY,
      actualizado_at INTEGER NOT NULL,
      filas          INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cubo_estado (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  `)
  creado = true
}

const anioDe = (y?: string) => (y && /^\d{4}$/.test(y) ? Number(y) : null)

/** ¿Hay datos locales suficientes para responder estos filtros? Con año: solo ese año; sin año: todos los esperados. */
export function cuboListo(filtros: FiltrosCubo = {}): boolean {
  asegurarTablas()
  const anio = anioDe(filtros.year)
  if (anio !== null) return !!db.query(`SELECT 1 FROM cubo_meta WHERE anio = ?`).get(anio)
  const esperados = db.query<{ valor: string }, []>(`SELECT valor FROM cubo_estado WHERE clave = 'anios'`).get()
  if (!esperados) return false
  const lista = JSON.parse(esperados.valor) as number[]
  const cargados = new Set((db.query(`SELECT anio FROM cubo_meta`).all() as { anio: number }[]).map(r => r.anio))
  return lista.length > 0 && lista.every(a => cargados.has(a))
}

function condiciones(f: FiltrosCubo, conTrimestre = true): { where: string; params: (string | number)[] } {
  const c: string[] = []
  const p: (string | number)[] = []
  const anio = anioDe(f.year)
  if (anio !== null) { c.push('anio = ?'); p.push(anio) }
  if (conTrimestre && f.quarter && /^[1-4]$/.test(f.quarter)) {
    const ini = (Number(f.quarter) - 1) * 3 + 1
    c.push(`mes != '' AND CAST(substr(mes, 6, 2) AS INTEGER) BETWEEN ? AND ?`); p.push(ini, ini + 2)
  }
  if (f.departamento) { c.push('departamento = ?'); p.push(f.departamento) }
  if (f.sector) { c.push('sector = ?'); p.push(f.sector) }
  if (f.tipo_de_contrato) { c.push('tipo = ?'); p.push(f.tipo_de_contrato) }
  if (f.estado_contrato) { c.push('estado = ?'); p.push(f.estado_contrato) }
  return { where: c.length ? c.join(' AND ') : '1=1', params: p }
}

/** Mismas formas que devuelven las consultas a datos.gov.co (valores como texto), para no tocar el frontend. */
export function agregadosLocales(filtros: FiltrosCubo = {}) {
  if (!cuboListo(filtros)) return null
  const { where, params } = condiciones(filtros)
  const k = db.query(`SELECT COALESCE(SUM(n),0) total, COALESCE(SUM(valor),0) valor, COALESCE(SUM(nv),0) nv FROM contratos_cubo WHERE ${where}`).get(...params) as any
  const kpis = {
    total: String(k.total), valor_total: String(k.valor),
    valor_promedio: k.nv > 0 ? String(k.valor / k.nv) : '0',
  }
  const agrupar = (col: string, alias: string, orden: 'valor_total' | 'total', conValor: boolean) =>
    (db.query(
      `SELECT ${col} AS ${alias}, SUM(n) AS total, SUM(valor) AS valor_total FROM contratos_cubo
       WHERE ${where} AND ${col} != '' GROUP BY ${col} ORDER BY ${orden} DESC LIMIT 15`,
    ).all(...params) as any[]).map(r => ({
      [alias]: r[alias], total: String(r.total), ...(conValor ? { valor_total: String(r.valor_total) } : {}),
    }))

  // La serie mensual solo respeta el año (igual que antes); sin año se muestran los últimos 60 meses
  const m = condiciones({ year: filtros.year }, false)
  const meses = (db.query(
    `SELECT mes, SUM(n) total, SUM(valor) valor_total FROM contratos_cubo WHERE ${m.where} AND mes != ''
     GROUP BY mes ORDER BY mes DESC LIMIT 60`,
  ).all(...m.params) as any[]).reverse().map(r => ({ mes: `${r.mes}-01T00:00:00.000`, total: String(r.total), valor_total: String(r.valor_total) }))

  return {
    kpis,
    porSector: agrupar('sector', 'sector', 'valor_total', true),
    porTipo: agrupar('tipo', 'tipo_de_contrato', 'total', false),
    porMes: meses,
    porDepto: agrupar('departamento', 'departamento', 'valor_total', true),
    porEstado: (db.query(
      `SELECT estado AS estado_contrato, SUM(n) AS total FROM contratos_cubo WHERE ${where} AND estado != '' GROUP BY estado ORDER BY total DESC`,
    ).all(...params) as any[]).map(r => ({ estado_contrato: r.estado_contrato, total: String(r.total) })),
  }
}

export function metadataLocal() {
  if (!cuboListo()) return null
  const distintos = (col: string, limite: number) =>
    (db.query(`SELECT DISTINCT ${col} v FROM contratos_cubo WHERE ${col} != '' ORDER BY ${col} LIMIT ${limite}`).all() as { v: string }[]).map(r => r.v)
  return {
    years: (db.query(`SELECT DISTINCT anio FROM contratos_cubo WHERE anio > 0 ORDER BY anio DESC LIMIT 20`).all() as { anio: number }[]).map(r => r.anio),
    departamentos: distintos('departamento', 150),
    sectores: distintos('sector', 80),
    tipos: distintos('tipo', 40),
    estados: distintos('estado', 100),
  }
}

async function consultar(params: Record<string, string>): Promise<any[]> {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  if (Bun.env.SOCRATA_APP_TOKEN) url.searchParams.set('$$app_token', Bun.env.SOCRATA_APP_TOKEN)
  let ultimo: unknown
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(300_000) })
      if (!res.ok) throw new Error(`Socrata ${res.status}`)
      return await res.json() as any[]
    } catch (err) {
      ultimo = err
      await Bun.sleep(2_000 * intento)
    }
  }
  throw ultimo
}

const DIMS = 'mes,departamento,sector,tipo_de_contrato,estado_contrato'

async function descargarAnio(anio: number): Promise<any[]> {
  const select = 'date_trunc_ym(fecha_de_firma) as mes, departamento, sector, tipo_de_contrato, estado_contrato, count(*) as n, count(valor_del_contrato) as nv, sum(valor_del_contrato) as v'
  const where = anio === SIN_FECHA ? 'fecha_de_firma IS NULL' : `date_extract_y(fecha_de_firma) = ${anio}`
  const filas: any[] = []
  for (let offset = 0; ; offset += PAGE) {
    const pagina = await consultar({ '$select': select, '$where': where, '$group': DIMS, '$order': DIMS, '$limit': String(PAGE), '$offset': String(offset) })
    filas.push(...pagina)
    if (pagina.length < PAGE) return filas
  }
}

function guardarAnio(anio: number, filas: any[]) {
  const ins = db.prepare(`INSERT INTO contratos_cubo (anio, mes, departamento, sector, tipo, estado, n, nv, valor) VALUES (?,?,?,?,?,?,?,?,?)`)
  db.transaction(() => {
    db.run(`DELETE FROM contratos_cubo WHERE anio = ?`, [anio])
    for (const f of filas) {
      ins.run(anio, f.mes ? String(f.mes).slice(0, 7) : '', f.departamento ?? '', f.sector ?? '', f.tipo_de_contrato ?? '', f.estado_contrato ?? '',
        Number(f.n ?? 0), Number(f.nv ?? 0), Number(f.v ?? 0))
    }
    db.run(`INSERT OR REPLACE INTO cubo_meta (anio, actualizado_at, filas) VALUES (?, unixepoch(), ?)`, [anio, filas.length])
  })()
}

let corriendo = false

/** Descarga el cubo año por año (cada año reemplaza al anterior en una transacción; un fallo conserva el anterior). */
export async function refrescarCubo(): Promise<{ actualizados: number[]; vigentes: number; fallidos: number[] }> {
  const res = { actualizados: [] as number[], vigentes: 0, fallidos: [] as number[] }
  if (corriendo) return res
  corriendo = true
  try {
    asegurarTablas()
    const porAnio = await consultar({ '$select': 'date_extract_y(fecha_de_firma) as y, count(*) as n', '$group': 'y', '$limit': '100' })
    const anios = [...new Set(porAnio.map(r => (r.y ? Number(r.y) : SIN_FECHA)))].filter(a => Number.isInteger(a)).sort((a, b) => b - a)
    if (anios.length === 0) throw new Error('datos.gov.co no devolvió años')
    db.run(`INSERT OR REPLACE INTO cubo_estado (clave, valor) VALUES ('anios', ?)`, [JSON.stringify(anios)])

    const limite = Math.floor(Date.now() / 1000) - REFRESH_DAYS * 86_400
    for (const anio of anios) {
      const meta = db.query<{ actualizado_at: number }, [number]>(`SELECT actualizado_at FROM cubo_meta WHERE anio = ?`).get(anio)
      if (meta && meta.actualizado_at > limite) { res.vigentes++; continue }
      try {
        const t0 = Date.now()
        const filas = await descargarAnio(anio)
        if (filas.length === 0) throw new Error('respuesta vacía')
        guardarAnio(anio, filas)
        res.actualizados.push(anio)
        log.info(`cubo ${anio || 'sin fecha'}: ${filas.length} filas en ${((Date.now() - t0) / 1000).toFixed(0)} s`)
      } catch (err) {
        res.fallidos.push(anio)
        log.warn(`cubo ${anio || 'sin fecha'} falló, se conserva la copia anterior: ${String(err)}`)
      }
    }
  } catch (err) {
    log.warn(`cubo de contratos no pudo actualizarse: ${String(err)}`)
  } finally {
    corriendo = false
  }
  return res
}

/** Al terminar de actualizar, recalcula las vistas guardadas (ahora son instantáneas). */
export function startCuboContratos(alTerminar?: () => Promise<unknown>): void {
  if (Bun.env.CUBO_CONTRATOS === '0') return log.info('cubo de contratos desactivado (CUBO_CONTRATOS=0)')
  const ciclo = async () => {
    const r = await refrescarCubo()
    if (r.actualizados.length > 0) await alTerminar?.()
  }
  setTimeout(() => { void ciclo() }, 45_000)
  setInterval(() => { void ciclo() }, REVISION_MS)
}
