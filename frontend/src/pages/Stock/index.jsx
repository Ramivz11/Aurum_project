import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { productosApi, stockApi, categoriasProductoApi, finanzasApi, sucursalesApi } from '../../api/services'
import { Modal, Loading, EmptyState, ConfirmDialog, formatARS } from '../../components/ui'

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data = [] }) {
  const pts = data.length >= 2 ? data : [0.3,0.5,0.35,0.6,0.45,0.7,0.5,0.65,0.55,0.72,0.6,0.8,0.65,0.75]
  const max = Math.max(...pts), min = Math.min(...pts), range = max - min || 1
  const W = 220, H = 40, PAD = 3
  const coords = pts.map((v, i) => `${(i / (pts.length - 1)) * W},${H - PAD - ((v - min) / range) * (H - PAD * 2)}`)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
      <path d={`M${coords.join('L')}`} fill="none" stroke="#ff9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Modal: Categorías ────────────────────────────────────────────────────────
function ModalCategorias({ onClose }) {
  const [cats, setCats] = useState([])
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const cargar = () => categoriasProductoApi.listar().then(r => setCats(r.data))
  useEffect(() => { cargar() }, [])
  const crear = async () => {
    if (!nueva.trim()) return toast.error('Ingresá un nombre')
    try { await categoriasProductoApi.crear({ nombre: nueva.trim() }); setNueva(''); cargar(); toast.success('Creada') }
    catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }
  const guardar = async () => {
    try { await categoriasProductoApi.actualizar(editando.id, { nombre: editando.nombre }); setEditando(null); cargar(); toast.success('Actualizada') }
    catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }
  const eliminar = async (id) => { await categoriasProductoApi.eliminar(id); cargar(); toast.success('Eliminada') }
  return (
    <Modal title="Gestionar categorías" onClose={onClose} footer={<button className="btn btn-ghost" onClick={onClose}>Cerrar</button>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input className="input" placeholder="Nueva categoría..." value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} />
        <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={crear}>+ Agregar</button>
      </div>
      {cats.map(cat => (
        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          {editando?.id === cat.id
            ? <><input className="input" style={{ flex: 1 }} value={editando.nombre} onChange={e => setEditando(ed => ({ ...ed, nombre: e.target.value }))} autoFocus />
              <button className="btn btn-primary btn-sm" onClick={guardar}>Guardar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button></>
            : <><span style={{ flex: 1, fontSize: 14 }}>{cat.nombre}</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setEditando({ id: cat.id, nombre: cat.nombre })}>Editar</button>
              <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ msg: `¿Eliminar "${cat.nombre}"?`, fn: () => eliminar(cat.id) })}>✕</button></>
          }
        </div>
      ))}
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
    </Modal>
  )
}

