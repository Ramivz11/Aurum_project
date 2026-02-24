import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Ventas from './pages/Ventas'
import Compras from './pages/Compras'
import { Clientes } from './pages/Clientes'
import { Movimientos } from './pages/Movimientos'
import { Finanzas } from './pages/Finanzas'
import { Sucursales } from './pages/Sucursales'
import './styles/globals.css'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
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
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
