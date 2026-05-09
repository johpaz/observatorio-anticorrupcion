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
    nivel === 'ROJO' ? 'bg-red-500' :
    nivel === 'AMARILLO' ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="font-mono text-xs font-semibold w-6 text-right">{score}</span>
    </div>
  )
}

function RiskRow({ s, rank, onClick }: { s: ScoreResult; rank: number; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-100">
      <td className="px-3 py-2.5 text-slate-400 text-xs w-10">{rank}</td>
      <td className="px-3 py-2.5 text-slate-700 font-medium max-w-[180px] truncate">{s.nombre}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{s.nit}</td>
      <td className="px-3 py-2.5"><ScoreBar score={s.score_total} nivel={s.nivel_riesgo} /></td>
      <td className="px-3 py-2.5"><SemaforoCard nivel={s.nivel_riesgo} score={s.score_total} size="sm" showScore={false} /></td>
      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[200px] truncate">{s.flags.join(' · ') || '—'}</td>
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
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Alertas de Riesgo de Corrupcion</h1>
          <p className="text-sm text-slate-500 mt-0.5">Semaforo por contratista — Sector {filters.sector}</p>
        </div>
        {loading && (
          <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-full animate-pulse shrink-0">
            Calculando scores...
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filters.sector}
          onChange={e => { setFilters({ sector: e.target.value }); setActiveTab('TODOS') }}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-40"
        >
          Actualizar
        </button>
        {data && (
          <span className="text-xs text-slate-400">
            {data.cached ? 'Desde cache' : 'Recalculado'} ·{' '}
            {new Date(data.generated_at).toLocaleTimeString('es-CO')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Alto Riesgo (ROJO)" value={String(rojoCount)} color="red" subtitle="contratistas detectados" />
        <KPICard title="Riesgo Medio (AMARILLO)" value={String(amarilloCount)} color="amber" subtitle="contratistas detectados" />
        <KPICard title="Bajo Riesgo (VERDE)" value={String(verdeCount)} color="green" subtitle="contratistas detectados" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading && filteredScores.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-sm font-medium">Calculando scores de riesgo...</p>
            <p className="text-xs mt-1 text-slate-300">Primera carga puede tardar 30-60 segundos</p>
          </div>
        ) : filteredScores.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Sin contratistas para los filtros seleccionados
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase w-10">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Contratista</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">NIT</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Score</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Nivel</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Alertas</th>
              </tr>
            </thead>
            <tbody>
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
        )}
      </div>
    </div>
  )
}
