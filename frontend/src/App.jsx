import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Ventas from './pages/Ventas'
import Compras from './pages/Compras'
import SugeridorCompras from './pages/Compras/SugeridorCompras'
import ConfiguracionSistema from './pages/ConfiguracionSistema'
import { Clientes } from './pages/Clientes'
import { Movimientos } from './pages/Movimientos'
import { Finanzas } from './pages/Finanzas'
import { Sucursales } from './pages/Sucursales'
import { Categorias } from './pages/Categorias'
import MarcasConfig from './pages/MarcasConfig'
import { SucursalProvider } from './context/SucursalContext'
import { MarcaProvider } from './context/MarcaContext'
import './styles/globals.css'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <MarcaProvider>
      <SucursalProvider>
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
      </SucursalProvider>
      </MarcaProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
