import { useEffect, useCallback } from 'react'
import FilterBar from '../components/FilterBar'
import KPICard from '../components/KPICard'
import BarChartComponent from '../components/charts/BarChartComponent'
import LineChartComponent from '../components/charts/LineChartComponent'
import PieChartComponent from '../components/charts/PieChartComponent'
import DataTable from '../components/DataTable'
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
    { key: 'year', label: 'Ano', options: (metadata?.years ?? []).map(y => ({ value: String(y), label: String(y) })) },
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
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Archivos Descarga SECOP II — 2025</h1>
          <p className="text-sm text-slate-500 mt-0.5">Documentos descargables desde enero 2025</p>
        </div>
        {loading && (
          <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-full animate-pulse shrink-0">
            Actualizando...
          </span>
        )}
      </div>

      <FilterBar
        filters={filters as Record<string, string>}
        filterConfig={filterConfig}
        onChange={handleChange}
        onClear={() => setFilters(ARCHIVOS_INITIAL)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Archivos" value={formatNumber(totalFiles)} color="blue" />
        <KPICard title="Tamano Total" value={formatBytes(totalSize)} color="green" />
        <KPICard title="Tamano Promedio" value={formatBytes(totalFiles > 0 ? totalSize / totalFiles : 0)} color="amber" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Archivos Subidos por Mes</h2>
        <LineChartComponent
          data={mesData} xKey="name" dualAxis
          lines={[
            { key: 'archivos', name: 'Archivos', color: '#3b82f6' },
            { key: 'tamano', name: 'Tamano (MB)', color: '#10b981', yAxisId: 'right' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Archivos por Extension</h2>
          <BarChartComponent data={extData} xKey="name" bars={[{ key: 'value', name: 'Cantidad', color: '#3b82f6' }]} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Distribucion Tamano por Extension</h2>
          <PieChartComponent data={extData.filter(d => d.tamano > 0).map(d => ({ name: d.name, value: d.tamano }))} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Entidades por Archivos</h2>
        <BarChartComponent data={entidadData} xKey="name" bars={[{ key: 'total', name: 'Archivos', color: '#8b5cf6' }]} horizontal />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Lista de Archivos</h2>
        <ArchivosTable data={data.list} page={page} onPageChange={setPage} loading={loading} />
      </div>
    </div>
  )
}

function ArchivosTable({ data, page, onPageChange, loading }: {
  data: any[]; page: number; onPageChange: (p: number) => void; loading: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Entidad', 'Archivo', 'Ext.', 'Tamano', 'Fecha Carga', 'Descarga'].map(h => (
                <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">Cargando...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">Sin resultados</td></tr>
            ) : data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 text-slate-700 max-w-[180px] truncate">{row.entidad ?? '-'}</td>
                <td className="px-3 py-2.5 text-slate-700 max-w-[160px] truncate">{row.nombre_archivo ?? '-'}</td>
                <td className="px-3 py-2.5">
                  <span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-600 font-mono uppercase">
                    {row.extensi_n ?? '-'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{formatBytes(row.tamanno_archivo)}</td>
                <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.fecha_carga)}</td>
                <td className="px-3 py-2.5">
                  {row.url_descarga_documento?.url ? (
                    <a href={row.url_descarga_documento.url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs">
                      Descargar
                    </a>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-500">Pagina {page} · {data.length} registros</span>
        <div className="flex gap-2">
          <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1 || loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50">Anterior</button>
          <button onClick={() => onPageChange(page + 1)} disabled={data.length < 20 || loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50">Siguiente</button>
        </div>
      </div>
    </div>
  )
}
