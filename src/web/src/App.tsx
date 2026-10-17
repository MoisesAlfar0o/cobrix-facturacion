import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { FlashProvider } from './components/Flash.tsx'
import { Layout } from './components/Layout.tsx'
import { api } from './lib/api.ts'
import { ClientesPage } from './pages/ClientesPage.tsx'
import { ConfiguracionPage } from './pages/ConfiguracionPage.tsx'
import { CorridaPage } from './pages/CorridaPage.tsx'
import { EnunciadoPage } from './pages/EnunciadoPage.tsx'
import { ExpedientePage } from './pages/Expediente.tsx'
import { ResumenPage } from './pages/ResumenPage.tsx'
import { SincronizacionPage } from './pages/SincronizacionPage.tsx'

export function App() {
  const [company, setCompany] = useState('Cobrix')

  useEffect(() => {
    let active = true
    void api.meta().then(meta => {
      if (active) setCompany(meta.company)
    }).catch(error => {
      console.error('No se pudo cargar el nombre de la empresa.', error)
    })
    return () => { active = false }
  }, [])

  return (
    <FlashProvider>
      <Layout company={company}>
        <Routes>
          <Route path="/" element={<ResumenPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/:id" element={<ExpedientePage />} />
          <Route path="/sincronizacion" element={<SincronizacionPage />} />
          <Route path="/sincronizacion/corrida/:id" element={<CorridaPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage onCompanyChange={setCompany} />} />
          <Route path="/enunciado" element={<EnunciadoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </FlashProvider>
  )
}