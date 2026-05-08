import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ContratosPage from './pages/ContratosPage'
import ArchivosPage from './pages/ArchivosPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/contratos" replace />} />
          <Route path="contratos" element={<ContratosPage />} />
          <Route path="archivos" element={<ArchivosPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
