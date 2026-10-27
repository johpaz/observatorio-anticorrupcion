/**
 * Fuente única de metadatos de las 9 banderas de riesgo del scorer.
 * Las etiquetas y la aritmética de puntos deben coincidir con
 * api/src/services/scorer.ts (paridad protegida por tests).
 */
export type FlagCategoria = 'contratos' | 'ejecucion' | 'sanciones' | 'anomalia'

export const CATEGORIAS: Record<FlagCategoria, { label: string; color: string }> = {
  contratos: { label: 'Contratos',   color: '#1e509d' },
  ejecucion: { label: 'Ejecución',   color: '#c69400' },
  sanciones: { label: 'Sanciones',   color: '#c52727' },
  anomalia:  { label: 'Anomalía ML', color: '#7c3aed' },
}

interface FlagMeta {
  label: string
  short: (n?: number) => string
  /** n = casos; total = contratos evaluados. Sin total (flags guardadas antes de las reglas proporcionales) rige el puntaje anterior. */
  points: (n?: number, total?: number) => number
  categoria: FlagCategoria
}

// ── Reglas proporcionales: copia de api/src/services/scoring-rules.ts ──
// La paridad exacta la protege frontend/tests/flags.test.ts con la misma tabla que el backend.
const SMOOTHING = 2
interface ReglaTasa { max: number; saturacion: number; minTasa: number }
const R = {
  vencidos:      { max: 75, saturacion: 0.6, minTasa: 0.05 },
  extension:     { max: 20, saturacion: 0.3, minTasa: 0.05 },
  adiciones:     { max: 15, saturacion: 0.6, minTasa: 0.3 },
  bajaEjecucion: { max: 15, saturacion: 0.3, minTasa: 0.1 },
} satisfies Record<string, ReglaTasa>

function porTasa(casos: number, total: number, r: ReglaTasa): number {
  if (casos < 1 || total < 1 || casos / total < r.minTasa) return 0
  return Math.round(r.max * Math.min(1, casos / (total + SMOOTHING) / r.saturacion))
}

export const FLAG_META: Record<string, FlagMeta> = {
  VENCIDOS_SIN_CERRAR: {
    label: 'Contratos "En ejecución" vencidos hace más de 6 meses sin liquidar (hasta 75 pts según el % de contratos afectados; desde 5 %)',
    short: n => `Vencidos ×${n ?? 1}`,
    points: (n, total) => total === undefined ? Math.min((n ?? 1) * 25, 75) : porTasa(n ?? 0, total, R.vencidos),
    categoria: 'contratos',
  },
  EXTENSION_MAYOR_1_ANO: {
    label: 'Contratos con más de 365 días adicionados sobre su plazo (hasta 20 pts según el % de contratos afectados; desde 5 %)',
    short: () => 'Extensión >1 año',
    points: (n, total) => total === undefined ? 20 : porTasa(n ?? 0, total, R.extension),
    categoria: 'contratos',
  },
  MULTIPLES_ADICIONES: {
    label: 'Tres o más contratos con extensiones de plazo, que sean al menos el 30 % de sus contratos (hasta 15 pts)',
    short: n => `Adiciones ×${n ?? 3}`,
    points: (n, total) => total === undefined ? 15 : ((n ?? 0) < 3 ? 0 : porTasa(n ?? 0, total, R.adiciones)),
    categoria: 'contratos',
  },
  CONCENTRACION_ENTIDADES: {
    label: 'Contratos en 5 o más entidades públicas distintas, con una entidad distinta en al menos el 40 % de sus contratos (+10 pts)',
    short: n => `Entidades ×${n ?? 5}`,
    points: (n, total) => total === undefined ? 10 : ((n ?? 0) >= 5 && total >= 1 && (n ?? 0) / total >= 0.4 ? 10 : 0),
    categoria: 'contratos',
  },
  BAJA_EJECUCION: {
    label: 'Contratos terminados o cancelados (> $5M) con facturación menor al 50 % del valor (hasta 15 pts según el % de esos contratos; desde 10 %)',
    short: n => `Baja ejecución ×${n ?? 1}`,
    points: (n, total) => total === undefined ? 15 : porTasa(n ?? 0, total, R.bajaEjecucion),
    categoria: 'ejecucion',
  },
  SANCIONADO_DISCIPLINARIO: {
    label: 'Registra sanciones disciplinarias en el SIRI de la Procuraduría (+30 pts)',
    short: () => 'Sanción PGN',
    points: () => 30,
    categoria: 'sanciones',
  },
  RESPONSABILIDAD_FISCAL: {
    label: 'Registra fallos de responsabilidad fiscal en la Contraloría (+25 pts)',
    short: () => 'Fiscal CGR',
    points: () => 25,
    categoria: 'sanciones',
  },
  MULTA_SECOP: {
    label: 'Registra multas en contratos públicos SECOP (+15 pts)',
    short: () => 'Multa SECOP',
    points: () => 15,
    categoria: 'sanciones',
  },
  ANOMALIA_ESTADISTICA: {
    label: 'Perfil estadísticamente atípico frente a sus pares del sector — Isolation Forest (0 a +30 pts)',
    short: () => 'Anomalía ML',
    // n es el anomaly score (negativo). Misma fórmula lineal del scorer.
    points: n => Math.min(Math.max(Math.round(((-(n ?? 0)) - 0.05) / 0.45 * 30), 0), 30),
    categoria: 'anomalia',
  },
}

