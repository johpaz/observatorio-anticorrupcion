interface FilterOption {
  value: string
  label: string
}

interface FilterConfig {
  key: string
  label: string
  options: FilterOption[]
}

interface Props {
  filters: Record<string, string>
  filterConfig: FilterConfig[]
  onChange: (key: string, value: string) => void
  onClear: () => void
}

export default function FilterBar({ filters, filterConfig, onChange, onClear }: Props) {
  const hasActive = Object.values(filters).some(v => v !== '')

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {filterConfig.map(({ key, label, options }) => (
          <div key={key} className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              {label}
            </label>
            <select
              value={filters[key] ?? ''}
              onChange={e => onChange(key, e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              <option value="">Todos</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}

        {hasActive && (
          <button
            onClick={onClear}
            className="text-xs px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors self-end"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
