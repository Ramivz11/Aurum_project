import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ventasApi } from '../api'

const NAV = [
  { label: 'Principal', items: [
    { to: '/', icon: '🏠', label: 'Dashboard' },
    { to: '/stock', icon: '📦', label: 'Stock' },
  ]},
  { label: 'Operaciones', items: [
    { to: '/ventas', icon: '📈', label: 'Ventas', badge: 'pedidos' },
    { to: '/compras', icon: '🛒', label: 'Compras' },
    { to: '/movimientos', icon: '🔄', label: 'Movimientos' },
  ]},
  { label: 'Gestión', items: [
    { to: '/clientes', icon: '👥', label: 'Clientes' },
    { to: '/finanzas', icon: '💰', label: 'Finanzas' },
    { to: '/sucursales', icon: '🏪', label: 'Sucursales' },
  ]},
]

export default function Sidebar({ mobileOpen, onClose }) {
  const [pedidosAbiertos, setPedidosAbiertos] = useState(0)

  useEffect(() => {
    ventasApi.pedidosAbiertos().then(d => setPedidosAbiertos(d.length)).catch(() => {})
  }, [])

  return (
    <aside className={`sidebar${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="logo-text">AURUM</div>
            <div className="logo-sub">Gestión de suplementos</div>
          </div>
          <button className="sidebar-close-btn" onClick={onClose}>✕</button>
        </div>
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
                onClick={onClose}
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
    </aside>
  )
}
