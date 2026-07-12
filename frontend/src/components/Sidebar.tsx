import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Inicio',
    sub: 'Cómo funciona',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/contratos',
    label: 'Contratos',
    sub: 'Historial general',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: '/archivos',
    label: 'Archivos 2025',
    sub: 'Documentos oficiales',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    to: '/alertas',
    label: 'Alertas',
    sub: 'Semáforo de control',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  {
    to: '/contratistas',
    label: 'Contratistas',
    sub: 'Búsqueda por NIT',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    to: '/chat',
    label: 'Asistente IA',
    sub: 'Análisis conversacional',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
      <nav
        className="flex items-center gap-2 px-6 py-3 rounded-[26px] select-none"
        style={{
          background: 'rgba(0, 30, 70, 0.92)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.30), 0 1px 0 rgba(255,255,255,0.06) inset',
        }}
      >
        {/* Logo Institucional */}
        <div className="flex items-center gap-2.5 pr-4 mr-1 border-r border-white/10 shrink-0">
          {/* Bandera tricolor vertical */}
          <div className="flex flex-col w-2 h-8 rounded-full overflow-hidden shadow-[0_0_10px_rgba(254,200,47,0.3)]">
            <div className="flex-1 bg-[#FEC82F]" />
            <div className="flex-1 bg-[#004884]" />
            <div className="flex-1 bg-[#c52727]" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-black text-white tracking-widest uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              SECOP II
            </span>
            <span className="text-[8px] font-semibold text-slate-400 tracking-wider uppercase">
              Observatorio
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={(item as any).end}
              className="group relative flex flex-col items-center"
            >
              {({ isActive }) => (
                <>
                  {/* Tooltip flotante */}
                  <div
                    className="absolute bottom-[calc(100%+14px)] left-1/2 -translate-x-1/2 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <div
                      className="flex flex-col items-center px-3 py-2 rounded-xl text-center"
                      style={{
                        background: 'rgba(5, 15, 35, 0.96)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                      }}
                    >
                      <span className="text-[11px] font-bold text-white">{item.label}</span>
                      <span className="text-[9px] text-slate-400 font-medium">{item.sub}</span>
                    </div>
                    {/* Arrow */}
                    <div className="flex justify-center">
                      <div
                        className="w-2 h-2 rotate-45 -mt-1"
                        style={{
                          background: 'rgba(5, 15, 35, 0.96)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderLeft: 'none',
                          borderTop: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Icon pill */}
                  <div
                    className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-white/12 text-[#FEC82F] scale-105'
                        : 'text-slate-300 hover:text-white hover:bg-white/6 hover:-translate-y-1'
                    }`}
                  >
                    {item.icon}
                    <span
                      className={`text-[9px] font-bold tracking-wide uppercase transition-all ${
                        isActive ? 'text-[#FEC82F] opacity-100' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                      style={{ fontFamily: 'Work Sans, sans-serif' }}
                    >
                      {item.label.split(' ')[0]}
                    </span>
                  </div>

                  {/* Active dot */}
                  {isActive && (
                    <span
                      className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-[#FEC82F]"
                      style={{ boxShadow: '0 0 8px 2px rgba(254,200,47,0.6)' }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
