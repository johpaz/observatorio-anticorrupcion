import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { dashboardApi } from '../api/client'

export default function Layout() {
  useEffect(() => {
    dashboardApi.bootstrap().catch(console.error)
  }, [])

  return (
    <div className="relative flex flex-col h-screen bg-[var(--bg-main)] text-[var(--ink)] overflow-hidden">
      <main className="flex-1 overflow-auto pb-36">
        <Outlet />
      </main>
      <Sidebar />
    </div>
  )
}