// ─── Modal: Producto ──────────────────────────────────────────────────────────
function ModalProducto({ producto, categorias, onClose, onSaved }) {
  const isEdit = !!producto?.id
  const [form, setForm] = useState({ nombre: producto?.nombre || '', marca: producto?.marca || '', categoria: producto?.categoria || '', imagen_url: producto?.imagen_url || '' })
  const [variantes, setVariantes] = useState(producto?.variantes?.length ? producto.variantes : [{ sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }])
  const [loading, setLoading] = useState(false)
  const addVar = () => setVariantes(v => [...v, { sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }])
  const rmVar = i => setVariantes(v => v.filter((_, idx) => idx !== i))
  const upVar = (i, f, v) => setVariantes(arr => arr.map((item, idx) => idx === i ? { ...item, [f]: v } : item))
  const submit = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    setLoading(true)
    try {
      if (isEdit) { await productosApi.actualizar(producto.id, form); toast.success('Actualizado') }
      else { await productosApi.crear({ ...form, variantes }); toast.success('Creado') }
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') } finally { setLoading(false) }
  }
  return (
    <Modal title={isEdit ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} size="modal-lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button></>}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Variantes</div>
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

// ─── Modal: Lote ──────────────────────────────────────────────────────────────
function ModalLote({ producto, onClose, onSaved }) {
  const [modo, setModo] = useState('porcentaje')
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const modos = [{ key: 'porcentaje', label: '+/- %' }, { key: 'margen_deseado', label: 'Margen %' }, { key: 'precio_fijo', label: 'Precio fijo $' }]
  const aplicar = async () => {
    if (!valor) return toast.error('Ingresá un valor')
    setLoading(true)
    try { await productosApi.ajustarPrecioLote({ producto_id: producto.id, modo, valor: parseFloat(valor) }); toast.success('Precios actualizados'); onSaved(); onClose() }
    catch (e) { toast.error(e.response?.data?.detail || 'Error') } finally { setLoading(false) }
  }
  return (
    <Modal title={`Ajuste por lote — ${producto.nombre}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={aplicar} disabled={loading}>{loading ? 'Aplicando...' : 'Aplicar'}</button></>}>
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

// ─── Card de producto ─────────────────────────────────────────────────────────
function ProductCard({ p, onEdit, onDelete, onLote }) {
  const variantes = p.variantes || []

  // Precios mínimos entre variantes activas
  const costoMin = variantes.length ? Math.min(...variantes.map(v => Number(v.costo || 0))) : 0
  const precioMin = variantes.length ? Math.min(...variantes.map(v => Number(v.precio_venta || 0))) : 0
  const margen = costoMin > 0 && precioMin > 0 ? Math.round(((precioMin - costoMin) / precioMin) * 100) : 0

  // Stock total (campo stock_total ya viene del endpoint /stock)
  const stockTotal = variantes.reduce((a, v) => a + (v.stock_total || v.stock_central || 0), 0)
  const hayBajo = variantes.some(v => (v.stock_total || 0) <= v.stock_minimo)
  const statusColor = stockTotal === 0 ? 'var(--red)' : hayBajo ? 'var(--warning)' : 'var(--green)'

  // Etiqueta primera variante
  const primerVar = variantes[0]
  const varLabel = primerVar ? [primerVar.sabor, primerVar.tamanio].filter(Boolean).join(' · ') : null

  // Stock por sucursal: agregar stock_central bajo "CTR" + cada stocks_sucursal
  const sucMap = {} // { nombre_abrev: cantidad }
  variantes.forEach(v => {
    const ctr = v.stock_central || 0
    sucMap['CTR'] = (sucMap['CTR'] || 0) + ctr
    ;(v.stocks_sucursal || []).forEach(ss => {
      const key = (ss.sucursal_nombre || `S${ss.sucursal_id}`).substring(0, 3).toUpperCase()
      sucMap[key] = (sucMap[key] || 0) + ss.cantidad
    })
  })
  const sucKeys = Object.keys(sucMap)

  return (
    <div
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', position: 'relative', transition: 'border-color .2s, box-shadow .2s, transform .18s', cursor: 'default' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,152,0,.28)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(255,152,0,.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.querySelector('.pca').style.opacity = '1' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; e.currentTarget.querySelector('.pca').style.opacity = '0' }}
    >
      {/* Inner ring */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.04)', pointerEvents: 'none' }} />

      {/* Acciones hover */}
      <div className="pca" style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4, opacity: 0, transition: 'opacity .15s' }}>
        {[{ i: '✎', fn: onEdit, h: 'var(--gold-light)' }, { i: '✕', fn: onDelete, h: 'var(--red)' }].map(({ i, fn, h }) => (
          <button key={i} onClick={fn} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, transition: 'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color = h} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>{i}</button>
        ))}
      </div>

      {/* Nombre + dot */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 64, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>{p.nombre}</span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0, marginTop: 4, boxShadow: `0 0 6px ${statusColor}` }} />
      </div>

      {/* Marca + variante label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {p.marca && (
          <span style={{ background: 'rgba(255,152,0,.15)', color: 'var(--gold-light)', border: '1px solid rgba(255,152,0,.22)', borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '.05em', textTransform: 'uppercase' }}>{p.marca}</span>
        )}
        {varLabel && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {varLabel}{variantes.length > 1 ? ` +${variantes.length - 1}` : ''}
          </span>
        )}
      </div>

      {/* Separador */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 10 }} />

      {/* Costo / Precio / Margen */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>c</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{costoMin > 0 ? formatARS(costoMin) : '—'}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>v</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif', letterSpacing: '-.02em', lineHeight: 1 }}>{formatARS(precioMin)}</span>
        {margen > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--gold-light)', background: 'var(--gold-dim)', borderRadius: 6, padding: '2px 7px' }}>{margen}%</span>
        )}
      </div>

      {/* Stock por sucursal + total */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {sucKeys.map(key => {
            const cant = sucMap[key]
            const bajoDot = cant === 0
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: bajoDot ? 'var(--red)' : 'transparent', border: bajoDot ? 'none' : '1px solid var(--text-dim)' }} />
                <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '.04em' }}>{key}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: bajoDot ? 'var(--red)' : 'var(--text)', marginLeft: 1 }}>{cant}</span>
              </div>
            )
          })}
          {sucKeys.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Sin stock registrado</span>}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: stockTotal === 0 ? 'var(--red)' : 'var(--text)' }}>{stockTotal}</span>
      </div>
    </div>
  )
}

// ─── Footer de estadísticas ───────────────────────────────────────────────────
function StatsBar({ resumen }) {
  const ingresos = resumen?.ingresos_hoy ?? 0
  const delta = resumen?.delta_hoy ?? null
  const tendencia = resumen?.tendencia_mensual ?? []
  const margen = resumen?.margen_promedio ?? 0

  return (
    <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', alignItems: 'center', overflow: 'hidden' }}>
      {/* Ingresos del día */}
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,152,0,.15)', border: '1px solid rgba(255,152,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--gold-light)', flexShrink: 0 }}>$</div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>INGRESOS DEL DIA</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', lineHeight: 1 }}>{formatARS(ingresos)}</span>
            {delta != null && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: delta >= 0 ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {delta >= 0 ? '↗' : '↘'} {delta >= 0 ? '+' : ''}{delta}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tendencia mensual */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.12em' }}>TENDENCIA MENSUAL</span>
        <Sparkline data={tendencia} />
      </div>

      {/* Margen promedio */}
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>MARGEN PROMEDIO</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--gold-light)', letterSpacing: '-.02em', lineHeight: 1 }}>{margen > 0 ? `${margen}%` : '—'}</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,152,0,.15)', border: '1px solid rgba(255,152,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📊</div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Stock() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [resumenDia, setResumenDia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('')  // '' = Todo, 'stock_bajo' = Stock Bajo, o nombre categoría
  const [modalProd, setModalProd] = useState(null)
  const [modalLote, setModalLote] = useState(null)
  const [modalCats, setModalCats] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const cargarCategorias = () => categoriasProductoApi.listar().then(r => setCategorias(r.data))

  const cargar = () => {
    setLoading(true)
    // /stock devuelve stock_central + stocks_sucursal por variante
    stockApi.listar({
      busqueda: busqueda || undefined,
      categoria: (catFiltro && catFiltro !== 'stock_bajo') ? catFiltro : undefined,
    }).then(r => setProductos(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    cargarCategorias()
    sucursalesApi.listar().then(r => setSucursales(r.data)).catch(() => {})
    finanzasApi.resumenDia().then(r => setResumenDia(r.data)).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [busqueda, catFiltro])

  const eliminar = async (id) => { await productosApi.eliminar(id); toast.success('Eliminado'); cargar() }

  // Chips: Todo + Stock Bajo + categorías dinámicas
  const chips = [
    { key: '', label: 'Todo' },
    { key: 'stock_bajo', label: 'Stock Bajo' },
    ...categorias.map(c => ({ key: c.nombre, label: c.nombre })),
  ]

  // Filtro stock bajo se hace en cliente
  const productosFiltrados = catFiltro === 'stock_bajo'
    ? productos.filter(p => p.variantes?.some(v => (v.stock_total || 0) <= v.stock_minimo))
    : productos

  return (<>
    {/* ── Topbar (igual al resto de páginas, con el diseño de la captura) ── */}
    <div className="topbar">
      {/* Izquierda: Logo Aurum */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,152,0,.15)', border: '1px solid rgba(255,152,0,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>⚡</div>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
            <span style={{ color: 'var(--text)' }}>Aurum </span>
            <span style={{ background: 'linear-gradient(135deg,#ffb74d,#ff9800)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Suplementos</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 1 }}>Panel de Control</div>
        </div>
      </div>

      {/* Derecha: campana + settings + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 17, position: 'relative', padding: '4px 6px', lineHeight: 1, transition: 'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          🔔
          <span style={{ position: 'absolute', top: 3, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', border: '1.5px solid var(--bg)', display: 'block' }} />
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 17, padding: '4px 6px', lineHeight: 1, transition: 'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>⚙</button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#ff9800,#e65100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>JD</div>
      </div>
    </div>

    {/* ── Contenido ── */}
    <div className="page-content">

      {/* Título + subtítulo */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', marginBottom: 4 }}>Gestion de Inventario</h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {productosFiltrados.length} productos en {sucursales.length || 3} sucursales
        </p>
      </div>

      {/* Barra de búsqueda grande */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px', height: 48, transition: 'border-color .2s' }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(255,152,0,.4)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit' }}
            placeholder="Buscar productos, marcas, categorías..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        {/* Botón filtro avanzado */}
        <button onClick={() => setModalCats(true)} title="Gestionar categorías"
          style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', transition: 'border-color .2s, color .2s', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,152,0,.4)'; e.currentTarget.style.color = 'var(--gold-light)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
        </button>
        <button onClick={() => setModalProd({})} className="btn btn-primary" style={{ height: 48, borderRadius: 12, paddingInline: 20, whiteSpace: 'nowrap', flexShrink: 0, fontSize: 13 }}>
          + Nuevo producto
        </button>
      </div>

      {/* Chips de categoría */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {chips.map(chip => (
          <button key={chip.key} onClick={() => setCatFiltro(chip.key)} style={{
            padding: '5px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid', cursor: 'pointer', transition: 'all .15s',
            ...(catFiltro === chip.key
              ? { background: 'var(--gold)', borderColor: 'var(--gold)', color: '#0a1000' }
              : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' })
          }}
            onMouseEnter={e => { if (catFiltro !== chip.key) { e.currentTarget.style.borderColor = 'rgba(255,152,0,.4)'; e.currentTarget.style.color = 'var(--text)' } }}
            onMouseLeave={e => { if (catFiltro !== chip.key) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' } }}
          >{chip.label}</button>
        ))}
      </div>

      {/* Grid 4 columnas */}
      {loading
        ? <Loading />
        : productosFiltrados.length === 0
          ? <EmptyState icon="⬡" text="Sin productos." />
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {productosFiltrados.map(p => (
                <ProductCard key={p.id} p={p}
                  onEdit={() => setModalProd(p)}
                  onDelete={() => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: () => eliminar(p.id) })}
                  onLote={() => setModalLote(p)}
                />
              ))}
            </div>
          )
      }

      {/* Footer stats */}
      {!loading && productosFiltrados.length > 0 && <StatsBar resumen={resumenDia} />}
    </div>

    {/* Modales */}
    {modalProd !== null && <ModalProducto producto={modalProd} categorias={categorias} onClose={() => setModalProd(null)} onSaved={cargar} />}
    {modalLote && <ModalLote producto={modalLote} onClose={() => setModalLote(null)} onSaved={cargar} />}
    {modalCats && <ModalCategorias onClose={() => { setModalCats(false); cargarCategorias() }} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}

    <style>{`
      @media (max-width: 1300px) { .sg { grid-template-columns: repeat(3,1fr) !important; } }
      @media (max-width: 900px)  { .sg { grid-template-columns: repeat(2,1fr) !important; } }
      @media (max-width: 600px)  { .sg { grid-template-columns: 1fr !important; } }
    `}</style>
  </>)
}
