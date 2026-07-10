const PROCURADURIA_URL = Bun.env.PROCURADURIA_URL ?? 'http://localhost:3000'

export interface SancionesResumen {
  tiene_antecedentes_fiscales: boolean
  tiene_antecedentes_disciplinarios: boolean
  tiene_multas_secop: boolean
  tiene_obras_relacionadas: boolean
  total_registros: number
}

export async function checkSanciones(nit: string): Promise<SancionesResumen | null> {
  try {
    const res = await fetch(
      `${PROCURADURIA_URL}/persona/${encodeURIComponent(nit)}`,
      { signal: AbortSignal.timeout(5_000) }
    )
    if (!res.ok) return null
    const data = await res.json() as { resumen: SancionesResumen }
    return data.resumen ?? null
  } catch {
    return null
  }
}
