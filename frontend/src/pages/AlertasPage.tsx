import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SemaforoCard from '../components/SemaforoCard'
import BarChartComponent from '../components/charts/BarChartComponent'
import PieChartComponent from '../components/charts/PieChartComponent'
import { alertasApi } from '../api/client'
import type { ScoreResult, AlertasDesglose } from '../api/client'
import { useAlertasStore, alertasCacheKey } from '../store/useAlertasStore'
import { useSeo } from '../utils/useSeo'
import { flagShort, flagLabel, scoreBreakdown, CATEGORIAS } from '../utils/flags'
import { formatCOP } from '../utils/formatters'

// Lista inicial mientras responde /api/alertas/sectores (y respaldo si falla)
const SECTORES_INICIALES = ['Transporte', 'Vivienda, Ciudad y Territorio', 'Salud y Protección Social', 'Educación Nacional', 'defensa', 'Servicio Público']

type Nivel = 'ROJO' | 'AMARILLO' | 'VERDE'
type NivelFiltro = 'TODOS' | Nivel

const NIVEL_UI: Record<Nivel, { titulo: string; sub: string; rail: string; num: string }> = {
  ROJO:     { titulo: 'Alto Riesgo (ROJO)',      sub: 'alta criticidad — revisar ya', rail: 'bg-[#c52727]', num: 'text-[#c52727]' },
  AMARILLO: { titulo: 'Riesgo Medio (AMARILLO)', sub: 'bajo monitoreo periódico',     rail: 'bg-[#c69400]', num: 'text-[#c69400]' },
  VERDE:    { titulo: 'Bajo Riesgo (VERDE)',     sub: 'sin alertas significativas',   rail: 'bg-[#137752]', num: 'text-[#137752]' },
}

/* ── Loader centrado de página (barra tricolor de marca) ─────────── */
function CenteredLoader({ sector }: { sector: string }) {
  return (
    <div className="min-h-[65vh] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center rise">
        <div className="flex flex-col w-2.5 h-14 rounded-full overflow-hidden shadow-[0_0_14px_rgba(254,200,47,0.35)]">
          <div className="flex-1 bg-[#FEC82F]" />
          <div className="flex-1 bg-[#004884]" />
          <div className="flex-1 bg-[#CE1126]" />
        </div>
        <div>
          <p className="serif text-sm font-bold tracking-[0.14em] uppercase text-[#004884]">
            Calculando scores de riesgo
          </p>
          <p className="text-xs text-slate-500 mt-1.5 font-medium">
            Primera carga del sector {sector}: SECOP II · Procuraduría · Isolation Forest
          </p>
        </div>
        <div className="h-1.5 w-56 bg-slate-200 rounded-full overflow-hidden shadow-inner">
          <div className="h-full rounded-full loading-bar-shine" />
        </div>
      </div>
    </div>
  )
}

