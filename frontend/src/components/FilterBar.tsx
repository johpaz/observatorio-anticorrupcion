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
    <div className="card p-5">
      <div className="flex flex-wrap gap-4 items-end">
        {filterConfig.map(({ key, label, options }) => (
          <div key={key} className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider serif">
              {label}
            </label>
            <select
              value={filters[key] ?? ''}
              onChange={e => onChange(key, e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-[#004884] focus:ring-1 focus:ring-[#004884]/20 cursor-pointer transition-all shadow-sm"
            >
              <option value="" className="bg-white">Todos</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-white">{opt.label}</option>
              ))}
            </select>
          </div>
        ))}

        {hasActive && (
          <button
            onClick={onClear}
            className="text-xs px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all self-end shadow-sm"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
