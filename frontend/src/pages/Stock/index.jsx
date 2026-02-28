import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { productosApi, categoriasProductoApi } from '../../api/services'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS } from '../../components/ui'

// ─── Modal: Gestionar categorías ─────────────────────────────────────────────

function ModalCategorias({ onClose }) {
  const [categorias, setCategorias] = useState([])
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null) // { id, nombre }
  const [confirm, setConfirm] = useState(null)

  const cargar = () => categoriasProductoApi.listar().then(r => setCategorias(r.data))
  useEffect(() => { cargar() }, [])

  const crear = async () => {
    if (!nueva.trim()) return toast.error('Ingresá un nombre')
    try {
      await categoriasProductoApi.crear({ nombre: nueva.trim() })
      setNueva('')
      cargar()
      toast.success('Categoría creada')
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }

  const guardarEdicion = async () => {
    if (!editando?.nombre.trim()) return toast.error('El nombre no puede estar vacío')
    try {
      await categoriasProductoApi.actualizar(editando.id, { nombre: editando.nombre.trim() })
      setEditando(null)
      cargar()
      toast.success('Categoría actualizada')
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }

  const eliminar = async (id) => {
    await categoriasProductoApi.eliminar(id)
    cargar()
    toast.success('Categoría eliminada')
  }

  return (
    <Modal title="Gestionar categorías" onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Cerrar</button>}
    >
      {/* Agregar nueva */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          className="input"
          placeholder="Nueva categoría (ej: Magnesio)"
          value={nueva}
          onChange={e => setNueva(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && crear()}
        />
        <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={crear}>+ Agregar</button>
      </div>

      {/* Lista */}
      {categorias.length === 0
        ? <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No hay categorías todavía.</p>
        : categorias.map(cat => (
          <div key={cat.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 0', borderBottom: '1px solid var(--border)'
          }}>
            {editando?.id === cat.id ? (
              <>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={editando.nombre}
                  onChange={e => setEditando(ed => ({ ...ed, nombre: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(); if (e.key === 'Escape') setEditando(null) }}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={guardarEdicion}>Guardar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14 }}>{cat.nombre}</span>
                <button className="btn btn-ghost btn-xs" onClick={() => setEditando({ id: cat.id, nombre: cat.nombre })}>Editar</button>
                <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ msg: `¿Eliminar "${cat.nombre}"?`, fn: () => eliminar(cat.id) })}>✕</button>
              </>
            )}
          </div>
        ))
      }

      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
    </Modal>
  )
}

// ─── Modal: Crear / editar producto ──────────────────────────────────────────

function ModalProducto({ producto, categorias, onClose, onSaved }) {
  const isEdit = !!producto?.id
  const [form, setForm] = useState({
    nombre: producto?.nombre || '',
    marca: producto?.marca || '',
    categoria: producto?.categoria || '',
    imagen_url: producto?.imagen_url || ''
  })
  const [variantes, setVariantes] = useState(
    producto?.variantes?.length
      ? producto.variantes
      : [{ sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }]
  )
  const [loading, setLoading] = useState(false)

  const addVar = () => setVariantes(v => [...v, { sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }])
  const rmVar = (i) => setVariantes(v => v.filter((_, idx) => idx !== i))
  const upVar = (i, f, v) => setVariantes(arr => arr.map((item, idx) => idx === i ? { ...item, [f]: v } : item))

  const submit = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    setLoading(true)
    try {
      if (isEdit) {
        await productosApi.actualizar(producto.id, form)
        toast.success('Actualizado')
      } else {
        await productosApi.crear({ ...form, variantes })
        toast.success('Creado')
      }
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') } finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} size="modal-lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button></>}
    >
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <div className="form-group"><label className="input-label">Nombre *</label><input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
        <div className="form-group"><label className="input-label">Marca</label><input className="input" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} /></div>
      </div>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <div className="form-group">
          <label className="input-label">Categoría</label>
          <select className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
            <option value="">Seleccionar...</option>
            {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="input-label">URL imagen</label><input className="input" value={form.imagen_url} onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))} /></div>
      </div>

      {!isEdit && (<>
        <hr className="divider" />
        <div className="flex items-center justify-between mb-12">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Variantes</div>
          <button className="btn btn-ghost btn-sm" onClick={addVar}>+ Agregar</button>
        </div>
        {variantes.map((v, i) => (
          <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
            <div className="grid-2" style={{ marginBottom: 8 }}>
              <div><label className="input-label">Sabor</label><input className="input" value={v.sabor} onChange={e => upVar(i, 'sabor', e.target.value)} /></div>
              <div><label className="input-label">Tamaño</label><input className="input" value={v.tamanio} onChange={e => upVar(i, 'tamanio', e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              <div><label className="input-label">Costo $</label><input className="input" type="number" value={v.costo} onChange={e => upVar(i, 'costo', e.target.value)} /></div>
              <div><label className="input-label">Precio $</label><input className="input" type="number" value={v.precio_venta} onChange={e => upVar(i, 'precio_venta', e.target.value)} /></div>
              <div><label className="input-label">Stock mín.</label><input className="input" type="number" value={v.stock_minimo} onChange={e => upVar(i, 'stock_minimo', e.target.value)} /></div>
              {variantes.length > 1 && <button className="btn btn-danger btn-sm" onClick={() => rmVar(i)}>✕</button>}
            </div>
          </div>
        ))}
      </>)}
    </Modal>
  )
}

