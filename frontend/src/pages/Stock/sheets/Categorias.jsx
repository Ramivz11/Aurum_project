import { useState, useEffect, useCallback } from 'react'
import { Modal, ConfirmDialog, EmptyState } from '../../../components/ui'
import { toast } from '../../../components/Toast'
import { categoriasProductoApi } from '../../../api'

/**
 * Alta, edición y borrado de categorías. La lógica es la de antes; lo que
 * cambia es que los controles llegan al mínimo táctil y los botones dicen qué
 * hacen en vez de ser un ✓ y una ✕ sueltos.
 */
export default function Categorias({ onClose }) {
  const [categorias, setCategorias] = useState([])
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  const cargar = useCallback(() => {
    categoriasProductoApi.listar().then(r => setCategorias(r.data)).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const crear = async () => {
    if (!nueva.trim()) return toast.error('Escribí un nombre')
    try {
      await categoriasProductoApi.crear({ nombre: nueva.trim() })
      setNueva('')
      cargar()
      toast.success('Categoría creada')
    } catch (e) { toast.error(e.message || 'No se pudo crear la categoría') }
  }

  const guardar = async () => {
    if (!editando?.nombre.trim()) return toast.error('El nombre no puede quedar vacío')
    try {
      await categoriasProductoApi.actualizar(editando.id, { nombre: editando.nombre.trim() })
      setEditando(null)
      cargar()
      toast.success('Categoría actualizada')
    } catch (e) { toast.error(e.message || 'No se pudo actualizar la categoría') }
  }

  const eliminar = async (id) => {
    try {
      await categoriasProductoApi.eliminar(id)
      cargar()
      toast.success('Categoría eliminada')
    } catch (e) { toast.error(e.message || 'No se pudo eliminar la categoría') }
  }

  return (
    <Modal
      title="Categorías"
      onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Cerrar</button>}
    >
      <div className="stk-field">
        <label className="stk-label" htmlFor="stk-cat-nueva">Nueva categoría</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="stk-cat-nueva"
            className="stk-input"
            value={nueva}
            onChange={e => setNueva(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && crear()}
            placeholder="Proteínas"
          />
          <button className="btn btn-primary" onClick={crear} style={{ flexShrink: 0 }}>Agregar</button>
        </div>
      </div>

      {categorias.length === 0 ? (
        <EmptyState icon="◇" text="Todavía no hay categorías." />
      ) : (
        <div className="stk-row-list">
          {categorias.map(cat => (
            <div key={cat.id} className="stk-row">
              {editando?.id === cat.id ? (
                <>
                  <input
                    className="stk-input"
                    value={editando.nombre}
                    autoFocus
                    onChange={e => setEditando(ed => ({ ...ed, nombre: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') guardar()
                      if (e.key === 'Escape') setEditando(null)
                    }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={guardar}>Guardar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="stk-row-name">{cat.nombre}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditando({ id: cat.id, nombre: cat.nombre })}
                  >Editar</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmar({
                      mensaje: `¿Eliminar la categoría "${cat.nombre}"?`,
                      fn: () => eliminar(cat.id),
                    })}
                  >Eliminar</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmar && (
        <ConfirmDialog
          message={confirmar.mensaje}
          onConfirm={() => { confirmar.fn(); setConfirmar(null) }}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </Modal>
  )
}
