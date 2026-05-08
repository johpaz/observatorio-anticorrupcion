import { useEffect, useCallback } from 'react'
import FilterBar from '../components/FilterBar'
import KPICard from '../components/KPICard'
import BarChartComponent from '../components/charts/BarChartComponent'
import LineChartComponent from '../components/charts/LineChartComponent'
import PieChartComponent from '../components/charts/PieChartComponent'
import DataTable from '../components/DataTable'
import { contratosApi } from '../api/client'
import { formatCOP, formatNumber, formatDate } from '../utils/formatters'
import { useContratosStore, CONTRATOS_INITIAL, cacheKey } from '../store/useContratosStore'

const TABLE_COLS = [
  { key: 'nombre_entidad', label: 'Entidad' },
  { key: 'proveedor_adjudicado', label: 'Proveedor' },
  { key: 'tipo_de_contrato', label: 'Tipo' },
  { key: 'modalidad_de_contratacion', label: 'Modalidad' },
  { key: 'valor_del_contrato', label: 'Valor', format: (v: string) => formatCOP(parseFloat(v)) },
  { key: 'estado_contrato', label: 'Estado' },
  { key: 'fecha_de_firma', label: 'Firma', format: formatDate },
]

export default function ContratosPage() {
  const {
    metadata, metadataLoaded,
    filters, page, loading, data,
    setMetadata, setFilters, setPage, setLoading, setData,
    getFromCache, saveToCache,
  } = useContratosStore()

  // Metadata: solo una vez en toda la sesion
  useEffect(() => {
    if (metadataLoaded) return
    contratosApi.metadata().then(setMetadata).catch(console.error)
  }, [metadataLoaded, setMetadata])

  const loadData = useCallback(async () => {
    const key = cacheKey(filters, page)

    // Devolver datos del cache si estan frescos
    const cached = getFromCache(key)
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    try {
      const f = filters as Record<string, string>
      const [kpis, porSector, porTipo, porMes, porDepto, porEstado, list] = await Promise.all([
        contratosApi.kpis(f),
        contratosApi.porSector(f),
        contratosApi.porTipo(f),
        contratosApi.porMes({ year: filters.year }),
        contratosApi.porDepartamento(f),
        contratosApi.porEstado(f),
        contratosApi.list({ ...f, page: String(page), limit: '20' }),
      ])
      const newData = { kpis, porSector, porTipo, porMes, porDepto, porEstado, list }
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
    { key: 'departamento', label: 'Departamento', options: (metadata?.departamentos ?? []).map(d => ({ value: d, label: d })) },
    { key: 'sector', label: 'Sector', options: (metadata?.sectores ?? []).map(s => ({ value: s, label: s })) },
    { key: 'tipo_de_contrato', label: 'Tipo', options: (metadata?.tipos ?? []).map(t => ({ value: t, label: t })) },
    { key: 'estado_contrato', label: 'Estado', options: (metadata?.estados ?? []).map(e => ({ value: e, label: e })) },
  ]

  const sectorData = data.porSector.map(r => ({
    name: (r.sector ?? 'N/A').substring(0, 28),
    valor: Number(r.valor_total),
    contratos: Number(r.total),
  }))

  const tipoData = data.porTipo.map(r => ({
    name: r.tipo_de_contrato ?? 'N/A',
    value: Number(r.total),
  }))

  const mesData = data.porMes.map(r => ({
    name: (r.mes ?? '').substring(0, 7),
    contratos: Number(r.total),
    valor: Number(r.valor_total) / 1e6,
  }))

  const deptoData = data.porDepto.map(r => ({
    name: (r.departamento ?? 'N/A').substring(0, 28),
    valor: Number(r.valor_total),
    contratos: Number(r.total),
  }))

  const estadoData = data.porEstado.map(r => ({
    name: r.estado_contrato ?? 'N/A',
    value: Number(r.total),
  }))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Contratos Electronicos SECOP II</h1>
          <p className="text-sm text-slate-500 mt-0.5">Contratos adjudicados — datos.gov.co</p>
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
        onClear={() => setFilters(CONTRATOS_INITIAL)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Contratos" value={formatNumber(Number(data.kpis?.total ?? 0))} color="blue" />
        <KPICard title="Valor Total" value={formatCOP(Number(data.kpis?.valor_total ?? 0))} color="green" />
        <KPICard title="Valor Promedio" value={formatCOP(Number(data.kpis?.valor_promedio ?? 0))} color="amber" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Evolucion Mensual</h2>
        <LineChartComponent
          data={mesData} xKey="name" dualAxis
          lines={[
            { key: 'contratos', name: 'Contratos', color: '#3b82f6' },
            { key: 'valor', name: 'Valor (M COP)', color: '#10b981', yAxisId: 'right' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Sectores por Valor</h2>
          <BarChartComponent data={sectorData} xKey="name" bars={[{ key: 'valor', name: 'Valor COP', color: '#3b82f6' }]} horizontal />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Tipos de Contrato</h2>
          <PieChartComponent data={tipoData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Departamentos por Valor</h2>
          <BarChartComponent data={deptoData} xKey="name" bars={[{ key: 'valor', name: 'Valor COP', color: '#8b5cf6' }]} horizontal />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Estado de Contratos</h2>
          <PieChartComponent data={estadoData} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Lista de Contratos</h2>
        <DataTable data={data.list} columns={TABLE_COLS} page={page} onPageChange={setPage} loading={loading} />
      </div>
    </div>
  )
}
