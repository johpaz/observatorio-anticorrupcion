import { db } from '../db/client'
import { createLogger } from '../utils/logger'
import { cachedDashboard, canonicalCacheKey } from './dashboard-cache'
import { loadContratosDashboard, loadContratosMetadata, type ContratosFilters } from './dashboard-data'

const log = createLogger('precalculo-contratos')

const YEARS = Math.max(0, Number(Bun.env.CONTRATOS_PRECALCULO_YEARS ?? 5))
const SECTORES_MAX = Math.max(0, Number(Bun.env.CONTRATOS_PRECALCULO_SECTORES ?? 30))
const TTL_SEC = Number(Bun.env.DASHBOARD_CACHE_TTL ?? 86_400)
const PAUSA_MS = Number(Bun.env.CONTRATOS_PRECALCULO_PAUSA_MS ?? 1_000)
const REVISION_MS = 6 * 3_600_000

/** Clave idéntica a la que arma el endpoint cuando el frontend pide la vista (page=1, limit=20). */
export function claveContratos(filtros: ContratosFilters): string {
  return canonicalCacheKey('dashboard:contratos:v2', { ...filtros, page: '1', limit: '20' })
}

/** Vistas que se precalculan: sin filtros, cada uno de los últimos años y cada sector. */
export function vistasAPrecalcular(metadata: { years?: unknown[]; sectores?: unknown[] }): ContratosFilters[] {
  const years = (metadata.years ?? []).map(String).filter(y => /^\d{4}$/.test(y)).slice(0, YEARS)
  const sectores = (metadata.sectores ?? []).map(String).filter(Boolean).slice(0, SECTORES_MAX)
  return [{}, ...years.map(year => ({ year })), ...sectores.map(sector => ({ sector }))]
}

function estaVigente(clave: string, forzar: boolean): boolean {
  if (forzar) return false
  const row = db.query<{ updated_at: number }, [string]>(`SELECT updated_at FROM dashboard_cache WHERE key = ?`).get(clave)
  return !!row && row.updated_at > Math.floor(Date.now() / 1000) - TTL_SEC
}

let corriendo = false

/** Recalcula, de a una y con pausa, solo las vistas que faltan o están vencidas. Un fallo conserva la copia anterior. */
export async function precalcularContratos(forzar = false): Promise<{ calculadas: number; vigentes: number; fallidas: number }> {
  const resumen = { calculadas: 0, vigentes: 0, fallidas: 0 }
  if (corriendo) return resumen
  corriendo = true
  try {
    const metadata = await loadContratosMetadata()
    for (const filtros of vistasAPrecalcular(metadata)) {
      const clave = claveContratos(filtros)
      if (estaVigente(clave, forzar)) { resumen.vigentes++; continue }
      try {
        await cachedDashboard(clave, () => loadContratosDashboard({ ...filtros, page: '1', limit: '20' }), true)
        resumen.calculadas++
      } catch (err) {
        resumen.fallidas++
        log.warn(`vista ${JSON.stringify(filtros)} falló, se conserva la copia anterior: ${String(err)}`)
      }
      if (PAUSA_MS > 0) await Bun.sleep(PAUSA_MS)
    }
    log.info(`precálculo de contratos: ${resumen.calculadas} calculadas, ${resumen.vigentes} vigentes, ${resumen.fallidas} fallidas`)
  } catch (err) {
    log.warn(`precálculo de contratos no pudo iniciar: ${String(err)}`)
  } finally {
    corriendo = false
  }
  return resumen
}

/** Revisa cada 6 h; recalcula lo vencido. CONTRATOS_PRECALCULO=0 lo desactiva. */
export function startPrecalculoContratos(): void {
  if (Bun.env.CONTRATOS_PRECALCULO === '0') return log.info('precálculo de contratos desactivado (CONTRATOS_PRECALCULO=0)')
  setTimeout(() => { void precalcularContratos() }, 60_000)
  setInterval(() => { void precalcularContratos() }, REVISION_MS)
}
