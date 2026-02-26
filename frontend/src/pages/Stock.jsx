import { useState, useEffect } from 'react'
import { productosApi, stockApi, sucursalesApi, categoriasProductoApi } from '../api'
import { useToast } from '../components/Toast'
import { useSucursal } from '../context/SucursalContext'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const EMOJI = { proteina: '🥛', creatina: '⚡', 'pre-workout': '🔥', bcaa: '💊', otro: '📦' }
const getEmoji = (cat) => EMOJI[cat?.toLowerCase()] || '📦'

// ─── MODAL TRANSFERENCIA ─────────────────────────────────────────────────────
function ModalTransferencia({ variante, sucursales, onClose, onSaved }) {
  const toast = useToast()
  const [origenTipo, setOrigenTipo] = useState('central') // 'central' | 'sucursal'
  const [origenId, setOrigenId] = useState('')
  const [destinoTipo, setDestinoTipo] = useState('sucursal')
  const [destinoId, setDestinoId] = useState(sucursales[0]?.id || '')
  const [cantidad, setCantidad] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  const stockCentral = variante.stock_central ?? variante.stock_actual ?? 0
  const stockEnSucursal = (id) => variante.stocks_sucursal?.find(s => s.sucursal_id === id)?.cantidad ?? 0

  const save = async () => {
    if (!cantidad || parseInt(cantidad) <= 0) return toast('Ingresá una cantidad válida', 'error')
    const origen = origenTipo === 'central' ? null : parseInt(origenId)
    const destino = destinoTipo === 'central' ? null : parseInt(destinoId)
    if (origen === destino) return toast('El origen y destino no pueden ser iguales', 'error')
    setSaving(true)
    try {
      await stockApi.transferir({
        variante_id: variante.id,
        cantidad: parseInt(cantidad),
        sucursal_origen_id: origen,
        sucursal_destino_id: destino,
        notas: notas || null,
      })
      toast('Transferencia realizada')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Transferir stock — {variante.sabor || variante.tamanio || 'Variante'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Origen</label>
              <select className="form-select" value={origenTipo} onChange={e => setOrigenTipo(e.target.value)}>
                <option value="central">Central ({stockCentral} u.)</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({stockEnSucursal(s.id)} u.)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Destino</label>
              <select className="form-select"
                value={destinoTipo !== 'central' ? destinoId : 'central'}
                onChange={e => {
                  if (e.target.value === 'central') { setDestinoTipo('central'); setDestinoId('') }
                  else { setDestinoTipo('sucursal'); setDestinoId(e.target.value) }
                }}>
                <option value="central">Central</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Cantidad</label>
            <input className="form-input" type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Notas (opcional)</label>
            <input className="form-input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Motivo de la transferencia..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Transfiriendo...' : 'Transferir'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL PRODUCTO ───────────────────────────────────────────────────────────
function ModalProducto({ prod, categorias, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(prod || { nombre: '', marca: '', categoria: 'proteina', imagen_url: '' })
  const [variantes, setVariantes] = useState(
    prod?.variantes?.length > 0
      ? prod.variantes.filter(v => v.activa)
      : [{ sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }]
  )
  const [saving, setSaving] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setV = (i, k, v) => setVariantes(vs => vs.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const addVariante = () => setVariantes(vs => [...vs, { sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }])
  const removeVariante = (i) => setVariantes(vs => vs.filter((_, j) => j !== i))

  const save = async () => {
    if (!form.nombre) return toast('El nombre es obligatorio', 'error')
    setSaving(true)
    try {
      if (prod) {
        await productosApi.actualizar(prod.id, {
          nombre: form.nombre, marca: form.marca, categoria: form.categoria, imagen_url: form.imagen_url
        })
        for (const v of variantes) {
          const payload = {
            sabor: v.sabor, tamanio: v.tamanio, sku: v.sku,
            costo: parseFloat(v.costo) || 0,
            precio_venta: parseFloat(v.precio_venta) || 0,
            stock_minimo: parseInt(v.stock_minimo) || 0,
          }
          if (v.id) {
            await productosApi.actualizarVariante(v.id, payload)
          } else {
            await productosApi.crearVariante(prod.id, payload)
          }
        }
      } else {
        await productosApi.crear({
          ...form,
          variantes: variantes.map(v => ({
            sabor: v.sabor, tamanio: v.tamanio, sku: v.sku,
            costo: parseFloat(v.costo) || 0,
            precio_venta: parseFloat(v.precio_venta) || 0,
            stock_minimo: parseInt(v.stock_minimo) || 0,
          }))
        })
      }
      toast(prod ? 'Producto actualizado' : 'Producto creado')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{prod ? 'Editar producto' : 'Nuevo producto'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Ej: Whey Gold Standard" />
            </div>
            <div className="form-group">
              <label className="form-label">Marca</label>
              <input className="form-input" value={form.marca || ''} onChange={e => setF('marca', e.target.value)} placeholder="Ej: Optimum Nutrition" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.categoria || ''} onChange={e => setF('categoria', e.target.value)}>
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">URL de imagen</label>
              <input className="form-input" value={form.imagen_url || ''} onChange={e => setF('imagen_url', e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="form-label" style={{ margin: 0 }}>Variantes</div>
              <button className="btn btn-ghost btn-sm" onClick={addVariante}>+ Agregar variante</button>
            </div>
            {variantes.map((v, i) => (
              <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, marginBottom: 10, position: 'relative' }}>
                <div className="form-row-3">
                  <div className="form-group"><label className="form-label">Sabor</label><input className="form-input" value={v.sabor || ''} onChange={e => setV(i, 'sabor', e.target.value)} placeholder="Chocolate" /></div>
                  <div className="form-group"><label className="form-label">Tamaño</label><input className="form-input" value={v.tamanio || ''} onChange={e => setV(i, 'tamanio', e.target.value)} placeholder="1kg" /></div>
                  <div className="form-group"><label className="form-label">SKU</label><input className="form-input" value={v.sku || ''} onChange={e => setV(i, 'sku', e.target.value)} placeholder="WHY-CHOC-1K" /></div>
                </div>
                <div className="form-row-3">
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Costo ($)</label><input className="form-input" type="number" value={v.costo || ''} onChange={e => setV(i, 'costo', e.target.value)} placeholder="0" /></div>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Precio venta ($)</label><input className="form-input" type="number" value={v.precio_venta || ''} onChange={e => setV(i, 'precio_venta', e.target.value)} placeholder="0" /></div>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Stock mínimo</label><input className="form-input" type="number" value={v.stock_minimo || ''} onChange={e => setV(i, 'stock_minimo', e.target.value)} placeholder="0" /></div>
                </div>
                {variantes.length > 1 && (
                  <button onClick={() => removeVariante(i)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                )}
              </div>
            ))}
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

// ─── MODAL AJUSTE DE PRECIOS ─────────────────────────────────────────────────
function ModalLote({ producto, onClose, onSaved }) {
  const toast = useToast()
  const [modo, setModo] = useState('porcentaje')
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const modos = [
    { id: 'porcentaje', label: '+/- %', hint: 'Ej: 10 sube 10%, -5 baja 5%' },
    { id: 'margen_deseado', label: 'Margen', hint: 'Ej: 40 = 40% sobre el costo' },
    { id: 'precio_fijo', label: 'Precio fijo', hint: 'Sobreescribe con un valor fijo' },
  ]
  const save = async () => {
    if (!valor) return toast('Ingresá un valor', 'error')
    setSaving(true)
    try {
      await productosApi.ajustarPrecioLote({ producto_id: producto.id, modo, valor: parseFloat(valor) })
      toast('Precios actualizados'); onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Ajuste de precios — {producto.nombre}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {modos.map(m => <button key={m.id} className={`btn ${modo === m.id ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setModo(m.id)}>{m.label}</button>)}
          </div>
          <div className="form-group">
            <label className="form-label">{modos.find(m => m.id === modo)?.hint}</label>
            <input className="form-input" type="number" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Aplicando...' : 'Aplicar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── STOCK EDITABLE INLINE ───────────────────────────────────────────────────
function StockEditable({ variante, sucursalId, onSaved }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const cantidad = sucursalId
    ? (variante.stocks_sucursal?.find(s => s.sucursal_id === sucursalId)?.cantidad ?? 0)
    : (variante.stock_central ?? variante.stock_actual ?? 0)
  const [val, setVal] = useState(cantidad)

  const color = cantidad <= 0 ? 'var(--red)' : cantidad <= variante.stock_minimo ? 'var(--red)' : cantidad <= variante.stock_minimo * 2 ? 'var(--gold)' : 'var(--green)'

  const save = async () => {
    try {
      await stockApi.ajustarManual(variante.id, { cantidad: parseInt(val) || 0, sucursal_id: sucursalId || null })
      toast('Stock actualizado'); setEditing(false); onSaved()
    } catch (e) { toast(e.message, 'error') }
  }

  if (editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="number" min="0" value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus
        style={{ width: 60, background: 'var(--surface3)', border: '1px solid var(--gold)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 14, textAlign: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}
      />
      <button onClick={save} style={{ background: 'var(--gold)', border: 'none', borderRadius: 4, color: '#000', cursor: 'pointer', padding: '4px 8px', fontSize: 11 }}>✓</button>
      <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }}>✕</button>
    </div>
  )

  return (
    <div onClick={() => { setVal(cantidad); setEditing(true) }} style={{ cursor: 'pointer', textAlign: 'right', minWidth: 60 }} title="Click para editar">
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color }}>{cantidad}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>u. ✎</div>
    </div>
  )
}

// ─── FILA DE VARIANTE CON DESGLOSE ───────────────────────────────────────────
function VarianteRow({ variante, sucursales, filtroSucursal, onTransferir, onSaved }) {
  const [expandido, setExpandido] = useState(false)

  // Stock a mostrar según filtro
  const stockDisplay = filtroSucursal
    ? (variante.stocks_sucursal?.find(s => s.sucursal_id === filtroSucursal)?.cantidad ?? 0)
    : variante.stock_total

  const stockMin = variante.stock_minimo
  const color = stockDisplay <= 0 ? 'var(--red)' : stockDisplay <= stockMin ? 'var(--red)' : stockDisplay <= stockMin * 2 ? 'var(--gold)' : 'var(--green)'
  const pct = Math.min(100, Math.max(5, (stockDisplay / Math.max(stockMin * 3, 10)) * 100))

  return (
    <>
      <div className="stock-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="stock-info" style={{ flex: 1 }}>
            <div className="stock-name">{[variante.sabor, variante.tamanio].filter(Boolean).join(' · ') || 'Sin variante'}</div>
            <div className="stock-variant">Costo: {fmt(variante.costo)} · Precio: {fmt(variante.precio_venta)}</div>
          </div>
          <div className="stock-bar-wrap">
            <div className="stock-bar" style={{ width: `${pct}%`, background: color }} />
          </div>
          <StockEditable
            variante={variante}
            sucursalId={filtroSucursal || null}
            onSaved={onSaved}
          />
          <button
            onClick={() => onTransferir(variante)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
            title="Transferir stock"
          >⇄</button>
          {!filtroSucursal && (
            <button
              onClick={() => setExpandido(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, padding: '4px' }}
              title="Ver desglose por sucursal"
            >{expandido ? '▲' : '▼'}</button>
          )}
        </div>

        {/* Desglose por sucursal */}
        {expandido && !filtroSucursal && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Desglose</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {/* Central */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface3)', borderRadius: 8, padding: '6px 12px', minWidth: 140 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-dim)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>Central</span>
                <StockEditable variante={variante} sucursalId={null} onSaved={onSaved} />
              </div>
              {/* Sucursales con stock */}
              {sucursales.map(s => {
                const ss = variante.stocks_sucursal?.find(x => x.sucursal_id === s.id)
                const cant = ss?.cantidad ?? 0
                const c = cant <= 0 ? 'var(--text-dim)' : 'var(--green)'
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface3)', borderRadius: 8, padding: '6px 12px', minWidth: 140 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{s.nombre}</span>
                    <StockEditable variante={variante} sucursalId={s.id} onSaved={onSaved} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────
export default function Stock() {
  const toast = useToast()
  const { sucursales, sucursalActual } = useSucursal()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [filtroSucursal, setFiltroSucursal] = useState('')
  const [modal, setModal] = useState(null)
  const [modalLote, setModalLote] = useState(null)
  const [modalTransferencia, setModalTransferencia] = useState(null)

  // Sin auto-filtro: el usuario elige desde el selector del topbar

  useEffect(() => {
    categoriasProductoApi.listar().then(setCategorias).catch(() => {})
  }, [])

  const cargar = () => {
    setLoading(true)
    const params = {}
    if (busqueda) params.busqueda = busqueda
    if (categoria) params.categoria = categoria
    stockApi.listar(params)
      .then(data => {
        if (!Array.isArray(data)) throw new Error('formato inesperado')
        setProductos(data)
      })
      .catch(() => {
        // Fallback al endpoint viejo si el nuevo no está disponible aún
        productosApi.listar(params).then(data => {
          const normalizado = (Array.isArray(data) ? data : []).map(p => ({
            ...p,
            variantes: (p.variantes || []).map(v => ({
              ...v,
              stock_central: v.stock_actual ?? 0,
              stock_total: v.stock_actual ?? 0,
              stocks_sucursal: [],
            }))
          }))
          setProductos(normalizado)
        }).catch(() => setProductos([]))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [busqueda, categoria])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    try { await productosApi.eliminar(id); toast('Producto eliminado'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  // Filtrar productos por sucursal si hay filtro
  const productosFiltrados = filtroSucursal
    ? productos.filter(p => p.variantes?.some(v =>
        (v.stocks_sucursal?.find(s => s.sucursal_id === filtroSucursal)?.cantidad ?? 0) > 0
      ))
    : productos

  const nombreFiltro = filtroSucursal
    ? sucursales.find(s => s.id === filtroSucursal)?.nombre
    : null

  // KPI stats
  const totalUnidades = productosFiltrados.reduce((acc, p) =>
    acc + (p.variantes?.filter(v => v.activa).reduce((a, v) => a + (v.stock_total ?? v.stock_actual ?? 0), 0) || 0), 0)
  const stockBajoCount = productosFiltrados.filter(p =>
    p.variantes?.some(v => v.activa && (v.stock_total ?? v.stock_actual ?? 0) <= v.stock_minimo)
  ).length
  const getInitials = (nombre) => (nombre || '').substring(0, 2).toUpperCase()

  return (
    <>
      <div className="topbar">
        <div className="page-title">
          Stock
          {nombreFiltro && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>— {nombreFiltro}</span>}
        </div>
        <div className="topbar-actions">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Buscar por nombre, marca..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 'auto', padding: '9px 14px' }} value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto', padding: '9px 14px' }} value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Vista global</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Nuevo producto</button>
        </div>
      </div>

      <div className="content page-enter">
        {/* KPI Strip */}
        {!loading && productosFiltrados.length > 0 && (
          <div className="stock-kpi-strip">
            <div className="stock-kpi-item">
              <span className="stock-kpi-num">{productosFiltrados.length}</span>
              <span className="stock-kpi-label">Productos</span>
            </div>
            <div className="stock-kpi-divider" />
            <div className="stock-kpi-item">
              <span className="stock-kpi-num">{totalUnidades.toLocaleString('es-AR')}</span>
              <span className="stock-kpi-label">Unidades</span>
            </div>
            <div className="stock-kpi-divider" />
            <div className="stock-kpi-item">
              <span className="stock-kpi-num" style={{ color: stockBajoCount > 0 ? 'var(--red)' : 'inherit' }}>
                {stockBajoCount}
              </span>
              <span className="stock-kpi-label">Stock bajo</span>
            </div>
            <div className="stock-kpi-divider" />
            <div className="stock-kpi-item">
              <span className="stock-kpi-num">{categorias.length}</span>
              <span className="stock-kpi-label">Categorías</span>
            </div>
          </div>
        )}

        {loading
          ? <div className="loading">Cargando...</div>
          : productosFiltrados.length === 0
          ? <div className="empty">{filtroSucursal ? 'Sin stock en esta sucursal.' : 'No hay productos.'}</div>
          : (
            <div className="stock-cards-grid">
              {productosFiltrados.map(prod => {
                const variantesActivas = prod.variantes?.filter(v => v.activa) || []
                const hasBajoStock = variantesActivas.some(v =>
                  (v.stock_total ?? v.stock_actual ?? 0) <= v.stock_minimo
                )
                const initials = getInitials(prod.nombre)

                return (
                  <div key={prod.id} className={`stock-prod-card${hasBajoStock ? ' stock-prod-card--alerta' : ''}`}>
                    {/* Cabecera del producto */}
                    <div className="stock-prod-header">
                      <div className="stock-prod-avatar">{initials}</div>
                      <div className="stock-prod-info">
                        <div className="stock-prod-nombre">{prod.nombre}</div>
                        {prod.marca && <div className="stock-prod-marca">{prod.marca}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        {prod.categoria && (
                          <span className="chip chip-blue" style={{ fontSize: 10 }}>{prod.categoria}</span>
                        )}
                        {hasBajoStock && (
                          <span className="chip chip-red" style={{ fontSize: 10 }}>⚠ Stock bajo</span>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="stock-prod-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModalLote(prod)}>
                        <span style={{ fontSize: 11 }}>◇</span> Precios
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(prod)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminar(prod.id)}>✕</button>
                    </div>

                    {/* Variantes */}
                    <div className="stock-variantes">
                      {variantesActivas.length > 0
                        ? variantesActivas.map(v => (
                          <VarianteRow
                            key={v.id}
                            variante={v}
                            sucursales={sucursales}
                            filtroSucursal={filtroSucursal || null}
                            onTransferir={(variante) => setModalTransferencia(variante)}
                            onSaved={cargar}
                          />
                        ))
                        : <div style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: 12 }}>Sin variantes activas</div>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {modal && (
        <ModalProducto prod={modal === 'nuevo' ? null : modal} categorias={categorias} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />
      )}
      {modalLote && (
        <ModalLote producto={modalLote} onClose={() => setModalLote(null)} onSaved={() => { setModalLote(null); cargar() }} />
      )}
      {modalTransferencia && (
        <ModalTransferencia
          variante={modalTransferencia}
          sucursales={sucursales}
          onClose={() => setModalTransferencia(null)}
          onSaved={() => { setModalTransferencia(null); cargar() }}
        />
      )}
    </>
  )
}