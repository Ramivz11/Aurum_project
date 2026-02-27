import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ventasApi, sucursalesApi } from '../api'
import { useSucursal } from '../context/SucursalContext'
import { useToast } from './Toast'

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
    { to: '/categorias', icon: '⊞', label: 'Categorías' },
  ]},
]

const BOTTOM_NAV = [
  { to: '/', icon: '◈', label: 'Inicio' },
  { to: '/ventas', icon: '↑', label: 'Ventas', badge: 'pedidos' },
  { to: '/stock', icon: '⬡', label: 'Stock' },
  { to: '/compras', icon: '↓', label: 'Compras' },
]

function ModalSucursal({ sucursal, onClose, onSaved }) {
  const toast = useToast()
  const [nombre, setNombre] = useState(sucursal?.nombre || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!nombre.trim()) return toast('El nombre es obligatorio', 'error')
    setSaving(true)
    try {
      if (sucursal) {
        await sucursalesApi.actualizar(sucursal.id, { nombre: nombre.trim() })
        toast('Sucursal actualizada')
      } else {
        await sucursalesApi.crear({ nombre: nombre.trim() })
        toast('Sucursal creada')
      }
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{sucursal ? 'Editar sucursal' : 'Nueva sucursal'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input
              className="form-input"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Centro, Norte, Sur..."
              onKeyDown={e => e.key === 'Enter' && save()}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NavContent({ onItemClick, pedidosAbiertos, sucursalesOpen, setSucursalesOpen, setEditando, sucursales, sucursalActual, setSucursalActual }) {
  return (
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
              onClick={onItemClick}
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

      <div className="sucursal-section">
        <div className="sucursal-header" onClick={() => setSucursalesOpen(v => !v)}>
          <span className="sucursal-title">Sucursales</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={e => { e.stopPropagation(); setEditando('nuevo') }}
              className="sucursal-add-btn"
              title="Nueva sucursal"
            >+</button>
            <span className={`sucursal-toggle${sucursalesOpen ? ' open' : ''}`}>▶</span>
          </div>
        </div>
        {sucursalesOpen && sucursales.map(s => (
          <div
            key={s.id}
            className={`nav-item${sucursalActual?.id === s.id ? ' active' : ''}`}
            style={{ cursor: 'pointer', paddingRight: 6 }}
            onClick={() => { setSucursalActual(s); onItemClick?.() }}
          >
            <span className="nav-icon" style={{ fontSize: 7 }}>●</span>
            <span style={{ flex: 1, fontSize: 13 }}>{s.nombre}</span>
            {sucursalActual?.id === s.id && (
              <button
                onClick={e => { e.stopPropagation(); setEditando(s) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', borderRadius: 4 }}
                title="Editar"
              >✎</button>
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}

export default function Sidebar() {
  const [pedidosAbiertos, setPedidosAbiertos] = useState(0)
  const [sucursalesOpen, setSucursalesOpen] = useState(true)
  const [editando, setEditando] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { sucursales, sucursalActual, setSucursalActual, cargarSucursales } = useSucursal()
  const location = useLocation()

  useEffect(() => {
    ventasApi.pedidosAbiertos().then(d => setPedidosAbiertos(d.length)).catch(() => {})
  }, [])

  // Cerrar drawer al cambiar de ruta
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  const navProps = {
    pedidosAbiertos, sucursalesOpen, setSucursalesOpen,
    setEditando, sucursales, sucursalActual, setSucursalActual,
  }

  return (
    <>
      {/* ── SIDEBAR DESKTOP ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">AURUM</div>
          <div className="logo-sub">Gestión de suplementos</div>
        </div>
        <NavContent {...navProps} />
      </aside>

      {/* ── MOBILE HEADER (position: fixed, fuera del flujo del sidebar) ── */}
      <header className="mobile-header">
        <div className="mobile-logo">AURUM</div>
        <button className="mobile-menu-btn" onClick={() => setDrawerOpen(true)}>☰</button>
      </header>

      {/* ── DRAWER OVERLAY ── */}
      {drawerOpen && (
        <div className="mobile-overlay open" onClick={() => setDrawerOpen(false)} />
      )}

      {/* ── MOBILE DRAWER ── */}
      <div className={`mobile-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="logo-text">AURUM</div>
            <div className="logo-sub">Gestión de suplementos</div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 4 }}
          >✕</button>
        </div>
        <NavContent {...navProps} onItemClick={() => setDrawerOpen(false)} />
      </div>

      {/* ── BOTTOM NAV MOBILE ── */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {BOTTOM_NAV.map(item => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={`bottom-nav-item${isActive ? ' active' : ''}`}
              >
                <span className="bottom-nav-icon">
                  {item.icon}
                  {item.badge === 'pedidos' && pedidosAbiertos > 0 && (
                    <span className="bottom-nav-dot" />
                  )}
                </span>
                <span className="bottom-nav-label">{item.label}</span>
              </NavLink>
            )
          })}
          {/* Botón "Más" abre el drawer */}
          <button className="bottom-nav-item" onClick={() => setDrawerOpen(true)}>
            <span className="bottom-nav-icon">☰</span>
            <span className="bottom-nav-label">Más</span>
          </button>
        </div>
      </nav>

      {editando && (
        <ModalSucursal
          sucursal={editando === 'nuevo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargarSucursales() }}
        />
      )}
    </>
  )
}
