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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 transition-opacity duration-450 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ transitionDuration: '450ms' }}
    >
      {/* grid de fondo sutil */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#00ff41 1px, transparent 1px), linear-gradient(90deg, #00ff41 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative flex flex-col items-center gap-8">
        {/* Logo con glow neon */}
        <img
          src="/logo_col50.png"
          alt="Colombia 5.0"
          className="h-20 w-auto logo-glow select-none"
        />

        {/* Subtítulo */}
        <div className="text-center space-y-1">
          <p className="text-white text-base font-semibold tracking-[0.2em] uppercase">
            SECOP II Dashboard
          </p>
          <p className="text-slate-500 text-xs tracking-widest uppercase">
            Contratos · Archivos · Colombia
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="w-56 flex flex-col gap-2">
          <div className="h-[3px] w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full loading-bar-shine" />
          </div>
          <p className="text-slate-600 text-[10px] text-center tracking-widest uppercase">
            Cargando datos...
          </p>
        </div>
      </div>

      {/* Destellos de esquina */}
      <span
        className="absolute top-6 left-6 w-1.5 h-1.5 rounded-full bg-[#00ff41]"
        style={{ boxShadow: '0 0 8px #00ff41, 0 0 16px #00ff41' }}
      />
      <span
        className="absolute bottom-6 right-6 w-1.5 h-1.5 rounded-full bg-[#00ff41]"
        style={{ boxShadow: '0 0 8px #00ff41, 0 0 16px #00ff41' }}
      />
    </div>
  )
}
