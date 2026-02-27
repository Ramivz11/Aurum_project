import { useState, useEffect } from 'react'
import { categoriasProductoApi } from '../api'
import { useToast } from '../components/Toast'

export function Categorias() {
  const toast = useToast()
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // id | 'nueva'
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = () => {
    setLoading(true)
    categoriasProductoApi.listar()
      .then(setCategorias)
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const iniciarEdicion = (cat) => {
    setEditando(cat.id)
    setNombre(cat.nombre)
  }

  const iniciarNueva = () => {
    setEditando('nueva')
    setNombre('')
  }

  const cancelar = () => { setEditando(null); setNombre('') }

  const guardar = async () => {
    if (!nombre.trim()) return toast('Escribí un nombre', 'error')
    setSaving(true)
    try {
      if (editando === 'nueva') {
        await categoriasProductoApi.crear({ nombre: nombre.trim() })
        toast('Categoría creada')
      } else {
        await categoriasProductoApi.actualizar(editando, { nombre: nombre.trim() })
        toast('Categoría actualizada')
      }
      cancelar()
      cargar()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta categoría? No se eliminarán los productos asociados.')) return
    try {
      await categoriasProductoApi.eliminar(id)
      toast('Categoría eliminada')
      cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Categorías</div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={iniciarNueva}>+ Nueva categoría</button>
        </div>
      </div>

      <div className="content page-enter">
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-header">
            <span className="card-title">Categorías de productos</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{categorias.length} categorías</span>
          </div>

          {/* Formulario nueva */}
          {editando === 'nueva' && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, margin: 0 }}
                  placeholder="Nombre de la categoría..."
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') cancelar() }}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
                  {saving ? '...' : 'Crear'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={cancelar}>Cancelar</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading">Cargando...</div>
          ) : categorias.length === 0 ? (
            <div className="empty">Sin categorías. Creá la primera.</div>
          ) : (
            categorias.map(cat => (
              <div key={cat.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 20px', borderBottom: '1px solid var(--border)',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {editando === cat.id ? (
                  <>
                    <input
                      className="form-input"
                      style={{ flex: 1, margin: 0 }}
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') cancelar() }}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
                      {saving ? '...' : 'Guardar'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={cancelar}>✕</button>
                  </>
                ) : (
                  <>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{cat.nombre}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => iniciarEdicion(cat)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminar(cat.id)}>✕</button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
