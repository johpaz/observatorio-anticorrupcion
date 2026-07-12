interface Column {
  key: string
  label: string
  format?: (value: any) => string
}

interface Props {
  data: any[]
  columns: Column[]
  page: number
  onPageChange: (page: number) => void
  loading?: boolean
  pageSize?: number
}

export default function DataTable({ data, columns, page, onPageChange, loading, pageSize = 20 }: Props) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-500 text-sm">
                  <span className="inline-block animate-pulse">Cargando registros...</span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-500 text-sm">
                  Sin resultados para los filtros seleccionados
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-slate-700 max-w-[240px] truncate font-medium">
                      {col.format ? col.format(row[col.key]) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-500 font-medium">
          Página {page} · {data.length} registros mostrados
        </span>
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
            disabled={data.length < pageSize || loading}
            className="text-xs px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
