interface Props {
  nivel: 'ROJO' | 'AMARILLO' | 'VERDE'
  score: number
  size?: 'sm' | 'md' | 'lg'
  showScore?: boolean
}

const NIVEL_STYLES = {
  ROJO:     { ring: 'ring-red-400',    bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'ALTO RIESGO' },
  AMARILLO: { ring: 'ring-amber-400',  bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'RIESGO MEDIO' },
  VERDE:    { ring: 'ring-emerald-400',bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500',label: 'BAJO RIESGO' },
}

const SIZE_CLS = {
  sm: 'px-2 py-1 text-[10px] gap-1',
  md: 'px-3 py-1.5 text-xs gap-1.5',
  lg: 'px-4 py-2 text-sm gap-2',
}

const DOT_SIZE = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }

export default function SemaforoCard({ nivel, score, size = 'md', showScore = true }: Props) {
  const s = NIVEL_STYLES[nivel]
  return (
    <span className={`inline-flex items-center rounded-full ring-2 font-semibold shrink-0 ${s.ring} ${s.bg} ${s.text} ${SIZE_CLS[size]}`}>
      <span className={`rounded-full shrink-0 ${s.dot} ${DOT_SIZE[size]}`} />
      {s.label}
      {showScore && <span className="opacity-70 font-mono ml-1">{score}</span>}
    </span>
  )
}
