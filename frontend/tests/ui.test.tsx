/**
 * Tests de UI (bun test + happy-dom): la información que entrega la API
 * se muestra correctamente — scores, semáforo, banderas con sus etiquetas
 * reales y KPIs del hero alimentados por la API con fallback estático.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AlertasPage from '../src/pages/AlertasPage'
import Sidebar from '../src/components/Sidebar'
import ContratistasPage from '../src/pages/ContratistasPage'
import LandingPage from '../src/pages/LandingPage'
import { useAlertasStore, ALERTAS_INITIAL } from '../src/store/useAlertasStore'
import { useContratistasStore } from '../src/store/useContratistasStore'
import { clearDashboardRequestCache } from '../src/api/client'
import type { AlertasResponse, ContratistaResponse } from '../src/api/client'

// ── Mock de fetch por ruta ───────────────────────────────────────────────
let routes: Record<string, () => any> = {}
let failAll = false
let hangAll = false

globalThis.fetch = (async (input: any) => {
  const url = String(input)
  if (hangAll) return new Promise<Response>(() => {}) // nunca resuelve: estado "cargando"
  if (failAll) return new Response('down', { status: 503 })
  // Coincidencia más larga: '/api/alertas/sectores' gana sobre '/api/alertas'
  const path = Object.keys(routes)
    .filter(p => url.includes(p))
    .sort((a, b) => b.length - a.length)[0]
  if (!path) return new Response('not mocked: ' + url, { status: 404 })
  return Response.json(routes[path]())
}) as typeof fetch

const SECTORES_MOCK = ['Transporte', 'Salud y Protección Social', 'deportes']

beforeEach(() => {
  clearDashboardRequestCache()
  routes = {}
  failAll = false
  hangAll = false
  routes['/api/alertas/sectores'] = () => ({ sectores: SECTORES_MOCK })
  routes['/api/dashboard/bootstrap'] = () => {
    const contratos = routes['/api/contratos/kpis']?.() ?? { total: '0', valor_total: '0' }
    const stats = routes['/api/alertas/stats']?.() ?? { total: 0, rojos: 0, amarillos: 0, verdes: 0 }
    const alertas = routes['/api/alertas']?.() ?? alertasFixture
    return {
      data: {
        home: { contratos, alertas: stats },
        contratos: {
          metadata: { years: [], departamentos: [], sectores: [], tipos: [], estados: [] },
          data: { kpis: contratos, porSector: [], porTipo: [], porMes: [], porDepto: [], porEstado: [], list: [] },
        },
        archivos: {
          metadata: { years: [], entidades: [] },
          data: { kpis: {}, porExtension: [], porMes: [], porEntidad: [], list: [] },
        },
        alertas: { sectores: SECTORES_MOCK, stats, data: alertas },
      },
      cache_status: 'fresh', updated_at: new Date().toISOString(), refreshing: false,
    }
  }
  useAlertasStore.setState({ cache: new Map(), data: null, loading: false, filters: ALERTAS_INITIAL })
  useContratistasStore.setState({ cache: new Map(), loading: false })
})

afterEach(cleanup)

// ── Fixtures ─────────────────────────────────────────────────────────────
const score = (nit: string, nombre: string, total: number, nivel: 'ROJO' | 'AMARILLO' | 'VERDE', flags: string[] = []) =>
  ({ nit, nombre, score_total: total, nivel_riesgo: nivel, flags, sector: 'Transporte', sancionado_paco: false })

// Fixtures aritméticamente consistentes: score_total = suma de puntos de sus banderas
const alertasFixture: AlertasResponse = {
  total: 3,
  scores: [
    { ...score('900000001', 'CONSTRUCTORA ROJA SAS', 85, 'ROJO', ['VENCIDOS_SIN_CERRAR(3)', 'CONCENTRACION_ENTIDADES(6)']), sancionado_paco: true },
    score('900000002', 'VIAS AMARILLAS LTDA', 45, 'AMARILLO', ['EXTENSION_MAYOR_1_ANO', 'MULTA_SECOP', 'CONCENTRACION_ENTIDADES(5)']),
    score('900000003', 'PUENTES VERDES SA', 10, 'VERDE', ['CONCENTRACION_ENTIDADES(5)']),
  ],
  cached: true,
  stale: false,
  sector: 'Transporte',
  nivel: null,
  generated_at: new Date().toISOString(),
}

const desgloseFixture = {
  sector: 'Transporte',
  por_anio: [
    { anio: '2024', trimestre: 1, contratos: 5, valor: 1000 },
    { anio: '2024', trimestre: 3, contratos: 2, valor: 400 },
    { anio: '2025', trimestre: 2, contratos: 7, valor: 900 },
  ],
  por_entidad: [{ entidad: 'INVIAS', contratos: 8, valor: 1500 }],
  por_departamento: [{ departamento: 'CUNDINAMARCA', contratos: 10, valor: 2000 }],
}

// Las 9 banderas reales que emite el scorer (formato exacto)
const NINE_FLAGS = [
  'VENCIDOS_SIN_CERRAR(2)',
  'EXTENSION_MAYOR_1_ANO',
  'MULTIPLES_ADICIONES(4)',
  'CONCENTRACION_ENTIDADES(6)',
  'BAJA_EJECUCION(1)',
  'SANCIONADO_DISCIPLINARIO',
  'RESPONSABILIDAD_FISCAL',
  'MULTA_SECOP',
  'ANOMALIA_ESTADISTICA(-0.31)',
]

const sancionesFixture = {
  resumen: {
    tiene_antecedentes_fiscales: true,
    tiene_antecedentes_disciplinarios: true,
    tiene_multas_secop: true,
    tiene_obras_relacionadas: false,
    total_registros: 3,
  },
  fiscales: [{ responsable: 'PEREZ JUAN', entidad_afectada: 'ALCALDIA DE PRUEBA', departamento: 'CUNDINAMARCA', municipio: 'SOACHA' }],
  disciplinarios: [{ nombre1: 'JUAN', apellido1: 'PEREZ', tipo_sancion_aplicada: 'DESTITUCION E INHABILIDAD GENERAL', institucion: 'GOBERNACION DE PRUEBA', fecha_sancion: '2024-05-01', duracion_anos: 10 }],
  multas: [{ entidad: 'ENTIDAD MULTADORA DE PRUEBA', resolucion: '123-2024', valor_multa: 50000000, fecha_imposicion: '2024-03-01' }],
  obras: [],
}

const sinSanciones = {
  resumen: {
    tiene_antecedentes_fiscales: false,
    tiene_antecedentes_disciplinarios: false,
    tiene_multas_secop: false,
    tiene_obras_relacionadas: false,
    total_registros: 0,
  },
  fiscales: [], disciplinarios: [], multas: [], obras: [],
}

const perfilFixture: ContratistaResponse = {
  ...score('900123456', 'MEGACONSTRUCCIONES DEL CARIBE SAS', 95, 'ROJO', NINE_FLAGS),
  contratos: [
    { contrato_id: 'c1', entidad: 'INVIAS', valor: 120000000, fecha_inicio: '2024-01-01', fecha_fin: '2024-12-31', estado: 'En ejecución', sector: 'Transporte' },
    { contrato_id: 'c2', entidad: 'ANI', valor: 80000000, fecha_inicio: '2023-01-01', fecha_fin: '2023-12-31', estado: 'Terminado', sector: 'Transporte' },
  ],
  sanciones: sancionesFixture,
  cached: true,
  calculado_at: new Date().toISOString(),
}

// ── AlertasPage ──────────────────────────────────────────────────────────
describe('AlertasPage: los scores de la API se muestran correctamente', () => {
  test('renderiza nombre, NIT, score y conteos del semáforo', async () => {
    routes['/api/alertas'] = () => alertasFixture
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)

    await screen.findByText('CONSTRUCTORA ROJA SAS')
    expect(screen.getByText('NIT 900000001')).toBeTruthy()
    expect(screen.getByText('85')).toBeTruthy()
    // Tarjetas-filtro del semáforo: 1 rojo, 1 amarillo, 1 verde
    const kpi = (title: string) => screen.getByText(title).closest('button')?.textContent ?? ''
    expect(kpi('Alto Riesgo (ROJO)')).toContain('1')
    expect(kpi('Riesgo Medio (AMARILLO)')).toContain('1')
    expect(kpi('Bajo Riesgo (VERDE)')).toContain('1')
  })

  test('la carga inicial muestra el loader centrado de página', async () => {
    hangAll = true
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText(/Calculando scores de riesgo/)
    expect(screen.queryByText('CONSTRUCTORA ROJA SAS')).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  test('con datos previos (stale) muestra el aviso de actualización en segundo plano', async () => {
    routes['/api/alertas'] = () => ({ ...alertasFixture, stale: true })
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText('CONSTRUCTORA ROJA SAS')
    expect(screen.getByText(/Actualizando en segundo plano/)).toBeTruthy()
  })

  test('un fallo transitorio del API (reinicio en dev) se recupera con el reintento', async () => {
    let llamadas = 0
    routes['/api/alertas'] = () => {
      llamadas++
      if (llamadas === 1) throw new Error('socket hang up')
      return alertasFixture
    }
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)

    await screen.findByText('CONSTRUCTORA ROJA SAS', undefined, { timeout: 4000 })
    expect(llamadas).toBe(2)
  })

  test('las tarjetas del semáforo filtran al hacer clic y se desactivan con el segundo clic', async () => {
    routes['/api/alertas'] = () => alertasFixture
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText('CONSTRUCTORA ROJA SAS')

    const cardRojo = screen.getByText('Alto Riesgo (ROJO)').closest('button')!
    fireEvent.click(cardRojo)
    expect(cardRojo.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('CONSTRUCTORA ROJA SAS')).toBeTruthy()
    expect(screen.queryByText('VIAS AMARILLAS LTDA')).toBeNull()
    expect(screen.queryByText('PUENTES VERDES SA')).toBeNull()

    fireEvent.click(cardRojo) // segundo clic → vuelve a TODOS
    expect(cardRojo.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('VIAS AMARILLAS LTDA')).toBeTruthy()
    expect(screen.getByText('PUENTES VERDES SA')).toBeTruthy()
  })

  test('la búsqueda filtra por nombre y por NIT', async () => {
    routes['/api/alertas'] = () => alertasFixture
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText('CONSTRUCTORA ROJA SAS')

    const input = screen.getByLabelText('Buscar por nombre o NIT')
    fireEvent.change(input, { target: { value: 'amarillas' } })
    expect(screen.getByText('VIAS AMARILLAS LTDA')).toBeTruthy()
    expect(screen.queryByText('CONSTRUCTORA ROJA SAS')).toBeNull()

    fireEvent.change(input, { target: { value: '900000003' } })
    expect(screen.getByText('PUENTES VERDES SA')).toBeTruthy()
    expect(screen.queryByText('VIAS AMARILLAS LTDA')).toBeNull()
  })

  test('las banderas se muestran como chips legibles, no como códigos crudos', async () => {
    routes['/api/alertas'] = () => alertasFixture
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText('CONSTRUCTORA ROJA SAS')

    expect(screen.getByText('Vencidos ×3')).toBeTruthy()
    expect(screen.getByText('Extensión >1 año')).toBeTruthy()
    expect(screen.getByText('Multa SECOP')).toBeTruthy()
    expect(screen.queryByText(/VENCIDOS_SIN_CERRAR/)).toBeNull()
  })

  test('el badge ⚖️ aparece solo para contratistas sancionados', async () => {
    routes['/api/alertas'] = () => alertasFixture
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText('CONSTRUCTORA ROJA SAS')
    expect(screen.getAllByLabelText('Sancionado')).toHaveLength(1) // solo la ROJA
  })

  test('expandir una fila muestra el score discriminado y el total coincide', async () => {
    routes['/api/alertas'] = () => alertasFixture
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText('CONSTRUCTORA ROJA SAS')

    // Primera fila (ROJA): VENCIDOS(3)=75 + CONCENTRACION(6)=10 → categoría Contratos = 85
    fireEvent.click(screen.getAllByLabelText('Ver desglose de puntos')[0])
    expect(screen.getByText('Score total')).toBeTruthy()
    expect(screen.getByText('85 pts')).toBeTruthy()
    expect(screen.getByText(/vencidos hace más de 6 meses sin liquidar/)).toBeTruthy()
  })

  test('exportar CSV genera el archivo con el desglose de puntos', async () => {
    routes['/api/alertas'] = () => alertasFixture
    let blobCapturado: Blob | null = null
    let descarga = ''
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    const origClick = HTMLAnchorElement.prototype.click
    URL.createObjectURL = ((b: Blob) => { blobCapturado = b; return 'blob:test' }) as any
    URL.revokeObjectURL = (() => {}) as any
    // happy-dom navegaría de verdad al hacer click en el anchor — se captura sin navegar
    HTMLAnchorElement.prototype.click = function () { descarga = this.getAttribute('download') ?? '' }
    try {
      render(<MemoryRouter><AlertasPage /></MemoryRouter>)
      await screen.findByText('CONSTRUCTORA ROJA SAS')
      fireEvent.click(screen.getByText('Exportar CSV'))

      expect(blobCapturado).not.toBeNull()
      const texto = await blobCapturado!.text()
      expect(texto).toContain('Contratista')
      expect(texto).toContain('Pts Sanciones')
      expect(texto).toContain('CONSTRUCTORA ROJA SAS')
      expect(texto).toContain('"SÍ"') // columna Sancionado de la ROJA
      expect(descarga).toMatch(/^alertas-transporte-\d{4}-\d{2}-\d{2}\.csv$/)
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
      HTMLAnchorElement.prototype.click = origClick
    }
  })

  test('los pills de sector se cargan dinámicamente desde el API', async () => {
    routes['/api/alertas'] = () => alertasFixture
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText('CONSTRUCTORA ROJA SAS')

    // 'deportes' no está en la lista inicial quemada: solo puede venir del API
    await waitFor(() => expect(screen.getByText('deportes')).toBeTruthy())
    expect(screen.getByText('deportes').closest('button')).toBeTruthy()
  })

  test('el panel de análisis dimensional carga año, trimestre, entidades y departamentos', async () => {
    routes['/api/alertas/desglose'] = () => desgloseFixture
    routes['/api/alertas'] = () => alertasFixture
    render(<MemoryRouter><AlertasPage /></MemoryRouter>)
    await screen.findByText('CONSTRUCTORA ROJA SAS')

    fireEvent.click(screen.getByText('Análisis del sector'))
    await screen.findByText('Contratos por año')
    expect(screen.getByText('Por trimestre')).toBeTruthy()
    expect(screen.getByText('Top entidades contratantes (por valor)')).toBeTruthy()
    expect(screen.getByText('Distribución por departamento')).toBeTruthy()
    expect(screen.getByText(/historial completo de cada NIT/)).toBeTruthy()
  })
})

// ── ContratistasPage ─────────────────────────────────────────────────────
describe('ContratistasPage: el perfil muestra las banderas con sus etiquetas reales', () => {
  const renderPerfil = () =>
    render(
      <MemoryRouter initialEntries={['/contratistas/900123456']}>
        <Routes>
          <Route path="/contratistas/:nit" element={<ContratistasPage />} />
        </Routes>
      </MemoryRouter>,
    )

  test('cada una de las 9 banderas del scorer se traduce a su etiqueta descriptiva', async () => {
    routes['/api/contratista/900123456'] = () => perfilFixture
    renderPerfil()
    await screen.findByText('MEGACONSTRUCCIONES DEL CARIBE SAS')

    const esperado = [
      /vencidos hace más de 6 meses sin liquidar/i,
      /más de 365 días adicionados/i,
      /Tres o más contratos con extensiones/i,
      /5 o más entidades públicas distintas/i,
      /facturación menor al 50 %/i,
      /SIRI de la Procuraduría/i,
      /responsabilidad fiscal en la Contraloría/i,
      /multas en contratos públicos SECOP/i,
      /Isolation Forest/i,
    ]
    for (const re of esperado) {
      expect(screen.getByText(re)).toBeTruthy()
    }

    // Ninguna bandera quedó como código crudo sin traducir
    for (const raw of NINE_FLAGS) {
      expect(screen.queryByText(raw)).toBeNull()
    }
  })

  test('muestra NIT, score y datos de contratos del perfil', async () => {
    routes['/api/contratista/900123456'] = () => perfilFixture
    renderPerfil()
    await screen.findByText('MEGACONSTRUCCIONES DEL CARIBE SAS')

    expect(screen.getByText(/NIT: 900123456/)).toBeTruthy()
    expect(screen.getByText('95')).toBeTruthy()
    expect(screen.getByText('INVIAS')).toBeTruthy()
    const kpi = (title: string) => screen.getByText(title).closest('div[class*="rounded-xl"]')?.textContent ?? ''
    expect(kpi('Contratos SECOP II')).toContain('2')
    expect(kpi('Entidades Públicas')).toContain('2')
  })

  test('perfil sin banderas muestra el mensaje de historial limpio', async () => {
    routes['/api/contratista/900123456'] = () => ({ ...perfilFixture, flags: [], score_total: 0, nivel_riesgo: 'VERDE', sanciones: sinSanciones })
    renderPerfil()
    await screen.findByText('MEGACONSTRUCCIONES DEL CARIBE SAS')
    expect(screen.getByText(/Historial libre de banderas rojas/)).toBeTruthy()
    expect(screen.getByText(/Sin registros en Procuraduría \(SIRI\)/)).toBeTruthy()
  })

  test('los antecedentes de la API de Procuraduría se renderizan con su detalle (no hay "Fase 2")', async () => {
    routes['/api/contratista/900123456'] = () => perfilFixture
    renderPerfil()
    await screen.findByText('MEGACONSTRUCCIONES DEL CARIBE SAS')

    // El placeholder falso desapareció
    expect(screen.queryByText(/Fase 2/)).toBeNull()

    // Detalle real de cada fuente
    expect(screen.getByText(/DESTITUCION E INHABILIDAD GENERAL/)).toBeTruthy() // SIRI
    expect(screen.getByText(/ALCALDIA DE PRUEBA/)).toBeTruthy()                 // CGR
    expect(screen.getByText(/\$50\.0 M/)).toBeTruthy()                          // multa SECOP con valor
    expect(screen.getByText(/3 registro\(s\)/)).toBeTruthy()
  })

  test('si la base de sanciones no responde se informa, sin fingir que no hay registros', async () => {
    routes['/api/contratista/900123456'] = () => ({ ...perfilFixture, sanciones: null })
    renderPerfil()
    await screen.findByText('MEGACONSTRUCCIONES DEL CARIBE SAS')
    expect(screen.getByText(/No fue posible consultar la base de sanciones/)).toBeTruthy()
    expect(screen.queryByText(/Sin registros en Procuraduría/)).toBeNull()
  })
})

// ── Heartbeat de la API en el Sidebar ────────────────────────────────────
describe('Sidebar: heartbeat contra /api/health', () => {
  test('con la API respondiendo muestra el indicador en línea', async () => {
    routes['/api/health'] = () => ({ status: 'ok' })
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTitle('API en línea')).toBeTruthy())
  })

  test('con la API caída muestra el indicador de reconexión', async () => {
    failAll = true
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTitle('API sin conexión — reintentando')).toBeTruthy())
  })
})

// ── LandingPage: hero con datos vivos y fallback ─────────────────────────
describe('LandingPage: KPIs del hero', () => {
  test('con la API disponible muestra las cifras reales', async () => {
    routes['/api/contratos/kpis'] = () => ({ total: '1500000', valor_total: '50200000000000', valor_promedio: '1' })
    routes['/api/alertas/stats'] = () => ({ total: 500, rojos: 321, amarillos: 100, verdes: 79 })
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('$50.2B')).toBeTruthy())
    expect(screen.getByText('1.50M')).toBeTruthy()
    expect(screen.getByText('321')).toBeTruthy()
  })

  test('si la API falla conserva las cifras de respaldo', async () => {
    failAll = true
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('$2461B')).toBeTruthy())
    expect(screen.getByText('5.68M')).toBeTruthy()
    expect(screen.getByText('1,450')).toBeTruthy()
  })
})
