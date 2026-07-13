import { useEffect, useState } from 'react'

interface Props {
  onDone: () => void
  minDuration?: number
}

export default function LoadingScreen({ onDone, minDuration = 2200 }: Props) {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const exit = setTimeout(() => {
      setFadeOut(true)
      setTimeout(onDone, 450)
    }, minDuration)

    return () => clearTimeout(exit)
  }, [onDone, minDuration])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f4f7fa] transition-opacity duration-450 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ transitionDuration: '450ms' }}
    >
      {/* grid de fondo sutil */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0, 72, 132, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 72, 132, 0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative flex flex-col items-center gap-8 bg-white/80 p-10 rounded-2xl border border-slate-200/60 shadow-xl backdrop-blur-md max-w-sm w-full mx-4">
        {/* Marca tricolor */}
        <div className="flex items-center gap-4 select-none">
          <div className="flex flex-col w-3 h-16 rounded-full overflow-hidden shadow-[0_0_14px_rgba(254,200,47,0.35)]">
            <div className="flex-1 bg-[#FEC82F]" />
            <div className="flex-1 bg-[#004884]" />
            <div className="flex-1 bg-[#CE1126]" />
          </div>
          <div className="flex flex-col leading-tight text-left">
            <span className="text-[#002D58] text-xl font-black tracking-tight uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Observatorio
            </span>
            <span className="text-[#004884] text-sm font-bold tracking-[0.18em] uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Anticorrupción
            </span>
          </div>
        </div>

        {/* Subtítulo */}
        <div className="text-center space-y-1.5">
          <p className="text-slate-500 text-xs tracking-wider uppercase font-semibold">
            de Colombia · SECOP II
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="w-full flex flex-col gap-2.5">
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div className="h-full rounded-full loading-bar-shine" />
          </div>
          <p className="text-slate-500 text-[10px] text-center tracking-widest uppercase font-semibold">
            Conectando con datos.gov.co...
          </p>
        </div>
      </div>

      {/* Detalles tricolor sutiles en los bordes extremos del loader */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FEC82F] via-[#004884] to-[#F03C3B]" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FEC82F] via-[#004884] to-[#F03C3B]" />
    </div>
  )
}
