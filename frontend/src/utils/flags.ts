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
  points: (n?: number) => number
  categoria: FlagCategoria
}

export const FLAG_META: Record<string, FlagMeta> = {
  VENCIDOS_SIN_CERRAR: {
    label: 'Contratos "En ejecución" vencidos hace más de 6 meses sin liquidar (+25 pts c/u, máx 75)',
    short: n => `Vencidos ×${n ?? 1}`,
    points: n => Math.min((n ?? 1) * 25, 75),
    categoria: 'contratos',
  },
  EXTENSION_MAYOR_1_ANO: {
    label: 'Al menos un contrato con más de 365 días adicionados sobre su plazo (+20 pts)',
    short: () => 'Extensión >1 año',
    points: () => 20,
    categoria: 'contratos',
  },
  MULTIPLES_ADICIONES: {
    label: 'Tres o más contratos con extensiones de plazo (+15 pts)',
    short: n => `Adiciones ×${n ?? 3}`,
    points: () => 15,
    categoria: 'contratos',
  },
  CONCENTRACION_ENTIDADES: {
    label: 'Contratos en 5 o más entidades públicas distintas en el mismo sector (+10 pts)',
    short: n => `Entidades ×${n ?? 5}`,
    points: () => 10,
    categoria: 'contratos',
  },
  BAJA_EJECUCION: {
    label: 'Contratos terminados o cancelados (> $5M) con facturación menor al 50 % del valor (+15 pts)',
    short: n => `Baja ejecución ×${n ?? 1}`,
    points: () => 15,
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
  meta: FlagMeta | null
}

/** "VENCIDOS_SIN_CERRAR(3)" → { code, n: 3, meta } */
export function parseFlag(flag: string): ParsedFlag {
  const m = flag.match(/^([A-Z_0-9]+?)(?:\((-?[\d.]+)\))?$/)
  const code = m?.[1] ?? flag
  const n = m?.[2] !== undefined ? Number(m[2]) : undefined
  return { code, raw: flag, n, meta: FLAG_META[code] ?? null }
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
  return p.meta ? Math.max(p.meta.points(p.n), 0) : 0
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
    const puntos = Math.max(p.meta.points(p.n), 0)
    item.puntos += puntos
    item.flags.push({ raw, label: p.meta.label, short: p.meta.short(p.n), puntos })
  }
  return [...byCat.values()]
}
