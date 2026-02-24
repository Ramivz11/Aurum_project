import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ventasApi, sucursalesApi } from '../api'

const NAV = [
  { label: 'Principal', items: [
    { to: '/', icon: '◈', label: 'Dashboard' },
    { to: '/stock', icon: '⬡', label: 'Stock' },
  ]},
  { label: 'Operaciones', items: [
    { to: '/ventas', icon: '↑', label: 'Ventas', badge: 'pedidos' },
    { to: '/compras', icon: '↓', label: 'Compras' },
    { to: '/movimientos', icon: '⇄', label: 'Movimientos' },
  ]},
  { label: 'Gestión', items: [
    { to: '/clientes', icon: '◯', label: 'Clientes' },
    { to: '/finanzas', icon: '◇', label: 'Finanzas' },
    { to: '/sucursales', icon: '⬙', label: 'Sucursales' },
  ]},
]

export default function Sidebar() {
  const [pedidosAbiertos, setPedidosAbiertos] = useState(0)
  const [sucursales, setSucursales] = useState([])
  const [sucursalActual, setSucursalActual] = useState(null)
  const [showSucDropdown, setShowSucDropdown] = useState(false)

  useEffect(() => {
    ventasApi.pedidosAbiertos().then(d => setPedidosAbiertos(d.length)).catch(() => {})
    sucursalesApi.listar().then(d => {
      setSucursales(d)
      if (d.length > 0 && !sucursalActual) setSucursalActual(d[0])
    }).catch(() => {})
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-text">AURUM</div>
        <div className="logo-sub">Gestión de suplementos</div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(section => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge === 'pedidos' && pedidosAbiertos > 0 && (
                  <span className="nav-badge">{pedidosAbiertos}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div style={{ position: 'relative' }}>
          <button className="sucursal-selector" onClick={() => setShowSucDropdown(v => !v)}>
            <div className="sucursal-dot" />
            <span className="sucursal-name">{sucursalActual?.nombre || 'Sucursal...'}</span>
            <span className="sucursal-arrow">▾</span>
          </button>
          {showSucDropdown && (
            <div className="dropdown-menu" style={{ bottom: 'calc(100% + 6px)', top: 'auto' }}>
              {sucursales.map(s => (
                <div
                  key={s.id}
                  className="dropdown-item"
                  onClick={() => { setSucursalActual(s); setShowSucDropdown(false) }}
                >
                  {s.nombre}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