/* ── Barra de score apilada por categoría ─────────────────────────── */
function ScoreStackedBar({ flags, score }: { flags: string[]; score: number }) {
  const parts = scoreBreakdown(flags)
  const total = Math.max(parts.reduce((a, p) => a + p.puntos, 0), score, 1)
  const tooltip = parts.map(p => `${p.label}: ${p.puntos} pts`).join(' · ') || 'Sin banderas'
  return (
    <div className="flex items-center gap-2.5" title={tooltip}>
      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden flex">
        {parts.map(p => (
          <div key={p.categoria} className="h-full" style={{ width: `${(p.puntos / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <span className="num text-xs font-semibold w-7 text-right text-slate-700">{score}</span>
    </div>
  )
}

/* ── Chips de banderas legibles ───────────────────────────────────── */
function FlagChips({ flags }: { flags: string[] }) {
  if (flags.length === 0) return <span className="text-xs text-slate-400">—</span>
  const visibles = flags.slice(0, 3)
  const resto = flags.slice(3)
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visibles.map(f => {
        const cat = scoreBreakdown([f])[0]
        const color = cat?.color ?? '#4a5568'
        return (
          <span
            key={f}
            title={flagLabel(f)}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap"
            style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}
          >
            {flagShort(f)}
          </span>
        )
      })}
      {resto.length > 0 && (
        <span
          className="text-[10.5px] font-bold text-slate-500"
          title={resto.map(f => flagLabel(f)).join('\n')}
        >
          +{resto.length}
        </span>
      )}
    </div>
  )
}

/* ── Tarjeta-filtro del semáforo ──────────────────────────────────── */
function NivelFilterCard({ nivel, count, total, active, onClick }: {
  nivel: Nivel; count: number; total: number; active: boolean; onClick: () => void
}) {
  const ui = NIVEL_UI[nivel]
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`card relative overflow-hidden text-left p-5 pl-6 w-full transition-all ${
        active ? 'ring-2 ring-[#004884] shadow-lg -translate-y-0.5' : ''
      }`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${ui.rail}`} />
      <div className="flex items-center justify-between gap-2">
        <p className="smcaps">{ui.titulo}</p>
        {active && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#004884] bg-[#004884]/10 px-2 py-0.5 rounded-full">
            Filtro activo
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className={`num text-3xl font-bold ${ui.num}`}>{count}</span>
        <span className="num text-xs text-slate-400">{pct}%</span>
      </div>
      <p className="text-xs text-slate-500 mt-1 font-medium">{ui.sub}</p>
    </button>
  )
}

/* ── Fila de la tabla con expansión de desglose ───────────────────── */
function RiskRow({ s, rank, expanded, onToggle, onNavigate }: {
  s: ScoreResult; rank: number; expanded: boolean; onToggle: () => void; onNavigate: () => void
}) {
  const parts = scoreBreakdown(s.flags)
  return (
    <>
      <tr onClick={onNavigate} className="hover:bg-[#004884]/[0.03] cursor-pointer transition-colors border-b border-slate-100">
        <td className="px-4 py-3 num text-slate-400 text-xs w-10">{rank}</td>
        <td className="px-4 py-3 max-w-[240px]">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-800 font-semibold truncate">{s.nombre}</span>
            {s.sancionado_paco && (
              <span title="Registra sanciones oficiales (Procuraduría / CGR / multas SECOP)" className="shrink-0 text-sm" aria-label="Sancionado">
                ⚖️
              </span>
            )}
          </div>
          <div className="num text-[11px] text-slate-500 mt-0.5">NIT {s.nit}</div>
        </td>
        <td className="px-4 py-3"><ScoreStackedBar flags={s.flags} score={s.score_total} /></td>
        <td className="px-4 py-3"><SemaforoCard nivel={s.nivel_riesgo} score={s.score_total} size="sm" showScore={false} /></td>
        <td className="px-4 py-3"><FlagChips flags={s.flags} /></td>
        <td className="px-2 py-3 w-10 text-center">
          {s.flags.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onToggle() }}
              aria-label={expanded ? 'Ocultar desglose de puntos' : 'Ver desglose de puntos'}
              aria-expanded={expanded}
              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:border-[#004884] hover:text-[#004884] transition-colors inline-flex items-center justify-center"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[#f8fafd] border-b border-slate-100">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 max-w-4xl">
              {parts.map(p => (
                <div key={p.categoria}>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
                    <span className="smcaps flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ background: p.color }} />
                      {p.label}
                    </span>
                    <span className="num text-xs font-bold" style={{ color: p.color }}>{p.puntos} pts</span>
                  </div>
                  {p.flags.map(f => (
                    <div key={f.raw} className="flex items-start justify-between gap-4 text-xs text-slate-600 py-1">
                      <span className="leading-snug">{f.label}</span>
                      <span className="num font-semibold shrink-0">+{f.puntos}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 pt-2 border-t border-slate-200 max-w-4xl">
              <span className="smcaps mr-3">Score total</span>
              <span className="num text-sm font-bold text-[#004884]">{s.score_total}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Panel de análisis dimensional del sector ─────────────────────── */
function AnalysisPanel({ sector }: { sector: string }) {
  const [open, setOpen] = useState(false)
  const [desglose, setDesglose] = useState<AlertasDesglose | null>(null)
  const [cargando, setCargando] = useState(false)
  const [anio, setAnio] = useState<string>('')

  useEffect(() => {
    if (!open) return
    let alive = true
    setCargando(true)
    setDesglose(null)
    alertasApi.desglose(sector)
      .then(d => {
        if (!alive) return
        setDesglose(d)
        const anios = [...new Set(d.por_anio.map(a => a.anio))]
        setAnio(anios[anios.length - 1] ?? '')
      })
      .catch(err => console.error(err))
      .finally(() => alive && setCargando(false))
    return () => { alive = false }
  }, [open, sector])

  const porAnio = useMemo(() => {
    if (!desglose) return []
    const map = new Map<string, { anio: string; contratos: number; valor: number }>()
    for (const r of desglose.por_anio) {
      const e = map.get(r.anio) ?? { anio: r.anio, contratos: 0, valor: 0 }
      e.contratos += r.contratos
      e.valor += r.valor
      map.set(r.anio, e)
    }
    return [...map.values()].sort((a, b) => a.anio.localeCompare(b.anio))
  }, [desglose])

  const porTrimestre = useMemo(() => {
    if (!desglose || !anio) return []
    const base = [1, 2, 3, 4].map(t => ({ trimestre: `T${t}`, contratos: 0 }))
    for (const r of desglose.por_anio) {
      if (r.anio === anio && r.trimestre >= 1 && r.trimestre <= 4) base[r.trimestre - 1].contratos += r.contratos
    }
    return base
  }, [desglose, anio])

  const anios = useMemo(() => [...new Set(porAnio.map(a => a.anio))], [porAnio])

  return (
    <div className="card border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#004884]/[0.02] transition-colors"
      >
        <div>
          <span className="serif text-sm font-bold text-[#004884] uppercase tracking-wide">Análisis del sector</span>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Contratos de los contratistas puntuados por año, trimestre, entidad y departamento
          </p>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-6 py-5 rise">
          {cargando && (
            <div className="py-10 flex justify-center">
              <div className="h-1.5 w-40 bg-slate-200 rounded-full overflow-hidden"><div className="h-full loading-bar-shine" /></div>
            </div>
          )}
          {!cargando && desglose && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
                <div>
                  <p className="smcaps mb-3">Contratos por año</p>
                  <BarChartComponent
                    data={porAnio}
                    xKey="anio"
                    bars={[{ key: 'contratos', name: 'Contratos', color: '#004884' }]}
                    height={220}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="smcaps">Por trimestre</p>
                    <select
                      value={anio}
                      onChange={e => setAnio(e.target.value)}
                      aria-label="Año del desglose trimestral"
                      className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 cursor-pointer"
                    >
                      {anios.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <BarChartComponent
                    data={porTrimestre}
                    xKey="trimestre"
                    bars={[{ key: 'contratos', name: `Contratos ${anio}`, color: '#c69400' }]}
                    height={220}
                  />
                </div>
                <div>
                  <p className="smcaps mb-3">Top entidades contratantes (por valor)</p>
                  <BarChartComponent
                    data={desglose.por_entidad.map(e => ({ ...e, entidad: e.entidad.length > 28 ? e.entidad.slice(0, 27) + '…' : e.entidad }))}
                    xKey="entidad"
                    bars={[{ key: 'valor', name: 'Valor (COP)', color: '#1e509d' }]}
                    horizontal
                    height={220}
                  />
                </div>
                <div>
                  <p className="smcaps mb-3">Distribución por departamento</p>
                  <PieChartComponent
                    data={desglose.por_departamento.map(d => ({ name: d.departamento, value: d.contratos }))}
                    height={240}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-6 pt-3 border-t border-slate-100 font-medium">
                El análisis describe los contratos de los contratistas puntuados del sector. El score de riesgo siempre
                evalúa el historial completo de cada NIT, no un período específico.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Exportación CSV (para la auditoría) ──────────────────────────── */
function exportCsv(scores: ScoreResult[], sector: string) {
  const cats = ['contratos', 'ejecucion', 'sanciones', 'anomalia'] as const
  const header = ['#', 'Contratista', 'NIT', 'Score', 'Nivel', 'Pts Contratos', 'Pts Ejecución', 'Pts Sanciones', 'Pts Anomalía', 'Sancionado', 'Banderas']
  const body = scores.map((s, i) => {
    const parts = scoreBreakdown(s.flags)
    const pts = Object.fromEntries(parts.map(p => [p.categoria, p.puntos]))
    return [
      i + 1, s.nombre, s.nit, s.score_total, s.nivel_riesgo,
      ...cats.map(c => pts[c] ?? 0),
      s.sancionado_paco ? 'SÍ' : 'NO',
      s.flags.join(' | '),
    ]
  })
  const csv = '\ufeff' + [header, ...body]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `alertas-${sector.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Página ───────────────────────────────────────────────────────── */
export default function AlertasPage() {
  useSeo('Alertas de Riesgo en Contratación Pública', 'Alertas de riesgo de corrupción en contratos públicos colombianos: banderas rojas, sanciones y anomalías detectadas con IA sobre datos de SECOP II.')
  const { filters, loading, data, setFilters, setLoading, setData, getFromCache, saveToCache, clearCache } = useAlertasStore()
  const [nivelFiltro, setNivelFiltro] = useState<NivelFiltro>('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [sectores, setSectores] = useState<string[]>(SECTORES_INICIALES)
  const navigate = useNavigate()

  // Sectores reales del dataset (ordenados por volumen); si falla queda el respaldo
  useEffect(() => {
    let alive = true
    alertasApi.sectores()
      .then(s => { if (alive && s.length > 0) setSectores(s) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  // Sectores con datos previos que ya programaron su auto-actualización (una vez por montaje)
  const staleRetried = useRef(new Set<string>())

  const loadData = useCallback(async () => {
    const key = alertasCacheKey(filters)
    const cached = getFromCache(key)
    if (cached) { setData(cached); return }
    setLoading(true)
    try {
      const d = await alertasApi.get({ sector: filters.sector, limit: '30' })
      setData(d)
      saveToCache(key, d)
      // Datos previos: el API ya está recalculando en segundo plano — recoger
      // el resultado fresco automáticamente en ~30s (una sola vez por sector)
      if (d.stale && !staleRetried.current.has(key)) {
        staleRetried.current.add(key)
        setTimeout(() => { clearCache(key); loadData() }, 30_000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filters, getFromCache, saveToCache, clearCache, setData, setLoading])

  useEffect(() => { loadData() }, [loadData])

  // ¿Los datos visibles corresponden al sector seleccionado?
  const dataMatchesSector = data?.sector === filters.sector
  const allScores = dataMatchesSector ? data?.scores ?? [] : []

  const counts: Record<Nivel, number> = {
    ROJO:     allScores.filter(s => s.nivel_riesgo === 'ROJO').length,
    AMARILLO: allScores.filter(s => s.nivel_riesgo === 'AMARILLO').length,
    VERDE:    allScores.filter(s => s.nivel_riesgo === 'VERDE').length,
  }

  const filteredScores = useMemo(() => {
    let rows = nivelFiltro === 'TODOS' ? allScores : allScores.filter(s => s.nivel_riesgo === nivelFiltro)
    const q = busqueda.trim().toLowerCase()
    if (q) rows = rows.filter(s => s.nombre.toLowerCase().includes(q) || s.nit.includes(q))
    return rows
  }, [allScores, nivelFiltro, busqueda])

  const valorSector = useMemo(() => allScores.length, [allScores])

  const cambiarSector = (sector: string) => {
    setFilters({ sector })
    setNivelFiltro('TODOS')
    setExpandido(null)
  }

  const handleRefresh = () => {
    clearCache(alertasCacheKey(filters))
    loadData()
  }

  const toggleNivel = (nivel: Nivel) =>
    setNivelFiltro(prev => (prev === nivel ? 'TODOS' : nivel))

  const cargaInicial = loading && !dataMatchesSector

  return (
    <div className="p-8 space-y-6 rise text-slate-800 bg-[var(--bg-main)]">
      {/* Encabezado editorial */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="smcaps text-[#c52727] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c52727] pulse-indicator inline-block" />
            Vigilancia activa · Semáforo de riesgo
          </p>
          <h1 className="serif text-2xl font-bold tracking-tight text-[#004884] mt-1.5">Alertas de Riesgo de Corrupción</h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            {valorSector > 0 ? `${valorSector} contratistas evaluados` : 'Contratistas'} — Sector {filters.sector}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          {data && dataMatchesSector && (
            <span className="num text-[11px] text-slate-500 uppercase tracking-wide font-semibold">
              {data.cached ? 'Desde caché' : 'Recalculado'} · {new Date(data.generated_at).toLocaleTimeString('es-CO')}
            </span>
          )}
          {data?.stale && dataMatchesSector && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-semibold animate-pulse">
              Actualizando en segundo plano…
            </span>
          )}
        </div>
      </div>

      {/* Pills de sector */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sector">
        {sectores.map(s => {
          const activo = filters.sector === s
          return (
            <button
              key={s}
              onClick={() => cambiarSector(s)}
              aria-pressed={activo}
              className={`serif text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-full border transition-all ${
                activo
                  ? 'bg-[#004884] text-white border-[#004884] shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#004884]/50 hover:text-[#004884]'
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>

      {cargaInicial ? (
        <CenteredLoader sector={filters.sector} />
      ) : (
        <>
          {/* KPIs-filtro del semáforo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {(['ROJO', 'AMARILLO', 'VERDE'] as const).map(nivel => (
              <NivelFilterCard
                key={nivel}
                nivel={nivel}
                count={counts[nivel]}
                total={allScores.length}
                active={nivelFiltro === nivel}
                onClick={() => toggleNivel(nivel)}
              />
            ))}
          </div>

          {/* Toolbar: búsqueda + acciones */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o NIT…"
                aria-label="Buscar por nombre o NIT"
                className="field pl-10"
              />
            </div>
            <button onClick={handleRefresh} disabled={loading} className="btn-ghost">
              Actualizar
            </button>
            <button
              onClick={() => exportCsv(filteredScores, filters.sector)}
              disabled={filteredScores.length === 0}
              className="btn-ghost"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Exportar CSV
            </button>
            {nivelFiltro !== 'TODOS' && (
              <button onClick={() => setNivelFiltro('TODOS')} className="text-xs font-semibold text-[#004884] hover:underline">
                Quitar filtro {nivelFiltro} ✕
              </button>
            )}
          </div>

          {/* Tabla con overlay de refresco */}
          <div className="relative">
            {loading && dataMatchesSector && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-xl flex items-center justify-center" role="status">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-1.5 w-40 bg-slate-200 rounded-full overflow-hidden"><div className="h-full loading-bar-shine" /></div>
                  <span className="serif text-[11px] font-bold uppercase tracking-widest text-[#004884]">Recalculando…</span>
                </div>
              </div>
            )}
            <div className="card overflow-hidden border border-slate-200 bg-white">
              {filteredScores.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm font-medium">
                  {busqueda
                    ? <>Sin resultados para «{busqueda}» en este sector</>
                    : 'Sin contratistas registrados bajo este nivel de riesgo'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase w-10">#</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Contratista</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Score discriminado</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Nivel</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Banderas</th>
                        <th className="px-2 py-3 w-10" aria-label="Desglose" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredScores.map((s, i) => (
                        <RiskRow
                          key={s.nit}
                          s={s}
                          rank={i + 1}
                          expanded={expandido === s.nit}
                          onToggle={() => setExpandido(prev => (prev === s.nit ? null : s.nit))}
                          onNavigate={() => navigate(`/contratistas/${encodeURIComponent(s.nit)}`)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Leyenda de categorías del score */}
          <div className="flex items-center gap-5 flex-wrap px-1">
            <span className="smcaps">Origen de los puntos:</span>
            {Object.values(CATEGORIAS).map(c => (
              <span key={c.label} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c.color }} />
                {c.label}
              </span>
            ))}
          </div>

          {/* Análisis dimensional */}
          <AnalysisPanel sector={filters.sector} />
        </>
      )}
    </div>
  )
}
