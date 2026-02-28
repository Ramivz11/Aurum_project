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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {productos.map(p => {
            const variantes = p.variantes?.filter(v => v.activa !== false) || []
            const stockTotal = variantes.reduce((a, v) => a + (v.stock_actual || 0), 0)
            const bajoPorVariante = variantes.filter(v => v.stock_actual <= v.stock_minimo)
            const hayBajo = bajoPorVariante.length > 0
            const costoMin = variantes.length ? Math.min(...variantes.map(v => Number(v.costo || 0))) : 0
            const precioMin = variantes.length ? Math.min(...variantes.map(v => Number(v.precio_venta || 0))) : 0
            const margen = costoMin > 0 ? Math.round(((precioMin - costoMin) / precioMin) * 100) : 0
            const primerVar = variantes[0]
            const varLabel = primerVar ? [primerVar.sabor, primerVar.tamanio].filter(Boolean).join(' · ') : null
            const statusColor = stockTotal === 0 ? 'var(--red)' : hayBajo ? 'var(--warning)' : 'var(--green)'

            return (
              <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18, position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.18s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,152,0,0.25)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(255,152,0,0.07)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.querySelector('.card-actions').style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.querySelector('.card-actions').style.opacity = '0' }}
              >
                <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

                <div className="card-actions" style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s' }}>
                  {[
                    { icon: '%', title: 'Ajuste de precios', action: () => setModalLote(p), hc: 'var(--gold-light)' },
                    { icon: '✎', title: 'Editar', action: () => setModalProd(p), hc: 'var(--gold-light)' },
                    { icon: '✕', title: 'Eliminar', action: () => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: () => eliminar(p.id) }), hc: 'var(--red)' },
                  ].map(btn => (
                    <button key={btn.icon} title={btn.title} onClick={btn.action}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                      onMouseEnter={e => e.currentTarget.style.color = btn.hc}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >{btn.icon}</button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 80 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>{p.nombre}</span>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0, marginTop: 5, boxShadow: `0 0 6px ${statusColor}` }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {p.marca && <span style={{ background: 'rgba(255,152,0,0.15)', color: 'var(--gold-light)', border: '1px solid rgba(255,152,0,0.25)', borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{p.marca}</span>}
                  {varLabel && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{varLabel}{variantes.length > 1 ? ` +${variantes.length - 1}` : ''}</span>}
                </div>

                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>c</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{costoMin > 0 ? formatARS(costoMin) : '—'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>v</span>
                  <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.01em' }}>{formatARS(precioMin)}</span>
                  {margen > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--gold-light)', background: 'var(--gold-dim)', borderRadius: 6, padding: '2px 7px' }}>{margen}%</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {variantes.length <= 3 ? variantes.map((v, i) => (
                      <div key={v.id || i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{[v.sabor, v.tamanio].filter(Boolean).join(' ').slice(0, 8) || `V${i+1}`}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: v.stock_actual <= v.stock_minimo ? 'var(--red)' : 'var(--text)' }}>{v.stock_actual ?? 0}</span>
                      </div>
                    )) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{variantes.length} variantes</span>
                        {hayBajo && <span style={{ fontSize: 10, color: 'var(--red)', background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '1px 6px' }}>{bajoPorVariante.length} bajo mín.</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>total</span>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: stockTotal === 0 ? 'var(--red)' : 'var(--text)' }}>{stockTotal}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>

    {modalProd !== null && <ModalProducto producto={modalProd} categorias={categorias} onClose={() => setModalProd(null)} onSaved={cargar} />}
    {modalLote && <ModalLote producto={modalLote} onClose={() => setModalLote(null)} onSaved={cargar} />}
    {modalCats && <ModalCategorias onClose={() => { setModalCats(false); cargarCategorias() }} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
  </>)
}