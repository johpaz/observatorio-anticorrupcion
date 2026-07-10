import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Inicio',
    sub: 'Cómo funciona',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/contratos',
    label: 'Contratos',
    sub: 'Contratos electronicos',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: '/archivos',
    label: 'Archivos 2025',
    sub: 'Documentos descargables',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    to: '/alertas',
    label: 'Alertas Riesgo',
    sub: 'Semaforo de corrupcion',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  {
    to: '/contratistas',
    label: 'Contratistas',
    sub: 'Busqueda por NIT',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    to: '/chat',
    label: 'Chat IA',
    sub: 'Consulta en lenguaje natural',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-slate-900 text-white flex flex-col h-full shrink-0">
      <div className="px-5 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-6 bg-blue-500 rounded-full" />
          <span className="text-base font-bold tracking-tight">SECOP II</span>
        </div>
        <p className="text-xs text-slate-400 pl-4">Dashboard Interactivo</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={(item as any).end}
            className={({ isActive }) =>
              `flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-sm group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="mt-0.5 shrink-0">{item.icon}</span>
            <div>
              <div className="font-medium leading-tight">{item.label}</div>
              <div className="text-[11px] opacity-60 mt-0.5">{item.sub}</div>
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-700/60">
        <p className="text-[11px] text-slate-500">Fuente: datos.gov.co</p>
        <p className="text-[11px] text-slate-600 mt-0.5">SECOP II · Colombia</p>
      </div>
    </aside>
  )
}
