interface Props {
  title: string
  value: string
  subtitle?: string
  color?: 'blue' | 'green' | 'amber' | 'violet' | 'red'
}

const styles = {
  blue:   { wrap: 'bg-blue-50/40 border-blue-200/60 shadow-[0_4px_20px_rgba(0,72,132,0.03)]',   text: 'text-[#004884]',    dot: 'bg-[#004884]' },
  green:  { wrap: 'bg-emerald-50/40 border-emerald-200/60 shadow-[0_4px_20px_rgba(19,119,82,0.03)]', text: 'text-emerald-700', dot: 'bg-emerald-600' },
  amber:  { wrap: 'bg-amber-50/40 border-amber-200/60 shadow-[0_4px_20px_rgba(198,148,0,0.03)]',  text: 'text-amber-700',   dot: 'bg-amber-600' },
  violet: { wrap: 'bg-indigo-50/40 border-indigo-200/60 shadow-[0_4px_20px_rgba(99,102,241,0.03)]', text: 'text-indigo-700', dot: 'bg-indigo-600' },
  red:    { wrap: 'bg-rose-50/40 border-rose-200/60 shadow-[0_4px_20px_rgba(197,39,39,0.03)]',      text: 'text-rose-700',     dot: 'bg-rose-600' },
}

export default function KPICard({ title, value, subtitle, color = 'blue' }: Props) {
  const s = styles[color]
  return (
    <div className={`rounded-xl border p-5 backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:border-slate-300 ${s.wrap}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
        <p className="text-[10.5px] tracking-wider uppercase font-semibold text-slate-500 serif">{title}</p>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${s.text} truncate`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-600 mt-1 font-medium">{subtitle}</p>}
    </div>
  )
}
