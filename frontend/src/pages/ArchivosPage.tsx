import { useEffect, useCallback } from 'react'
import FilterBar from '../components/FilterBar'
import KPICard from '../components/KPICard'
import BarChartComponent from '../components/charts/BarChartComponent'
import LineChartComponent from '../components/charts/LineChartComponent'
import PieChartComponent from '../components/charts/PieChartComponent'
import { archivosApi } from '../api/client'
import { formatBytes, formatNumber, formatDate } from '../utils/formatters'
import { useArchivosStore, ARCHIVOS_INITIAL, cacheKey } from '../store/useArchivosStore'

export default function ArchivosPage() {
  const {
    metadata, metadataLoaded,
    filters, page, loading, data,
    setMetadata, setFilters, setPage, setLoading, setData,
    getFromCache, saveToCache,
  } = useArchivosStore()

  // Metadata: solo una vez en toda la sesion
  useEffect(() => {
    if (metadataLoaded) return
    archivosApi.metadata().then(setMetadata).catch(console.error)
  }, [metadataLoaded, setMetadata])

  const loadData = useCallback(async () => {
    const key = cacheKey(filters, page)

    const cached = getFromCache(key)
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    try {
      const f = filters as Record<string, string>
      const [kpis, porExtension, porMes, porEntidad, list] = await Promise.all([
        archivosApi.kpis(f),
        archivosApi.porExtension(f),
        archivosApi.porMes({ year: filters.year }),
        archivosApi.porEntidad(f),
        archivosApi.list({ ...f, page: String(page), limit: '20' }),
      ])
      const newData = { kpis, porExtension, porMes, porEntidad, list }
      setData(newData)
      saveToCache(key, newData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filters, page, getFromCache, saveToCache, setData, setLoading])

  useEffect(() => { loadData() }, [loadData])

  const handleChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const filterConfig = [
    { key: 'year', label: 'Año', options: (metadata?.years ?? []).map(y => ({ value: String(y), label: String(y) })) },
    { key: 'quarter', label: 'Trimestre', options: [
      { value: '1', label: 'Q1 Ene-Mar' }, { value: '2', label: 'Q2 Abr-Jun' },
      { value: '3', label: 'Q3 Jul-Sep' }, { value: '4', label: 'Q4 Oct-Dic' },
    ]},
    { key: 'entidad', label: 'Entidad', options: (metadata?.entidades ?? []).slice(0, 150).map(e => ({ value: e, label: e })) },
  ]

  const extData = data.porExtension.map(r => ({
    name: (r.extension ?? 'N/A').toUpperCase(),
    value: Number(r.total),
    tamano: Number(r.tamanno_total),
  }))

  const mesData = data.porMes.map(r => ({
    name: (r.mes ?? '').substring(0, 7),
    archivos: Number(r.total),
    tamano: Number(r.tamanno_total) / 1e6,
  }))

  const entidadData = data.porEntidad.map(r => ({
    name: (r.entidad ?? 'N/A').substring(0, 28),
    total: Number(r.total),
    tamano: Number(r.tamanno_total),
  }))

  const totalSize = Number(data.kpis?.tamanno_total ?? 0)
  const totalFiles = Number(data.kpis?.total ?? 0)

  return (
    <div className="p-8 space-y-6 rise text-slate-800 bg-[var(--bg-main)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="serif text-2xl font-bold tracking-tight text-[#004884]">Archivos Descarga SECOP II — 2025</h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">Documentos y pliegos cargados en procesos contractuales desde enero 2025</p>
        </div>
        {loading && (
          <span className="text-xs bg-[#004884]/15 text-[#004884] border border-[#004884]/20 px-3.5 py-1.5 rounded-full animate-pulse shrink-0 font-semibold shadow-sm">
            Actualizando datos...
          </span>
        )}
      </div>

      <FilterBar
        filters={filters as Record<string, string>}
        filterConfig={filterConfig}
        onChange={handleChange}
        onClear={() => setFilters(ARCHIVOS_INITIAL)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KPICard title="Total Archivos Registrados" value={formatNumber(totalFiles)} color="blue" />
        <KPICard title="Tamaño Total en Disco" value={formatBytes(totalSize)} color="green" />
        <KPICard title="Tamaño Promedio" value={formatBytes(totalFiles > 0 ? totalSize / totalFiles : 0)} color="amber" />
      </div>

      <div className="card p-5 border border-slate-200">
        <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Archivos Subidos Mensualmente</h2>
        <LineChartComponent
          data={mesData} xKey="name" dualAxis
          lines={[
            { key: 'archivos', name: 'Archivos', color: '#004884' },
            { key: 'tamano', name: 'Tamaño (MB)', color: '#137752', yAxisId: 'right' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 border border-slate-200">
          <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Archivos por Extensión</h2>
          <BarChartComponent data={extData} xKey="name" bars={[{ key: 'value', name: 'Cantidad', color: '#004884' }]} />
        </div>
        <div className="card p-5 border border-slate-200">
          <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Distribución Tamaño por Extensión</h2>
          <PieChartComponent data={extData.filter(d => d.tamano > 0).map(d => ({ name: d.name, value: d.tamano }))} />
        </div>
      </div>

      <div className="card p-5 border border-slate-200">
        <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Top Entidades con Mayor Carga de Archivos</h2>
        <BarChartComponent data={entidadData} xKey="name" bars={[{ key: 'total', name: 'Archivos', color: '#c69400' }]} horizontal />
      </div>

      <div className="card p-5 border border-slate-200">
        <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Lista y Descarga de Documentos</h2>
        <ArchivosTable data={data.list} page={page} onPageChange={setPage} loading={loading} />
      </div>
    </div>
  )
}

function ArchivosTable({ data, page, onPageChange, loading }: {
  data: any[]; page: number; onPageChange: (p: number) => void; loading: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Entidad', 'Archivo', 'Ext.', 'Tamaño', 'Fecha Carga', 'Descarga'].map(h => (
                <th key={h} className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                  <span className="inline-block animate-pulse">Cargando archivos...</span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">Sin resultados</td>
              </tr>
            ) : data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate font-medium">{row.entidad ?? '-'}</td>
                <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate font-medium">{row.nombre_archivo ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700 font-mono font-semibold uppercase border border-slate-200">
                    {row.extensi_n ?? '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-medium">{formatBytes(row.tamanno_archivo)}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-medium">{formatDate(row.fecha_carga)}</td>
                <td className="px-4 py-3">
                  {row.url_descarga_documento?.url ? (
                    <a href={row.url_descarga_documento.url} target="_blank" rel="noopener noreferrer"
                      className="text-[#004884] hover:text-[#003366] font-semibold text-xs hover:underline inline-flex items-center gap-1">
                      Descargar
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-500 font-medium">Página {page} · {data.length} registros mostrados</span>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            className="text-xs px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            Anterior
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={data.length < 20 || loading}
            className="text-xs px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
