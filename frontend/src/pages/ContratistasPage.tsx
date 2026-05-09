import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SemaforoCard from '../components/SemaforoCard'
import KPICard from '../components/KPICard'
import DataTable from '../components/DataTable'
import { contratistaApi } from '../api/client'
import type { ContratistaResponse } from '../api/client'
import { useContratistasStore } from '../store/useContratistasStore'
import { formatCOP, formatDate } from '../utils/formatters'

const FLAG_LABELS: Record<string, string> = {
  TERMINACION_UNILATERAL_O_INCUMPLIMIENTO: 'Contrato terminado unilateralmente o liquidado con incumplimiento (+30 pts)',
  VENCIDOS_SIN_LIQUIDAR: 'Contratos vencidos hace mas de 6 meses sin liquidar (+25 pts c/u)',
  CONCENTRACION_ENTIDADES: 'Contratos en 5 o mas entidades distintas (+10 pts)',
  MULTIPLES_ADICIONES: 'Tres o mas adiciones o prorrogas registradas (+20 pts)',
}

const CONTRATO_COLS = [
  { key: 'entidad', label: 'Entidad' },
  { key: 'valor', label: 'Valor', format: (v: number) => formatCOP(v ?? 0) },
  { key: 'estado', label: 'Estado' },
  { key: 'fecha_inicio', label: 'Inicio', format: formatDate },
  { key: 'fecha_fin', label: 'Fin', format: formatDate },
  { key: 'sector', label: 'Sector' },
]

export default function ContratistasPage() {
  const { nit: nitParam } = useParams<{ nit?: string }>()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState(nitParam ?? '')
  const { loading, setLoading, getProfile, saveProfile } = useContratistasStore()
  const [profile, setProfile] = useState<ContratistaResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSearchInput(nitParam ?? '')
    if (!nitParam) { setProfile(null); setError(null); return }
    const cached = getProfile(nitParam)
    if (cached) { setProfile(cached); setError(null); return }
    setLoading(true)
    setError(null)
    setProfile(null)
    contratistaApi.get(nitParam)
      .then(d => { setProfile(d); saveProfile(nitParam, d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nitParam])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchInput.trim()
    if (!trimmed) return
    navigate(`/contratistas/${encodeURIComponent(trimmed)}`)
  }

  const totalValor = profile?.contratos.reduce((s, c) => s + (c.valor ?? 0), 0) ?? 0
  const entidades = new Set(profile?.contratos.map(c => c.entidad).filter(Boolean)).size

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Perfil de Contratista</h1>
        <p className="text-sm text-slate-500 mt-0.5">Consulta historial y nivel de riesgo por NIT</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Ingrese NIT del contratista (ej. 900073223)"
          className="flex-1 text-sm border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Consultar
        </button>
      </form>

      {loading && (
        <div className="py-12 text-center text-slate-400">
          <div className="text-3xl mb-2">⏳</div>
          <p className="text-sm">Consultando SECOP II y calculando score...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          Error al consultar el NIT: {error}
        </div>
      )}

      {!loading && profile && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{profile.nombre}</h2>
              <p className="font-mono text-sm text-slate-500 mt-0.5">NIT: {profile.nit}</p>
              <p className="text-xs text-slate-400 mt-1">Sector principal: {profile.sector ?? 'No determinado'}</p>
            </div>
            <SemaforoCard nivel={profile.nivel_riesgo} score={profile.score_total} size="lg" />
          </div>

          {profile.flags.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Alertas Detectadas</h3>
              {profile.flags.map(flag => {
                const key = Object.keys(FLAG_LABELS).find(k => flag.startsWith(k)) ?? flag
                return (
                  <div key={flag} className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 font-bold mt-0.5 shrink-0">!</span>
                    <span className="text-slate-600">{FLAG_LABELS[key] ?? flag}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm">
              Sin alertas detectadas en SECOP II. Historial limpio.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard title="Contratos SECOP II" value={String(profile.contratos.length)} color="blue" subtitle="ultimos 20 registrados" />
            <KPICard title="Valor Total" value={formatCOP(totalValor)} color="green" />
            <KPICard title="Entidades Distintas" value={String(entidades)} color="amber" />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Historial de Contratos</h3>
            <DataTable
              data={profile.contratos}
              columns={CONTRATO_COLS}
              page={1}
              onPageChange={() => {}}
              loading={loading}
              pageSize={999}
            />
          </div>

          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-slate-500 text-sm flex items-center gap-3">
            <span className="text-xl shrink-0">🔒</span>
            <span>Sanciones PACO (Procuraduria, Contraloria, Fiscalia): Disponible en Fase 2</span>
          </div>

          <p className="text-xs text-slate-400 text-right">
            Calculado: {formatDate(profile.calculado_at)} · {profile.cached ? 'Desde cache' : 'Recalculado'}
          </p>
        </>
      )}

      {!loading && !profile && !error && !nitParam && (
        <div className="py-16 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-sm text-slate-400">Ingrese un NIT para consultar el perfil de riesgo</p>
          <p className="text-xs text-slate-300 mt-1">Ej: 900073223 · 800125697 · 830002397</p>
        </div>
      )}
    </div>
  )
}
