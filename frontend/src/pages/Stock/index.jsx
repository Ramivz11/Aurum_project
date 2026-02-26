import { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import { productosApi, categoriasProductoApi } from '../../api'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS } from '../../components/ui'

// ─── Modal: Gestionar categorías ─────────────────────────────────────────────

function ModalCategorias({ onClose }) {
  const toast = useToast()
  const [categorias, setCategorias] = useState([])
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const cargar = () => categoriasProductoApi.listar().then(r => setCategorias(r.data))
  useEffect(() => { cargar() }, [])

  const crear = async () => {
    if (!nueva.trim()) return toast('Ingresá un nombre', 'error')
    try {
      await categoriasProductoApi.crear({ nombre: nueva.trim() })
      setNueva(''); cargar(); toast('Categoría creada')
    } catch (e) { toast(e.response?.data?.detail || 'Error', 'error') }
  }

  const guardarEdicion = async () => {
    if (!editando?.nombre.trim()) return toast('El nombre no puede estar vacío', 'error')
    try {
      await categoriasProductoApi.actualizar(editando.id, { nombre: editando.nombre.trim() })
      setEditando(null); cargar(); toast('Actualizado')
    } catch (e) { toast(e.response?.data?.detail || 'Error', 'error') }
  }

  const eliminar = async (id) => {
    await categoriasProductoApi.eliminar(id); cargar(); toast('Eliminada')
  }

  return (
    <Modal title="Gestionar categorías" onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Cerrar</button>}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input className="input" placeholder="Nueva categoría..." value={nueva}
          onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} />
        <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={crear}>+ Agregar</button>
      </div>
      {categorias.length === 0
        ? <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No hay categorías todavía.</p>
        : categorias.map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {editando?.id === cat.id ? (
              <>
                <input className="input" style={{ flex: 1 }} value={editando.nombre}
                  onChange={e => setEditando(ed => ({ ...ed, nombre: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(); if (e.key === 'Escape') setEditando(null) }} autoFocus />
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
  const toast = useToast()
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
    if (!form.nombre.trim()) return toast('El nombre es obligatorio', 'error')
    setLoading(true)
    try {
      if (isEdit) { await productosApi.actualizar(producto.id, form); toast('Actualizado') }
      else { await productosApi.crear({ ...form, variantes }); toast('Creado') }
      onSaved(); onClose()
    } catch (e) { toast(e.response?.data?.detail || 'Error') } finally { setLoading(false, 'error') }
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
  const toast = useToast()
  const [modo, setModo] = useState('porcentaje')
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const modos = [{ key: 'porcentaje', label: '+/- %' }, { key: 'margen_deseado', label: 'Margen %' }, { key: 'precio_fijo', label: 'Precio fijo $' }]

  const aplicar = async () => {
    if (!valor) return toast('Ingresá un valor', 'error')
    setLoading(true)
    try {
      await productosApi.ajustarPrecioLote({ producto_id: producto.id, modo, valor: parseFloat(valor) })
      toast('Precios actualizados'); onSaved(); onClose()
    } catch (e) { toast(e.response?.data?.detail || 'Error') } finally { setLoading(false, 'error') }
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

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ p, onEdit, onLote, onEliminar }) {
  const [expanded, setExpanded] = useState(false)

  const stock = p.variantes?.reduce((a, v) => a + v.stock_actual, 0) || 0
  const stockMin = p.variantes?.reduce((a, v) => a + (v.stock_minimo || 0), 0) || 0
  const bajoBstock = p.variantes?.some(v => v.stock_actual <= v.stock_minimo)
  const precios = p.variantes?.map(v => Number(v.precio_venta)).filter(Boolean) || [0]
  const precioMin = precios.length ? Math.min(...precios) : 0
  const precioMax = precios.length ? Math.max(...precios) : 0

  // Avg margin
  const variantesConMargen = p.variantes?.filter(v => v.costo && v.precio_venta) || []
  const margenProm = variantesConMargen.length
    ? variantesConMargen.reduce((acc, v) => acc + ((v.precio_venta - v.costo) / v.precio_venta) * 100, 0) / variantesConMargen.length
    : null

  // Stock fill %
  const stockFill = stockMin > 0 ? Math.min(100, (stock / (stockMin * 2)) * 100) : Math.min(100, stock * 5)
  const stockColor = bajoBstock ? 'var(--red)' : stock > stockMin * 1.5 ? 'var(--green)' : 'var(--gold)'

  // Initials avatar if no image
  const initials = (p.nombre || '').substring(0, 2).toUpperCase()

  return (
    <div className={`product-card${bajoBstock ? ' product-card--alert' : ''}`}>
      {/* Image / Avatar */}
      <div className="product-card__img-wrap">
        {p.imagen_url ? (
          <img src={p.imagen_url} alt={p.nombre} className="product-card__img"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
        ) : null}
        <div className="product-card__initials" style={{ display: p.imagen_url ? 'none' : 'flex' }}>
          {initials}
        </div>
        {bajoBstock && <div className="product-card__alert-dot" title="Stock bajo" />}
      </div>

      {/* Body */}
      <div className="product-card__body">
        {/* Header */}
        <div className="product-card__header">
          <div>
            <div className="product-card__name">{p.nombre}</div>
            {p.marca && <div className="product-card__brand">{p.marca}</div>}
          </div>
          {p.categoria && <Chip color="blue">{p.categoria}</Chip>}
        </div>

        {/* Stock bar */}
        <div className="product-card__stock-section">
          <div className="product-card__stock-row">
            <span className="product-card__stock-label">Stock</span>
            <span className="product-card__stock-num" style={{ color: stockColor }}>
              {stock} <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 11 }}>uds</span>
            </span>
          </div>
          <div className="stock-bar">
            <div className="stock-bar__fill" style={{ width: `${stockFill}%`, background: stockColor }} />
          </div>
          {bajoBstock && (
            <div className="product-card__alert-text">⚠ Stock bajo — mínimo {stockMin} uds</div>
          )}
        </div>

        {/* Price & margin */}
        <div className="product-card__metrics">
          <div className="product-card__metric">
            <div className="product-card__metric-label">Precio</div>
            <div className="product-card__metric-value">
              {formatARS(precioMin)}
              {precioMax !== precioMin && (
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 400 }}> — {formatARS(precioMax)}</span>
              )}
            </div>
          </div>
          {margenProm !== null && (
            <div className="product-card__metric">
              <div className="product-card__metric-label">Margen prom.</div>
              <div className="product-card__metric-value" style={{
                color: margenProm > 40 ? 'var(--green)' : margenProm > 20 ? 'var(--gold-light)' : 'var(--red)'
              }}>
                {margenProm.toFixed(1)}%
              </div>
            </div>
          )}
          <div className="product-card__metric">
            <div className="product-card__metric-label">Variantes</div>
            <div className="product-card__metric-value">{p.variantes?.length || 0}</div>
          </div>
        </div>

        {/* Variantes expandibles */}
        {p.variantes?.length > 0 && (
          <>
            <button className="product-card__expand-btn" onClick={() => setExpanded(e => !e)}>
              <span>{expanded ? '▾' : '▸'}</span>
              {expanded ? 'Ocultar variantes' : `Ver ${p.variantes.length} variante${p.variantes.length > 1 ? 's' : ''}`}
            </button>

            {expanded && (
              <div className="product-card__variantes">
                {p.variantes.map((v, i) => {
                  const vBajo = v.stock_actual <= v.stock_minimo
                  const vMargen = v.costo && v.precio_venta
                    ? ((v.precio_venta - v.costo) / v.precio_venta * 100).toFixed(0)
                    : null
                  return (
                    <div key={v.id || i} className={`variante-pill${vBajo ? ' variante-pill--bajo' : ''}`}>
                      <div className="variante-pill__name">
                        {[v.sabor, v.tamanio].filter(Boolean).join(' · ') || 'Sin nombre'}
                      </div>
                      <div className="variante-pill__data">
                        <span style={{ color: vBajo ? 'var(--red)' : 'var(--text)', fontWeight: 600 }}>
                          {v.stock_actual}u
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>{formatARS(v.precio_venta)}</span>
                        {vMargen && <span style={{ color: 'var(--text-dim)' }}>{vMargen}%</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="product-card__actions">
          <button className="btn btn-ghost btn-xs" onClick={() => onLote(p)}>Ajustar precios</button>
          <button className="btn btn-ghost btn-xs" onClick={() => onEdit(p)}>Editar</button>
          <button className="btn btn-danger btn-xs" onClick={() => onEliminar(p)}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Stock() {
  const toast = useToast()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [vista, setVista] = useState('cards') // 'cards' | 'tabla'
  const [modalProd, setModalProd] = useState(null)
  const [modalLote, setModalLote] = useState(null)
  const [modalCats, setModalCats] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [catDropOpen, setCatDropOpen] = useState(false)

  const cargarCategorias = () => categoriasProductoApi.listar().then(r => setCategorias(r.data))
  const cargar = () => {
    setLoading(true)
    productosApi.listar({ busqueda: busqueda || undefined, categoria: categoria || undefined })
      .then(r => setProductos(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargarCategorias() }, [])
  useEffect(() => { cargar() }, [busqueda, categoria])

  const totalStock = productos.reduce((acc, p) => acc + (p.variantes?.reduce((a, v) => a + v.stock_actual, 0) || 0), 0)
  const productosConBajoStock = productos.filter(p => p.variantes?.some(v => v.stock_actual <= v.stock_minimo)).length

  return (<>
    <div className="topbar">
      <div className="page-title">Stock</div>
      <div className="topbar-actions">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        {/* Dropdown categorías con orden: Todas → cats normales → Otros → + Nueva */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCatDropOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            🏷️ {categoria === '' ? 'Todas las categorías' : categoria}
            <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
          </button>
          {catDropOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, overflow: 'hidden', minWidth: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxHeight: 320, overflowY: 'auto'
            }}>
              {/* 1. Todas */}
              {[['', 'Todas las categorías'], ...categorias
                .filter(c => c.nombre.toLowerCase() !== 'otros')
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map(c => [c.nombre, c.nombre]),
                // Penúltimo: Otros si existe
                ...categorias.filter(c => c.nombre.toLowerCase() === 'otros').map(c => [c.nombre, c.nombre])
              ].map(([val, label], idx, arr) => (
                <button key={val}
                  onClick={() => { setCategoria(val); setCatDropOpen(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                    background: categoria === val ? 'var(--gold-dim)' : 'transparent',
                    color: categoria === val ? 'var(--gold-light)' : 'var(--text)',
                    border: 'none', cursor: 'pointer', fontSize: 13,
                    fontWeight: categoria === val ? 600 : 400,
                    borderBottom: '1px solid var(--border)'
                  }}
                  onMouseEnter={e => { if (categoria !== val) e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { if (categoria !== val) e.currentTarget.style.background = 'transparent' }}
                >{val === '' ? '📋 ' : ''}{label}</button>
              ))}
              {/* Último: + Nueva categoría */}
              <button
                onClick={() => { setCatDropOpen(false); setModalCats(true) }}
                style={{
                  display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                  background: 'transparent', color: 'var(--gold-light)',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gold-dim)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >⊞ Gestionar categorías</button>
            </div>
          )}
        </div>
        {/* Vista toggle */}
        <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <button onClick={() => setVista('cards')} title="Vista cards"
            style={{ padding: '7px 12px', border: 'none', cursor: 'pointer', fontSize: 14, background: vista === 'cards' ? 'var(--gold-dim)' : 'transparent', color: vista === 'cards' ? 'var(--gold-light)' : 'var(--text-muted)', transition: 'all 0.15s' }}>⊟</button>
          <button onClick={() => setVista('tabla')} title="Vista tabla"
            style={{ padding: '7px 12px', border: 'none', cursor: 'pointer', fontSize: 14, background: vista === 'tabla' ? 'var(--gold-dim)' : 'transparent', color: vista === 'tabla' ? 'var(--gold-light)' : 'var(--text-muted)', transition: 'all 0.15s' }}>☰</button>
        </div>
        <button className="btn btn-primary" onClick={() => setModalProd({})}>+ Nuevo producto</button>
      </div>
    </div>

    <div className="page-content">
      {/* KPI strip */}
      <div className="stock-kpi-strip">
        <div className="stock-kpi-item">
          <span className="stock-kpi-num">{productos.length}</span>
          <span className="stock-kpi-label">Productos</span>
        </div>
        <div className="stock-kpi-divider" />
        <div className="stock-kpi-item">
          <span className="stock-kpi-num">{totalStock.toLocaleString('es-AR')}</span>
          <span className="stock-kpi-label">Unidades</span>
        </div>
        <div className="stock-kpi-divider" />
        <div className="stock-kpi-item">
          <span className="stock-kpi-num" style={{ color: productosConBajoStock > 0 ? 'var(--red)' : 'inherit' }}>
            {productosConBajoStock}
          </span>
          <span className="stock-kpi-label">Stock bajo</span>
        </div>
        <div className="stock-kpi-divider" />
        <div className="stock-kpi-item">
          <span className="stock-kpi-num">{categorias.length}</span>
          <span className="stock-kpi-label">Categorías</span>
        </div>
      </div>

      {loading ? <Loading /> : productos.length === 0 ? (
        <EmptyState icon="⬡" text="Sin productos." action={
          <button className="btn btn-primary" onClick={() => setModalProd({})}>+ Agregar primero</button>
        } />
      ) : vista === 'cards' ? (
        <div className="product-cards-grid">
          {productos.map(p => (
            <ProductCard key={p.id} p={p}
              onEdit={setModalProd}
              onLote={setModalLote}
              onEliminar={(p) => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: async () => { await productosApi.eliminar(p.id); toast('Eliminado'); cargar() } })}
            />
          ))}
        </div>
      ) : (
        /* Vista tabla simple */
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Producto</th><th>Categoría</th><th>Variantes</th><th>Stock</th><th>Precio desde</th><th></th></tr></thead>
          <tbody>{productos.map(p => {
            const stock = p.variantes?.reduce((a, v) => a + v.stock_actual, 0) || 0
            const bajo = p.variantes?.some(v => v.stock_actual <= v.stock_minimo)
            const precio = Math.min(...(p.variantes?.map(v => Number(v.precio_venta)) || [0]))
            return (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                  {p.marca && <div style={{ fontSize: 12, color: 'var(--gold-light)' }}>{p.marca}</div>}
                </td>
                <td>{p.categoria ? <Chip color="blue">{p.categoria}</Chip> : <span className="text-dim">—</span>}</td>
                <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{p.variantes?.length || 0}</td>
                <td>
                  <span style={{ fontWeight: 700, color: bajo ? 'var(--red)' : 'var(--text)' }}>{stock}</span>
                  {bajo && <Chip color="red" style={{ marginLeft: 6 }}>Bajo</Chip>}
                </td>
                <td style={{ fontWeight: 500 }}>{formatARS(precio)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setModalLote(p)}>Precios</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => setModalProd(p)}>Editar</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: async () => { await productosApi.eliminar(p.id); toast('Eliminado'); cargar() } })}>✕</button>
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