// ─── Modal: Ajuste de precios por lote ───────────────────────────────────────

function ModalLote({ producto, onClose, onSaved }) {
  const [modo, setModo] = useState('porcentaje')
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const modos = [{ key: 'porcentaje', label: '+/- %' }, { key: 'margen_deseado', label: 'Margen %' }, { key: 'precio_fijo', label: 'Precio fijo $' }]

  const aplicar = async () => {
    if (!valor) return toast.error('Ingresá un valor')
    setLoading(true)
    try {
      await productosApi.ajustarPrecioLote({ producto_id: producto.id, modo, valor: parseFloat(valor) })
      toast.success('Precios actualizados'); onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') } finally { setLoading(false) }
  }

  return (
    <Modal title={`Ajuste por lote — ${producto.nombre}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={aplicar} disabled={loading}>{loading ? 'Aplicando...' : 'Aplicar'}</button></>}
    >
      <div style={{ marginBottom: 20 }}>
        <label className="input-label">Modo de ajuste</label>
        <div style={{ display: 'flex', gap: 8 }}>{modos.map(m => <button key={m.key} className={`btn btn-sm ${modo === m.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModo(m.key)}>{m.label}</button>)}</div>
      </div>
      <div className="form-group"><label className="input-label">Valor</label><input className="input" type="number" value={valor} onChange={e => setValor(e.target.value)} /></div>
      <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        Afecta <strong style={{ color: 'var(--text)' }}>{producto.variantes?.length || 0} variantes</strong>
      </div>
    </Modal>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Stock() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [modalProd, setModalProd] = useState(null)
  const [modalLote, setModalLote] = useState(null)
  const [modalCats, setModalCats] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const cargarCategorias = () => categoriasProductoApi.listar().then(r => setCategorias(r.data))

  const cargar = () => {
    setLoading(true)
    productosApi.listar({ busqueda: busqueda || undefined, categoria: categoria || undefined })
      .then(r => setProductos(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargarCategorias() }, [])
  useEffect(() => { cargar() }, [busqueda, categoria])

  const eliminar = async (id) => { await productosApi.eliminar(id); toast.success('Eliminado'); cargar() }

  return (<>
    <div className="topbar">
      <div className="page-title">Stock</div>
      <div className="topbar-actions">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input" style={{ width: 'auto' }} value={categoria} onChange={e => {
          if (e.target.value === '__nueva__') { setModalCats(true) }
          else { setCategoria(e.target.value) }
        }}>
          <option value="">Todas las categorías</option>
          {[...categorias]
            .filter(c => c.nombre.toLowerCase() !== 'otras')
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
            .map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)
          }
          {categorias.some(c => c.nombre.toLowerCase() === 'otras') && (
            <option value="Otras">Otras</option>
          )}
          <option value="__nueva__">+ Crear nueva categoría</option>
        </select>
        <button className="btn btn-ghost" onClick={() => setModalCats(true)}>Categorías</button>
        <button className="btn btn-primary" onClick={() => setModalProd({})}>+ Nuevo producto</button>
      </div>
    </div>

    <div className="page-content">
      {loading ? <Loading /> : productos.length === 0 ? <EmptyState icon="⬡" text="Sin productos." /> : (
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Producto</th><th>Categoría</th><th>Variantes</th><th>Stock total</th><th>Precio desde</th><th></th></tr></thead>
          <tbody>{productos.map(p => {
            const stock = p.variantes?.reduce((a, v) => a + v.stock_actual, 0) || 0
            const bajo = p.variantes?.some(v => v.stock_actual <= v.stock_minimo)
            const precio = Math.min(...(p.variantes?.map(v => Number(v.precio_venta)) || [0]))
            return (
              <tr key={p.id}>
                <td>
                  {/* Nombre y marca mismo tamaño, distintos colores */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</span>
                    {p.marca && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--gold-light)' }}>{p.marca}</span>}
                  </div>
                </td>
                <td>{p.categoria ? <Chip color="blue">{p.categoria}</Chip> : <span className="text-dim">—</span>}</td>
                <td style={{ color: 'var(--text-muted)' }}>{p.variantes?.length || 0}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: bajo ? 'var(--red)' : 'var(--text)' }}>{stock}</span>
                    {bajo && <Chip color="red">Bajo</Chip>}
                  </div>
                </td>
                <td style={{ fontWeight: 500 }}>{formatARS(precio)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setModalLote(p)}>Precios</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => setModalProd(p)}>Editar</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: () => eliminar(p.id) })}>✕</button>
                  </div>
                </td>
              </tr>
            )
          })}</tbody>
        </table></div></div>
      )}
    </div>

    {modalProd !== null && <ModalProducto producto={modalProd} categorias={categorias} onClose={() => setModalProd(null)} onSaved={cargar} />}
    {modalLote && <ModalLote producto={modalLote} onClose={() => setModalLote(null)} onSaved={cargar} />}
    {modalCats && <ModalCategorias onClose={() => { setModalCats(false); cargarCategorias() }} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
  </>)
}