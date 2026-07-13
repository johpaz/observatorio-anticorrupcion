const PROCURADURIA_URL = Bun.env.PROCURADURIA_URL ?? 'http://localhost:3000'

export interface SancionesResumen {
  tiene_antecedentes_fiscales: boolean
  tiene_antecedentes_disciplinarios: boolean
  tiene_multas_secop: boolean
  tiene_obras_relacionadas: boolean
  total_registros: number
}

export interface SancionesDetalle {
  resumen: SancionesResumen
  fiscales: any[]
  disciplinarios: any[]
  multas: any[]
  obras: any[]
}

/** Perfil completo de sanciones desde /persona/:nit (SIRI, CGR, multas SECOP, obras). */
export async function getSanciones(nit: string): Promise<SancionesDetalle | null> {
  try {
    const res = await fetch(
      `${PROCURADURIA_URL}/persona/${encodeURIComponent(nit)}`,
      { signal: AbortSignal.timeout(5_000) }
    )
    if (!res.ok) return null
    const data = await res.json() as SancionesDetalle
    return data.resumen ? data : null
  } catch {
    return null
  }
}

/** Solo los booleanos del resumen — es lo único que necesita el scorer. */
export async function checkSanciones(nit: string): Promise<SancionesResumen | null> {
  const detalle = await getSanciones(nit)
  return detalle?.resumen ?? null
}
