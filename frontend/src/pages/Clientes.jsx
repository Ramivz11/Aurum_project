import { useState, useEffect } from 'react'
import { clientesApi } from '../api'
import { useToast } from '../components/Toast'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const initials = (name) => name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

function ModalCliente({ cliente, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ nombre: '', ubicacion: '', telefono: '', ...cliente })
  const [saving, setSaving] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.nombre) return toast('El nombre es obligatorio', 'error')
    setSaving(true)
    try {
      if (cliente) await clientesApi.actualizar(cliente.id, form)
      else await clientesApi.crear(form)
      toast(cliente ? 'Cliente actualizado' : 'Cliente creado')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{cliente ? 'Editar cliente' : 'Nuevo cliente'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Ubicación</label>
            <input className="form-input" value={form.ubicacion || ''} onChange={e => setF('ubicacion', e.target.value)} placeholder="Ej: Córdoba Capital" />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input className="form-input" value={form.telefono || ''} onChange={e => setF('telefono', e.target.value)} placeholder="351-XXX-XXXX" />
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

export function Clientes() {
  const toast = useToast()
  const [clientes, setClientes] = useState([])
  const [top, setTop] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  const cargar = () => {
    setLoading(true)
    Promise.all([clientesApi.listar({ busqueda }), clientesApi.topMes()])
      .then(([c, t]) => { setClientes(c); setTop(t) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [busqueda])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try { await clientesApi.eliminar(id); toast('Cliente eliminado'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Clientes</div>
        <div className="topbar-actions">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Nuevo cliente</button>
        </div>
      </div>
      <div className="content page-enter">
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><span className="card-title">Top clientes del mes</span></div>
            {top.length === 0 ? <div className="empty">Sin ventas este mes</div> : top.slice(0, 5).map(c => (
              <div className="cliente-row" key={c.id}>
                <div className="cliente-avatar">{initials(c.nombre)}</div>
                <div className="cliente-info">
                  <div className="cliente-name">{c.nombre}</div>
                  <div className="cliente-loc">{c.ubicacion || '—'}</div>
                </div>
                <div className="cliente-meta">
                  <div className="cliente-meta-val">{fmt(c.total_gastado)}</div>
                  <div className="cliente-meta-label">este mes</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Directorio</span></div>
            {loading ? <div className="loading">Cargando...</div> : clientes.length === 0 ? <div className="empty">Sin clientes</div> : clientes.map(c => (
              <div className="cliente-row" key={c.id}>
                <div className="cliente-avatar">{initials(c.nombre)}</div>
                <div className="cliente-info">
                  <div className="cliente-name">{c.nombre}</div>
                  <div className="cliente-loc">{[c.ubicacion, c.telefono].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminar(c.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {modal && <ModalCliente cliente={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />}
    </>
  )
}
