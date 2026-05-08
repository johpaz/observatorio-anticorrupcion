interface Props {
  title: string
  value: string
  subtitle?: string
  color?: 'blue' | 'green' | 'amber' | 'violet' | 'red'
}

const styles = {
  blue:   { wrap: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',    dot: 'bg-blue-500' },
  green:  { wrap: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  amber:  { wrap: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',   dot: 'bg-amber-500' },
  violet: { wrap: 'bg-violet-50 border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
  red:    { wrap: 'bg-red-50 border-red-200',      text: 'text-red-700',     dot: 'bg-red-500' },
}

export default function KPICard({ title, value, subtitle, color = 'blue' }: Props) {
  const s = styles[color]
  return (
    <div className={`rounded-xl border p-5 ${s.wrap}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      </div>
      <p className={`text-2xl font-bold ${s.text} truncate`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  )
}
