interface Props {
  nivel: 'ROJO' | 'AMARILLO' | 'VERDE'
  score: number
  size?: 'sm' | 'md' | 'lg'
  showScore?: boolean
}

const NIVEL_STYLES = {
  ROJO:     { ring: 'ring-rose-200 border-rose-200',    bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-600 pulse-indicator',    label: 'ALTO RIESGO' },
  AMARILLO: { ring: 'ring-amber-200 border-amber-200',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-600',  label: 'RIESGO MEDIO' },
  VERDE:    { ring: 'ring-emerald-200 border-emerald-200',bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-600',label: 'BAJO RIESGO' },
}

const SIZE_CLS = {
  sm: 'px-2.5 py-0.5 text-[10px] gap-1.5',
  md: 'px-3 py-1 text-xs gap-2',
  lg: 'px-4.5 py-1.5 text-sm gap-2.5',
}

const DOT_SIZE = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }

export default function SemaforoCard({ nivel, score, size = 'md', showScore = true }: Props) {
  const s = NIVEL_STYLES[nivel]
  return (
    <span className={`inline-flex items-center rounded-full ring-1 border font-bold shrink-0 ${s.ring} ${s.bg} ${s.text} ${SIZE_CLS[size]}`}>
      <span className={`rounded-full shrink-0 ${s.dot} ${DOT_SIZE[size]}`} />
      {s.label}
      {showScore && <span className="opacity-80 font-mono ml-1 font-semibold">{score}</span>}
    </span>
  )
}
