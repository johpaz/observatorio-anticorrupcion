import { nitSinDv } from './buscador'
import { recorrerProveedores } from './proveedores'

const PROCURADURIA_URL = Bun.env.PROCURADURIA_URL ?? 'http://localhost:3000'
const TTL_MS = 60 * 60 * 1000

export type FuenteSancion = 'disciplinarios' | 'fiscales' | 'multas'

interface DocSancion {
  documento: string
  nombre: string
  registros: number
  ultima: string | null
  valor_total: number | null
}

export interface ContratistaSancionado {
  nit: string
  nombre: string
  tipo: string
  registros: number
  ultima?: string
  valor_total?: number
}

const normalizar = (d: string) => d.replace(/[.\-\s]/g, '').toUpperCase()

/**
 * Proveedores registrados en SECOP II que figuran en una fuente de sanciones.
 *
 * La bandera SANCIONADO_DISCIPLINARIO (etc.) se calcula por documento, pero solo existe en la tabla
 * `scores` para los contratistas ya analizados (las empresas con más contratos de cada sector), que casi
 * nunca están en SIRI porque SIRI sanciona sobre todo a personas. Para responder "¿qué contratistas
 * tienen la bandera X?" hay que cruzar la fuente completa con el registro de proveedores:
 * ~19.000 documentos de SIRI contra ~1,6 M de proveedores, en poco más de un segundo.
 */
const cache = new Map<FuenteSancion, { en: number; lista: ContratistaSancionado[] }>()

async function documentos(fuente: FuenteSancion): Promise<DocSancion[]> {
  const res = await fetch(`${PROCURADURIA_URL}/documentos/${fuente}`, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`el servicio de sanciones respondió ${res.status}`)
  return ((await res.json()) as { documentos: DocSancion[] }).documentos
}

export async function contratistasConSancion(fuente: FuenteSancion): Promise<ContratistaSancionado[]> {
  const hit = cache.get(fuente)
  if (hit && Date.now() - hit.en < TTL_MS) return hit.lista

  const proveedores = recorrerProveedores()
  if (!proveedores) throw new Error('el registro de proveedores de SECOP II aún se está descargando; intenta de nuevo en unos minutos')

  const porDocumento = new Map(
    (await documentos(fuente)).map(d => [normalizar(String(d.documento)), d] as const),
  )

  const porNit = new Map<string, ContratistaSancionado>()
  for (const p of proveedores) {
    const nit = normalizar(p.nit)
    // El registro guarda los NIT de empresas con o sin dígito de verificación
    const base = nitSinDv(nit, p.tipo)
    const doc = porDocumento.get(nit) ?? porDocumento.get(base)
    if (!doc || porNit.has(base)) continue
    porNit.set(base, {
      nit: base,
      nombre: p.nombre,
      tipo: p.tipo,
      registros: doc.registros,
      ultima: doc.ultima ?? undefined,
      valor_total: doc.valor_total ?? undefined,
    })
  }

  const lista = [...porNit.values()].sort((a, b) => b.registros - a.registros || a.nombre.localeCompare(b.nombre))
  cache.set(fuente, { en: Date.now(), lista })
  return lista
}

export function limpiarCacheCruce(): void {
  cache.clear()
}
