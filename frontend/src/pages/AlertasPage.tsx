import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import KPICard from '../components/KPICard'
import SemaforoCard from '../components/SemaforoCard'
import { alertasApi } from '../api/client'
import type { ScoreResult } from '../api/client'
import { useAlertasStore, alertasCacheKey } from '../store/useAlertasStore'

const SECTORES = ['Transporte', 'Vivienda, Ciudad y Territorio', 'Salud y Protección Social', 'Educación Nacional', 'defensa', 'Servicio Público']
const TABS = ['TODOS', 'ROJO', 'AMARILLO', 'VERDE'] as const
type Tab = typeof TABS[number]

function ScoreBar({ score, nivel }: { score: number; nivel: string }) {
  const color =
    nivel === 'ROJO' ? 'bg-rose-600' :
    nivel === 'AMARILLO' ? 'bg-amber-600' : 'bg-emerald-600'
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="font-mono text-xs font-semibold w-6 text-right text-slate-700">{score}</span>
    </div>
  )
}

function RiskRow({ s, rank, onClick }: { s: ScoreResult; rank: number; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="hover:bg-slate-50/50 cursor-pointer transition-colors border-b border-slate-100">
      <td className="px-4 py-3 text-slate-500 text-xs w-10">{rank}</td>
      <td className="px-4 py-3 text-slate-800 font-semibold max-w-[200px] truncate">{s.nombre}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.nit}</td>
      <td className="px-4 py-3"><ScoreBar score={s.score_total} nivel={s.nivel_riesgo} /></td>
      <td className="px-4 py-3"><SemaforoCard nivel={s.nivel_riesgo} score={s.score_total} size="sm" showScore={false} /></td>
      <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px] truncate font-medium">{s.flags.join(' · ') || '—'}</td>
    </tr>
  )
}

export default function AlertasPage() {
  const { filters, loading, data, setFilters, setLoading, setData, getFromCache, saveToCache, clearCache } = useAlertasStore()
  const [activeTab, setActiveTab] = useState<Tab>('TODOS')
  const navigate = useNavigate()

  const loadData = useCallback(async () => {
    const key = alertasCacheKey(filters)
    const cached = getFromCache(key)
    if (cached) { setData(cached); return }
    setLoading(true)
    try {
      const d = await alertasApi.get({ sector: filters.sector, limit: '30' })
      setData(d)
      saveToCache(key, d)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filters, getFromCache, saveToCache, setData, setLoading])

  useEffect(() => { loadData() }, [loadData])

  const allScores = data?.scores ?? []
  const filteredScores = activeTab === 'TODOS'
    ? allScores
    : allScores.filter(s => s.nivel_riesgo === activeTab)

  const rojoCount    = allScores.filter(s => s.nivel_riesgo === 'ROJO').length
  const amarilloCount = allScores.filter(s => s.nivel_riesgo === 'AMARILLO').length
  const verdeCount   = allScores.filter(s => s.nivel_riesgo === 'VERDE').length

  const handleRefresh = () => {
    clearCache(alertasCacheKey(filters))
    loadData()
  }

  return (
    <div className="p-8 space-y-6 rise text-slate-800 bg-[var(--bg-main)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="serif text-2xl font-bold tracking-tight text-[#004884]">Alertas de Riesgo de Corrupción</h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">Clasificación por semáforo de contratistas — Sector {filters.sector}</p>
        </div>
        {loading && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3.5 py-1.5 rounded-full animate-pulse shrink-0 font-semibold shadow-sm">
            Calculando scores de riesgo...
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filters.sector}
          onChange={e => { setFilters({ sector: e.target.value }); setActiveTab('TODOS') }}
          className="text-sm border border-slate-200 rounded-lg px-3.5 py-2 bg-white text-slate-850 focus:outline-none focus:border-[#004884] focus:ring-1 focus:ring-[#004884]/20 cursor-pointer shadow-sm"
        >
          {SECTORES.map(s => <option key={s} value={s} className="bg-white">{s}</option>)}
        </select>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="btn-ghost"
        >
          Actualizar
        </button>
        {data && (
          <span className="text-xs text-slate-500 font-semibold tracking-wide uppercase">
            {data.cached ? 'Desde caché' : 'Recalculado'} ·{' '}
            {new Date(data.generated_at).toLocaleTimeString('es-CO')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KPICard title="Alto Riesgo (ROJO)" value={String(rojoCount)} color="red" subtitle="contratistas de alta criticidad" />
        <KPICard title="Riesgo Medio (AMARILLO)" value={String(amarilloCount)} color="amber" subtitle="contratistas bajo monitoreo" />
        <KPICard title="Bajo Riesgo (VERDE)" value={String(verdeCount)} color="green" subtitle="contratistas sin alertas" />
      </div>

      <div className="flex gap-1 border-b border-slate-200 mt-4">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#004884] text-[#004884] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
            {tab !== 'TODOS' && (
              <span className="ml-1.5 text-xs opacity-60">
                ({tab === 'ROJO' ? rojoCount : tab === 'AMARILLO' ? amarilloCount : verdeCount})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden border border-slate-200 bg-white">
        {loading && filteredScores.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <div className="text-4xl mb-4 animate-bounce">⏳</div>
            <p className="text-sm font-bold text-slate-800">Calculando scores de riesgo...</p>
            <p className="text-xs mt-1.5 text-slate-500 font-medium">La primera ejecución con descarga puede tardar unos segundos</p>
          </div>
        ) : filteredScores.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm font-medium">
            Sin contratistas registrados bajo este nivel de riesgo
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase w-10">#</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Contratista</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">NIT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Score</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Nivel</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredScores.map((s, i) => (
                  <RiskRow
                    key={s.nit}
                    s={s}
                    rank={i + 1}
                    onClick={() => navigate(`/contratistas/${encodeURIComponent(s.nit)}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
