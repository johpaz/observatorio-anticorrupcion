import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
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
