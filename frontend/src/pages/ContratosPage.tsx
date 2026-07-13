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
import { useSeo } from '../utils/useSeo'

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
  useSeo('Contratos SECOP II', 'Explora y filtra contratos electrónicos de SECOP II en tiempo real: valores, entidades, sectores y estados de la contratación pública en Colombia.')
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
    { key: 'year', label: 'Año', options: (metadata?.years ?? []).map(y => ({ value: String(y), label: String(y) })) },
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
    <div className="p-8 space-y-6 rise text-slate-800 bg-[var(--bg-main)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="serif text-2xl font-bold tracking-tight text-[#004884]">Contratos Electrónicos SECOP II</h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">Contratos adjudicados y registrados en la plataforma oficial datos.gov.co</p>
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
        onClear={() => setFilters(CONTRATOS_INITIAL)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KPICard title="Total Contratos" value={formatNumber(Number(data.kpis?.total ?? 0))} color="blue" />
        <KPICard title="Valor Total Adjudicado" value={formatCOP(Number(data.kpis?.valor_total ?? 0))} color="green" />
        <KPICard title="Valor Promedio" value={formatCOP(Number(data.kpis?.valor_promedio ?? 0))} color="amber" />
      </div>

      <div className="card p-5 border border-slate-200">
        <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Evolución Mensual del Gasto</h2>
        <LineChartComponent
          data={mesData} xKey="name" dualAxis
          lines={[
            { key: 'contratos', name: 'Contratos', color: '#004884' },
            { key: 'valor', name: 'Valor (M COP)', color: '#137752', yAxisId: 'right' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 border border-slate-200">
          <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Top Sectores por Monto</h2>
          <BarChartComponent data={sectorData} xKey="name" bars={[{ key: 'valor', name: 'Valor COP', color: '#004884' }]} horizontal />
        </div>
        <div className="card p-5 border border-slate-200">
          <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Tipos de Contrato</h2>
          <PieChartComponent data={tipoData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 border border-slate-200">
          <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Distribución por Departamento</h2>
          <BarChartComponent data={deptoData} xKey="name" bars={[{ key: 'valor', name: 'Valor COP', color: '#c69400' }]} horizontal />
        </div>
        <div className="card p-5 border border-slate-200">
          <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Estado Actual de Procesos</h2>
          <PieChartComponent data={estadoData} />
        </div>
      </div>

      <div className="card p-5 border border-slate-200">
        <h2 className="text-xs font-bold text-slate-600 mb-4 serif uppercase tracking-wider">Lista de Contratos Filtrados</h2>
        <DataTable data={data.list} columns={TABLE_COLS} page={page} onPageChange={setPage} loading={loading} />
      </div>
    </div>
  )
}
