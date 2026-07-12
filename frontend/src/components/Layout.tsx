import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

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
