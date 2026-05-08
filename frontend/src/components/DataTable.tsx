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
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-400 text-sm">
                  Cargando...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-400 text-sm">
                  Sin resultados para los filtros seleccionados
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-3 py-2.5 text-slate-700 max-w-[220px] truncate">
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
        <span className="text-xs text-slate-500">
          Pagina {page} · {data.length} registros
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            Anterior
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={data.length < pageSize || loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
