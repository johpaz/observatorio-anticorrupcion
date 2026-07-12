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
  VENCIDOS_SIN_LIQUIDAR: 'Contratos vencidos hace más de 6 meses sin liquidar (+25 pts c/u)',
  CONCENTRACION_ENTIDADES: 'Contratos en 5 o más entidades públicas distintas en el mismo sector (+10 pts)',
  MULTIPLES_ADICIONES: 'Tres o más adiciones o prórrogas registradas (+20 pts)',
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
    <div className="p-8 space-y-6 rise text-slate-800 bg-[var(--bg-main)]">
      <div>
        <h1 className="serif text-2xl font-bold tracking-tight text-[#004884]">Perfil de Contratista</h1>
        <p className="text-sm text-slate-600 mt-1 font-medium">Consulta el historial analítico y el nivel de riesgo global por NIT</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Ingrese NIT del contratista (ej. 900073223)"
          className="field flex-1 shadow-sm"
        />
        <button
          type="submit"
          className="btn-accent shrink-0"
        >
          <span>Consultar</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </form>

      {loading && (
        <div className="py-20 text-center text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="text-4xl mb-4 animate-bounce">⏳</div>
          <p className="text-sm font-bold text-slate-800">Consultando SECOP II...</p>
          <p className="text-xs mt-1 text-slate-500 font-medium">Calculando alertas y evaluando score de anomalía</p>
        </div>
      )}

      {error && !loading && (
        <div className="border border-rose-200 bg-rose-50 text-rose-700 rounded-xl p-5 text-sm font-semibold shadow-sm">
          Error al consultar el contratista solicitado: {error}
        </div>
      )}

      {!loading && profile && (
        <>
          <div className="card p-6 flex items-center justify-between gap-4 border border-slate-200 bg-white">
            <div>
              <h2 className="serif text-xl font-extrabold text-[#004884]">{profile.nombre}</h2>
              <p className="font-mono text-xs text-slate-500 mt-1">NIT: {profile.nit}</p>
              <p className="text-xs text-slate-600 mt-1 font-semibold uppercase tracking-wide">Sector Principal: <span className="text-[#004884]">{profile.sector ?? 'No Determinado'}</span></p>
            </div>
            <SemaforoCard nivel={profile.nivel_riesgo} score={profile.score_total} size="lg" />
          </div>

          {profile.flags.length > 0 ? (
            <div className="card p-5 space-y-3 border border-rose-200 bg-rose-50/30">
              <h3 className="text-xs font-bold text-rose-800 serif uppercase tracking-wider">Alertas y Banderas Rojas Detectadas</h3>
              <div className="space-y-2">
                {profile.flags.map(flag => {
                  const key = Object.keys(FLAG_LABELS).find(k => flag.startsWith(k)) ?? flag
                  return (
                    <div key={flag} className="flex items-start gap-2.5 text-xs sm:text-sm">
                      <span className="text-rose-600 font-bold shrink-0 text-sm">⚠️</span>
                      <span className="text-slate-700 font-medium">{FLAG_LABELS[key] ?? flag}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl p-5 text-sm font-semibold flex items-center gap-2 shadow-sm">
              <span>🛡️</span>
              <span>Sin alertas detectadas en la base de datos de SECOP II. Historial libre de banderas rojas.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <KPICard title="Contratos SECOP II" value={String(profile.contratos.length)} color="blue" subtitle="últimos 20 contratos registrados" />
            <KPICard title="Monto Total Contratado" value={formatCOP(totalValor)} color="green" />
            <KPICard title="Entidades Públicas" value={String(entidades)} color="amber" subtitle="entidades distintas atendidas" />
          </div>

          <div className="card p-5 border border-slate-200 bg-white">
            <h3 className="text-xs font-bold text-slate-650 mb-4 serif uppercase tracking-wider">Historial de Contratación Registrado</h3>
            <DataTable
              data={profile.contratos}
              columns={CONTRATO_COLS}
              page={1}
              onPageChange={() => {}}
              loading={loading}
              pageSize={999}
            />
          </div>

          <div className="border border-dashed border-slate-200 bg-slate-50 rounded-xl p-5 text-slate-600 text-xs sm:text-sm flex items-center gap-3">
            <span className="text-xl shrink-0">🔒</span>
            <span className="font-semibold text-slate-500">
              Sanciones PACO complejas (Procuraduría General, Contraloría, Fiscalía): <span className="text-[#004884]">Disponible en Fase 2</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 text-right font-medium">
            Último Cálculo: {formatDate(profile.calculado_at)} · {profile.cached ? 'Desde caché local' : 'Descargado recientemente'}
          </p>
        </>
      )}

      {!loading && !profile && !error && !nitParam && (
        <div className="py-24 text-center">
          <div className="text-5xl mb-4 animate-pulse">🔍</div>
          <p className="text-sm text-slate-600 font-bold">Ingrese un NIT para consultar el perfil de riesgo del contratista</p>
          <p className="text-xs text-slate-500 mt-2 font-mono">Ejemplos válidos: 900073223 · 800125697 · 830002397</p>
        </div>
      )}
    </div>
  )
}
