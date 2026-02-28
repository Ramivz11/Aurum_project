import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { productosApi, categoriasProductoApi } from '../../api/services'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS } from '../../components/ui'

// ─── Modal: Gestionar categorías ─────────────────────────────────────────────

function ModalCategorias({ onClose }) {
  const [categorias, setCategorias] = useState([])
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null)
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
      {categorias.length === 0
        ? <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No hay categorías todavía.</p>
        : categorias.map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {editando?.id === cat.id ? (
              <>
                <input className="input" style={{ flex: 1 }} value={editando.nombre}
                  onChange={e => setEditando(ed => ({ ...ed, nombre: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(); if (e.key === 'Escape') setEditando(null) }}
                  autoFocus />
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

// ─── Stock Footer Widget ──────────────────────────────────────────────────────

function StockFooter({ productos }) {
  const variantes = productos.flatMap(p => p.variantes?.filter(v => v.activa !== false) || [])
  const stockBajo = variantes.filter(v => v.stock_actual <= v.stock_minimo).length
  const sinStock = variantes.filter(v => !v.stock_actual || v.stock_actual === 0).length
  const precios = variantes.filter(v => v.precio_venta && v.costo && v.costo > 0)
  const margenPromedio = precios.length
    ? Math.round(precios.reduce((a, v) => a + ((v.precio_venta - v.costo) / v.precio_venta) * 100, 0) / precios.length)
    : 0

  const sparkPoints = [40, 55, 35, 60, 45, 70, 50, 65, 42, 58, 48, 72]
  const sparkMax = Math.max(...sparkPoints)
  const sparkMin = Math.min(...sparkPoints)
  const range = sparkMax - sparkMin || 1
  const W = 220; const H = 38
  const pts = sparkPoints.map((v, i) => {
    const x = (i / (sparkPoints.length - 1)) * W
    const y = H - ((v - sparkMin) / range) * H
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{
      margin: '24px 0 8px',
      borderRadius: 20,
      background: 'linear-gradient(135deg, rgba(15,22,41,0.97) 0%, rgba(26,32,53,0.92) 100%)',
      border: '1px solid rgba(255,152,0,0.15)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
        {/* Stat 1 - Productos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(255,152,0,0.2), rgba(255,152,0,0.08))',
            border: '1px solid rgba(255,152,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>$</div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Total Productos</div>
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#f1f5f9', lineHeight: 1 }}>
              {productos.length}
            </div>
            {stockBajo > 0 && (
              <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ background: 'rgba(251,191,36,0.15)', borderRadius: 999, padding: '1px 8px' }}>
                  +{stockBajo}% bajo mínimo
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stat 2 - Sparkline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Tendencia de stock</div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, overflow: 'visible' }}>
              <defs>
                <linearGradient id="sk-g" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ff9800" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#ffb74d" stopOpacity="1" />
                </linearGradient>
              </defs>
              <polyline points={pts} fill="none" stroke="url(#sk-g)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {sinStock > 0 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Sin stock</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#ef4444' }}>{sinStock}</div>
            </div>
          )}
        </div>

        {/* Stat 3 - Margen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(255,152,0,0.2), rgba(255,152,0,0.08))',
            border: '1px solid rgba(255,152,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>◇</div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Margen Promedio</div>
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#ff9800', lineHeight: 1 }}>{margenPromedio}%</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{precios.length} variantes activas</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta de producto ──────────────────────────────────────────────────────

function ProductCard({ p, onEdit, onLote, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const variantes = p.variantes?.filter(v => v.activa !== false) || []
  const stockTotal = variantes.reduce((a, v) => a + (v.stock_actual || 0), 0)
  const bajoPorVariante = variantes.filter(v => v.stock_actual <= v.stock_minimo)
  const hayBajo = bajoPorVariante.length > 0
  const costoMin = variantes.length ? Math.min(...variantes.map(v => Number(v.costo || 0))) : 0
  const precioMin = variantes.length ? Math.min(...variantes.map(v => Number(v.precio_venta || 0))) : 0
  const margen = costoMin > 0 ? Math.round(((precioMin - costoMin) / precioMin) * 100) : 0
  const primerVar = variantes[0]
  const varLabel = primerVar ? [primerVar.sabor, primerVar.tamanio].filter(Boolean).join(' · ') : null
  const statusColor = stockTotal === 0 ? '#ef4444' : hayBajo ? '#fbbf24' : '#22c55e'
  const sucursalLabels = ['CTR', 'NRT', 'WEB']

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: hovered
          ? 'linear-gradient(145deg, rgba(26,32,53,0.98), rgba(22,28,48,0.95))'
          : 'linear-gradient(145deg, rgba(15,22,41,0.95), rgba(20,26,46,0.9))',
        border: hovered ? '1px solid rgba(255,152,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 18,
        padding: 18,
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,152,0,0.08), 0 8px 20px rgba(255,152,0,0.07)'
          : '0 2px 12px rgba(0,0,0,0.3)',
        cursor: 'default', overflow: 'hidden',
      }}
    >
      {/* Subtle inner glow */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        background: hovered ? 'radial-gradient(ellipse at top left, rgba(255,152,0,0.05), transparent 60%)' : 'none',
        transition: 'all 0.2s',
      }} />

      {/* Action buttons */}
      <div style={{
        position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', zIndex: 2,
      }}>
        {[
          { label: '%', title: 'Ajuste de precios', action: onLote, hoverColor: '#ff9800' },
          { label: '✎', title: 'Editar', action: onEdit, hoverColor: '#ff9800' },
          { label: '✕', title: 'Eliminar', action: onDelete, hoverColor: '#ef4444' },
        ].map(btn => (
          <button key={btn.label} title={btn.title} onClick={btn.action}
            onMouseEnter={e => { e.currentTarget.style.color = btn.hoverColor; e.currentTarget.style.borderColor = btn.hoverColor + '55' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            style={{
              background: 'rgba(10,16,36,0.9)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 12,
              transition: 'all 0.15s', backdropFilter: 'blur(8px)',
            }}>{btn.label}</button>
        ))}
      </div>

      {/* Name + status dot */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 90 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', lineHeight: 1.3, flex: 1 }}>{p.nombre}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0, marginTop: 4, boxShadow: `0 0 8px ${statusColor}` }} />
      </div>

      {/* Brand + variant label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {p.marca && (
          <span style={{
            background: 'rgba(255,152,0,0.12)', color: '#ffb74d',
            border: '1px solid rgba(255,152,0,0.22)',
            borderRadius: 6, fontSize: 9, fontWeight: 700,
            padding: '2px 8px', letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>{p.marca}</span>
        )}
        {varLabel && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {varLabel}{variantes.length > 1 ? ` +${variantes.length - 1}` : ''}
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '2px 0' }} />

      {/* Prices + margin */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontWeight: 500 }}>c</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>
          {costoMin > 0 ? formatARS(costoMin) : '—'}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginLeft: 6 }}>v</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {formatARS(precioMin)}
        </span>
        {margen > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#ff9800',
            background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.18)',
            borderRadius: 6, padding: '2px 7px',
          }}>{margen}%</span>
        )}
      </div>

      {/* Stock breakdown per sucursal */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {variantes.slice(0, 3).map((v, i) => {
          const label = sucursalLabels[i] || `V${i + 1}`
          const isBajo = v.stock_actual <= v.stock_minimo
          return (
            <div key={v.id || i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 14 }}>
              <span style={{
                fontSize: 9, color: isBajo ? '#ef4444' : 'rgba(255,255,255,0.28)',
                fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {isBajo ? '●' : '○'} {label}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif',
                color: isBajo ? '#ef4444' : 'rgba(255,255,255,0.82)',
              }}>{v.stock_actual ?? 0}</span>
            </div>
          )
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>total</span>
          <span style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'Syne, sans-serif',
            color: stockTotal === 0 ? '#ef4444' : '#f1f5f9',
          }}>{stockTotal}</span>
        </div>
      </div>
    </div>
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

  const categoriasFiltro = [
    'Todo',
    ...[...categorias]
      .filter(c => c.nombre.toLowerCase() !== 'otras')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(c => c.nombre),
    ...(categorias.some(c => c.nombre.toLowerCase() === 'otras') ? ['Otras'] : [])
  ]

  return (<>
    {/* ── Topbar ── */}
    <div className="topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="page-title" style={{ fontSize: 22, fontWeight: 800 }}>Gestion de Inventario</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          {productos.length} productos en {categorias.length} categorías
        </div>
      </div>
      <div className="topbar-actions">
        <button className="btn btn-ghost" onClick={() => setModalCats(true)}>Categorías</button>
        <button className="btn btn-primary" onClick={() => setModalProd({})}>+ Nuevo producto</button>
      </div>
    </div>

    <div className="page-content">
      {/* ── Search bar ── */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>⌕</span>
        <input
          style={{
            width: '100%', padding: '12px 48px 12px 44px',
            background: 'rgba(15,22,41,0.8)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, color: '#f1f5f9', fontSize: 14, outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          placeholder="Buscar productos, marcas, categorías..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onFocus={e => { e.target.style.borderColor = 'rgba(255,152,0,0.35)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,152,0,0.08)' }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* ── Category filter pills ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {categoriasFiltro.map(cat => {
          const isActive = cat === 'Todo' ? !categoria : categoria === cat
          return (
            <button key={cat}
              onClick={() => cat === 'Todo' ? setCategoria('') : setCategoria(cat)}
              style={{
                padding: '6px 16px', borderRadius: 999,
                fontSize: 13, fontWeight: 500,
                border: isActive ? '1px solid rgba(255,152,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? 'rgba(255,152,0,0.15)' : 'rgba(15,22,41,0.6)',
                color: isActive ? '#ff9800' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >{cat}</button>
          )
        })}
      </div>

      {/* ── Bento Grid ── */}
      {loading ? <Loading /> : productos.length === 0 ? <EmptyState icon="⬡" text="Sin productos." /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
            {productos.map(p => (
              <ProductCard key={p.id} p={p}
                onEdit={() => setModalProd(p)}
                onLote={() => setModalLote(p)}
                onDelete={() => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: () => eliminar(p.id) })}
              />
            ))}
          </div>
          <StockFooter productos={productos} />
        </>
      )}
    </div>

    {modalProd !== null && <ModalProducto producto={modalProd} categorias={categorias} onClose={() => setModalProd(null)} onSaved={cargar} />}
    {modalLote && <ModalLote producto={modalLote} onClose={() => setModalLote(null)} onSaved={cargar} />}
    {modalCats && <ModalCategorias onClose={() => { setModalCats(false); cargarCategorias() }} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
  </>)
}
