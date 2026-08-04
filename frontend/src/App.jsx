import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import { Loading } from './components/ui'
import { SucursalProvider } from './context/SucursalContext'
import { MarcaProvider } from './context/MarcaContext'
import './styles/globals.css'

// Cada página se descarga recién cuando se navega a ella: en móvil el bundle
// inicial queda chico y la primera carga es mucho más rápida.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Stock = lazy(() => import('./pages/Stock'))
const Ventas = lazy(() => import('./pages/Ventas'))
const Compras = lazy(() => import('./pages/Compras'))
const SugeridorCompras = lazy(() => import('./pages/Compras/SugeridorCompras'))
const ConfiguracionSistema = lazy(() => import('./pages/ConfiguracionSistema'))
const Clientes = lazy(() => import('./pages/Clientes').then(m => ({ default: m.Clientes })))
const Movimientos = lazy(() => import('./pages/Movimientos').then(m => ({ default: m.Movimientos })))
const Finanzas = lazy(() => import('./pages/Finanzas').then(m => ({ default: m.Finanzas })))
const Sucursales = lazy(() => import('./pages/Sucursales').then(m => ({ default: m.Sucursales })))
const Categorias = lazy(() => import('./pages/Categorias').then(m => ({ default: m.Categorias })))
const MarcasConfig = lazy(() => import('./pages/MarcasConfig'))

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <MarcaProvider>
      <SucursalProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="stock" element={<Stock />} />
              <Route path="ventas" element={<Ventas />} />
              <Route path="compras" element={<Compras />} />
              <Route path="movimientos" element={<Movimientos />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="finanzas" element={<Finanzas />} />
              <Route path="sucursales" element={<Sucursales />} />
              <Route path="categorias" element={<Categorias />} />
              <Route path="config/marcas" element={<MarcasConfig />} />
              <Route path="config/sistema" element={<ConfiguracionSistema />} />
              <Route path="sugeridor-compras" element={<SugeridorCompras />} />
            </Route>
          </Routes>
        </Suspense>
      </SucursalProvider>
      </MarcaProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
