import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

// El bootstrap del dashboard lo pide cada página que lo usa (Inicio, Contratos, Archivos,
// Alertas) a través de una promesa compartida. Antes el Layout lo precargaba siempre, aunque
// la página fuera Contratistas o el Asistente, que no lo necesitan.
export default function Layout() {
  return (
    <div className="relative flex flex-col h-screen bg-[var(--bg-main)] text-[var(--ink)] overflow-hidden">
      <main className="flex-1 overflow-auto pb-36">
        <Outlet />
      </main>
      <Sidebar />
    </div>
  )
}
