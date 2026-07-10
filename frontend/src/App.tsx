import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import ChatPage from './pages/ChatPage'
import ContratosPage from './pages/ContratosPage'
import ArchivosPage from './pages/ArchivosPage'
import AlertasPage from './pages/AlertasPage'
import ContratistasPage from './pages/ContratistasPage'
import LoadingScreen from './components/LoadingScreen'

export default function App() {
  const [booting, setBooting] = useState(true)

  return (
    <>
      {booting && <LoadingScreen onDone={() => setBooting(false)} />}

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="contratos" element={<ContratosPage />} />
            <Route path="archivos" element={<ArchivosPage />} />
            <Route path="alertas" element={<AlertasPage />} />
            <Route path="contratistas" element={<ContratistasPage />} />
            <Route path="contratistas/:nit" element={<ContratistasPage />} />
            <Route path="chat" element={<ChatPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}
