import { Database } from 'bun:sqlite'
import { existsSync, renameSync, rmSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { DB_PATH } from '../db/client'
import { createLogger } from '../utils/logger'

/**
 * Copia local del registro de proveedores de SECOP II (datos.gov.co `qmzu-gj57`, ~1,6 M de filas,
 * actualización diaria) con búsqueda de texto completo (FTS5).
 *
 * La búsqueda por nombre no puede depender de una consulta en vivo: un nombre nuevo nunca está
 * en `socrata_cache` y datos.gov.co puede tardar o encolarse detrás de los agregados del dashboard.
 *
 * Vive en un archivo propio junto a la base principal (mismo volumen) para que la carga, que dura
 * minutos, no compita con las escrituras de scores y chat. Se construye en un archivo temporal y se
 * reemplaza de forma atómica: las búsquedas siempre ven una copia completa.
 */

const log = createLogger('proveedores')

const DATASET = 'https://www.datos.gov.co/resource/qmzu-gj57.json'
const PAGE_SIZE = Number(Bun.env.PROVEEDORES_PAGE_SIZE ?? 50_000)
// Una descarga truncada no debe reemplazar una copia buena
const MIN_FILAS = Number(Bun.env.PROVEEDORES_MIN_FILAS ?? 500_000)
const REFRESH_DAYS = Math.max(1, Number(Bun.env.PROVEEDORES_REFRESH_DAYS ?? 7))
const DAY_MS = 24 * 60 * 60 * 1000

export const PROVEEDORES_DB_PATH = Bun.env.PROVEEDORES_DB_PATH ?? join(dirname(DB_PATH), 'proveedores.db')

export interface ProveedorLocal {
  nit: string
  nombre: string
  tipo: string
  ubicacion: string
}

let reader: Database | null = null

function cerrarLector() {
  reader?.close()
  reader = null
}

function lector(): Database | null {
  if (reader) return reader
  if (!existsSync(PROVEEDORES_DB_PATH)) return null
  try {
    reader = new Database(PROVEEDORES_DB_PATH, { readonly: true })
    return reader
  } catch (err) {
    log.warn(`no se pudo abrir la copia local: ${String(err)}`)
    return null
  }
}

/** Escapa un término para FTS5 y lo vuelve prefijo: "dieg" encuentra "diego". */
function terminoFts(t: string): string {
  return `"${t.replace(/"/g, '""')}"*`
}

/** null = no hay copia local todavía (la primera carga sigue en curso): el llamador usa la consulta en vivo. */
export function buscarProveedoresLocal(tokens: string[], limite = 15): ProveedorLocal[] | null {
  const db = lector()
  if (!db || tokens.length === 0) return db ? [] : null
  try {
    const match = tokens.map(terminoFts).join(' ')
    return db.query<ProveedorLocal, [string, number]>(
      `SELECT nit, nombre, tipo, ubicacion FROM proveedores WHERE proveedores MATCH ? ORDER BY rank LIMIT ?`
    ).all(match, limite)
  } catch (err) {
    log.warn(`búsqueda local falló: ${String(err)}`)
    return null
  }
}

export function estadoProveedores(): { disponible: boolean; filas?: number; actualizado_at?: string } {
  const db = lector()
  if (!db) return { disponible: false }
  try {
    const m = db.query<{ filas: number; actualizado_at: number }, []>(`SELECT filas, actualizado_at FROM meta LIMIT 1`).get()
    return m ? { disponible: true, filas: m.filas, actualizado_at: new Date(m.actualizado_at * 1000).toISOString() } : { disponible: false }
  } catch {
    return { disponible: false }
  }
}

type Fila = Record<string, string | undefined>

async function paginas(): Promise<AsyncGenerator<Fila[]>> {
  async function* gen() {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const url = `${DATASET}?$select=nit,nombre,tipo_empresa,departamento,municipio` +
        `&$where=${encodeURIComponent("es_entidad='No'")}&$order=:id&$limit=${PAGE_SIZE}&$offset=${offset}`
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      if (!res.ok) throw new Error(`datos.gov.co respondió ${res.status}`)
      const page = (await res.json()) as Fila[]
      yield page
      if (page.length < PAGE_SIZE) return
    }
  }
  return gen()
}

let cargando = false

/** Descarga el registro completo y reemplaza la copia local. Devuelve el número de filas. */
export async function refrescarProveedores(): Promise<number> {
  if (cargando) throw new Error('Ya hay una carga de proveedores en curso')
  cargando = true
  const tmp = `${PROVEEDORES_DB_PATH}.tmp`
  const t0 = Date.now()
  try {
    for (const suf of ['', '-journal', '-wal', '-shm']) rmSync(tmp + suf, { force: true })
    const db = new Database(tmp, { create: true })
    // Es un archivo desechable hasta el renombrado: sin journal ni fsync por página
    db.exec(`PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;`)
    db.exec(`
      CREATE VIRTUAL TABLE proveedores USING fts5(
        nombre, nit UNINDEXED, tipo UNINDEXED, ubicacion UNINDEXED,
        tokenize = 'unicode61 remove_diacritics 2'
      );
      CREATE TABLE meta (filas INTEGER NOT NULL, actualizado_at INTEGER NOT NULL);
    `)
    const insert = db.prepare(`INSERT INTO proveedores (nombre, nit, tipo, ubicacion) VALUES (?, ?, ?, ?)`)

    let filas = 0
    for await (const page of await paginas()) {
      db.transaction(() => {
        for (const r of page) {
          const nombre = (r.nombre ?? '').replace(/\s+/g, ' ').trim()
          const nit = (r.nit ?? '').trim()
          if (!nombre || !nit) continue
          const ubicacion = [r.municipio, r.departamento].filter(x => x && !/no provisto/i.test(x)).join(', ')
          insert.run(nombre, nit, r.tipo_empresa ?? '', ubicacion)
          filas++
        }
      })()
    }
    if (filas < MIN_FILAS) throw new Error(`solo ${filas} filas (mínimo ${MIN_FILAS}); se conserva la copia anterior`)

    db.prepare(`INSERT INTO meta (filas, actualizado_at) VALUES (?, ?)`).run(filas, Math.floor(Date.now() / 1000))
    db.close()

    cerrarLector() // el lector abierto apunta al archivo viejo
    renameSync(tmp, PROVEEDORES_DB_PATH)
    log.info(`copia local actualizada: ${filas} proveedores en ${Math.round((Date.now() - t0) / 1000)} s`)
    return filas
  } catch (err) {
    for (const suf of ['', '-journal', '-wal', '-shm']) rmSync(tmp + suf, { force: true })
    throw err
  } finally {
    cargando = false
  }
}

function edadMs(): number {
  try { return Date.now() - statSync(PROVEEDORES_DB_PATH).mtimeMs } catch { return Infinity }
}

/** Primera carga poco después de arrancar y renovación cada PROVEEDORES_REFRESH_DAYS; la edad sale del archivo, así que sobrevive a reinicios. */
export function startProveedoresScheduler(): void {
  if (Bun.env.PROVEEDORES_REFRESH === '0') return
  const tick = () => {
    if (edadMs() < REFRESH_DAYS * DAY_MS) return
    refrescarProveedores().catch(err => log.error(`carga de proveedores falló: ${(err as Error).message}`))
  }
  setTimeout(tick, 20_000)
  setInterval(tick, 60 * 60 * 1000)
}
