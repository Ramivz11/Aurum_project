import { NavLink } from 'react-router-dom'
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
  ]},
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
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [pedidosAbiertos, setPedidosAbiertos] = useState(0)
  const [sucursalesOpen, setSucursalesOpen] = useState(true)
  const [editando, setEditando] = useState(null)
  const { sucursales, sucursalActual, setSucursalActual, cargarSucursales } = useSucursal()

  useEffect(() => {
    ventasApi.pedidosAbiertos().then(d => setPedidosAbiertos(d.length)).catch(() => {})
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

      {editando && (
        <ModalSucursal
          sucursal={editando === 'nuevo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargarSucursales() }}
        />
      )}
    </aside>
  )
}