export interface ParsedFlag {
  code: string
  raw: string
  n?: number
  /** Contratos evaluados: "VENCIDOS_SIN_CERRAR(3/25)". Ausente en banderas guardadas con el formato anterior. */
  total?: number
  meta: FlagMeta | null
}

/** "VENCIDOS_SIN_CERRAR(3/25)" → { code, n: 3, total: 25, meta } */
export function parseFlag(flag: string): ParsedFlag {
  const m = flag.match(/^([A-Z_0-9]+?)(?:\((-?[\d.]+)(?:\/(\d+))?\))?$/)
  const code = m?.[1] ?? flag
  const n = m?.[2] !== undefined ? Number(m[2]) : undefined
  const total = m?.[3] !== undefined ? Number(m[3]) : undefined
  return { code, raw: flag, n, total, meta: FLAG_META[code] ?? null }
}

export function flagLabel(flag: string): string {
  const p = parseFlag(flag)
  return p.meta?.label ?? flag
}

export function flagShort(flag: string): string {
  const p = parseFlag(flag)
  return p.meta ? p.meta.short(p.n) : flag
}

export function flagPoints(flag: string): number {
  const p = parseFlag(flag)
  return p.meta ? Math.max(p.meta.points(p.n, p.total), 0) : 0
}

export interface BreakdownItem {
  categoria: FlagCategoria
  label: string
  color: string
  puntos: number
  flags: { raw: string; label: string; short: string; puntos: number }[]
}

/** Desglosa las banderas en puntos por categoría (contratos/ejecución/sanciones/anomalía). */
export function scoreBreakdown(flags: string[]): BreakdownItem[] {
  const byCat = new Map<FlagCategoria, BreakdownItem>()
  for (const raw of flags) {
    const p = parseFlag(raw)
    if (!p.meta) continue
    const cat = p.meta.categoria
    let item = byCat.get(cat)
    if (!item) {
      item = { categoria: cat, label: CATEGORIAS[cat].label, color: CATEGORIAS[cat].color, puntos: 0, flags: [] }
      byCat.set(cat, item)
    }
    const puntos = Math.max(p.meta.points(p.n, p.total), 0)
    item.puntos += puntos
    item.flags.push({ raw, label: p.meta.label, short: p.meta.short(p.n), puntos })
  }
  return [...byCat.values()]
}
