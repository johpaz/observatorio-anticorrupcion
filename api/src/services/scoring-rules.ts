/**
 * Reglas de puntaje de las banderas de contratos, en proporción y no en casos absolutos.
 *
 * Antes cada contrato vencido sumaba 25 puntos y bastaban 5 entidades para la bandera de
 * concentración: un contratista con 400 contratos y 3 vencidos (0,7 %) recibía el mismo
 * puntaje que uno con 3 contratos y 3 vencidos (100 %), y los contratistas grandes
 * dispararían banderas solo por volumen.
 *
 * Cada regla usa la tasa de contratos afectados:
 *  - `minTasa`: por debajo de ese porcentaje la bandera no se activa.
 *  - `saturacion`: tasa (suavizada) a partir de la cual se otorga el máximo.
 *  - suavizado: la tasa se calcula como casos / (total + SMOOTHING), para que un historial
 *    de 1 o 2 contratos no alcance el máximo por azar.
 *
 * Módulo sin dependencias: lo comparten el scorer y las pruebas. El frontend
 * (utils/flags.ts) mantiene una copia, protegida por una prueba de paridad.
 */

/**
 * Versión de las reglas de puntaje. Súbela cada vez que cambie la aritmética de las banderas
 * o el modelo de anomalías: al arrancar, initDb() vence los scores guardados con otra versión
 * y se recalculan solos (sin scripts manuales en producción).
 */
export const SCORING_VERSION = '2-proporcional'

export const SMOOTHING = 2

export interface ReglaTasa {
  max: number
  saturacion: number
  minTasa: number
}

export const REGLAS = {
  vencidos:      { max: 75, saturacion: 0.6, minTasa: 0.05 } satisfies ReglaTasa,
  extension:     { max: 20, saturacion: 0.3, minTasa: 0.05 } satisfies ReglaTasa,
  adiciones:     { max: 15, saturacion: 0.6, minTasa: 0.3, minCasos: 3 },
  bajaEjecucion: { max: 15, saturacion: 0.3, minTasa: 0.1 } satisfies ReglaTasa,
  concentracion: { puntos: 10, minEntidades: 5, minTasa: 0.4 },
} as const

export function puntosPorTasa(casos: number, total: number, regla: ReglaTasa): number {
  if (casos < 1 || total < 1 || casos / total < regla.minTasa) return 0
  return Math.round(regla.max * Math.min(1, casos / (total + SMOOTHING) / regla.saturacion))
}

export function puntosConcentracion(entidades: number, contratos: number): number {
  const r = REGLAS.concentracion
  if (entidades < r.minEntidades || contratos < 1 || entidades / contratos < r.minTasa) return 0
  return r.puntos
}

export function puntosAdiciones(casos: number, total: number): number {
  return casos < REGLAS.adiciones.minCasos ? 0 : puntosPorTasa(casos, total, REGLAS.adiciones)
}

export function puntosAnomalia(score: number): number {
  return Math.min(Math.max(Math.round((-score - 0.05) / 0.45 * 30), 0), 30)
}

/** Puntos de una bandera tal como se guarda en `scores.flags`, p. ej. "VENCIDOS_SIN_CERRAR(3/25)". */
export function puntosBandera(flag: string): number {
  const m = flag.match(/^([A-Z_0-9]+?)(?:\((-?[\d.]+)(?:\/(\d+))?\))?$/)
  const code = m?.[1] ?? flag
  const n = m?.[2] !== undefined ? Number(m[2]) : NaN
  const total = m?.[3] !== undefined ? Number(m[3]) : NaN
  switch (code) {
    case 'VENCIDOS_SIN_CERRAR':       return puntosPorTasa(n, total, REGLAS.vencidos)
    case 'EXTENSION_MAYOR_1_ANO':     return puntosPorTasa(n, total, REGLAS.extension)
    case 'MULTIPLES_ADICIONES':       return puntosAdiciones(n, total)
    case 'CONCENTRACION_ENTIDADES':   return puntosConcentracion(n, total)
    case 'BAJA_EJECUCION':            return puntosPorTasa(n, total, REGLAS.bajaEjecucion)
    case 'SANCIONADO_DISCIPLINARIO':  return 30
    case 'RESPONSABILIDAD_FISCAL':    return 25
    case 'MULTA_SECOP':               return 15
    case 'ANOMALIA_ESTADISTICA':      return puntosAnomalia(n)
    default: throw new Error(`Bandera desconocida: ${flag}`)
  }
}
