import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { productosApi, categoriasProductoApi, finanzasApi, ventasApi } from '../../api/services'
import { Modal, Loading, EmptyState, ConfirmDialog, formatARS } from '../../components/ui'

// ─── Mini sparkline SVG ───────────────────────────────────────────────────────
function Sparkline({ data = [], color = '#ff9800', width = 220, height = 40 }) {
  if (!data.length) {
    // Simulate a wavy line when no real data
    data = [0.4, 0.5, 0.35, 0.6, 0.45, 0.7, 0.5, 0.65, 0.55, 0.72, 0.6, 0.8, 0.65, 0.75]
  }
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 6) - 3
    return `${x},${y}`
  })
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M${pts.join('L')}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
        <input className="input" placeholder="Nueva categoría (ej: Magnesio)" value={nueva}
          onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} />
        <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={crear}>+ Agregar</button>
      </div>
      {categorias.length === 0
        ? <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No hay categorías.</p>
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

// ─── Producto Card ─────────────────────────────────────────────────────────────
function ProductCard({ p, onEdit, onDelete, onLote }) {
  const variantes = p.variantes?.filter(v => v.activa !== false) || []
  const bajoPorVariante = variantes.filter(v => v.stock_actual <= v.stock_minimo)
  const hayBajo = bajoPorVariante.length > 0
  const costoMin = variantes.length ? Math.min(...variantes.map(v => Number(v.costo || 0))) : 0
  const precioMin = variantes.length ? Math.min(...variantes.map(v => Number(v.precio_venta || 0))) : 0
  const margen = costoMin > 0 ? Math.round(((precioMin - costoMin) / precioMin) * 100) : 0
  const primerVar = variantes[0]

  // Stock per branch (CTR, NRT, WEB) - use variantes sabores as proxy, or show 3 cols
  // The screenshot shows CTR / NRT / WEB with individual counts and a total
  // We'll use the first 3 variantes or label them as sucursales if only 1 variant
  const stockTotal = variantes.reduce((a, v) => a + (v.stock_actual || 0), 0)

  const statusColor = stockTotal === 0 ? 'var(--red)'
    : hayBajo ? 'var(--warning)'
    : 'var(--green)'

  // Build subtitle: brand chip label + variant subtitle
  const varLabel = primerVar
    ? [primerVar.sabor, primerVar.tamanio].filter(Boolean).join(' · ')
    : null

  // Simulate CTR / NRT / WEB stock distribution from variants
  // In real data these would be per-sucursal. We show up to 3 variantes or totals.
  const stockCols = variantes.length >= 3
    ? variantes.slice(0, 3)
    : variantes.length === 2
      ? [...variantes, null]
      : variantes.length === 1
        ? [variantes[0], null, null]
        : [null, null, null]

  const branchLabels = ['CTR', 'NRT', 'WEB']

  const formatPrecio = (n) => {
    if (!n) return '—'
    const s = Math.round(n).toString()
    if (n >= 1000) return `$${Math.round(n / 1000 * 10) / 10 >= 1 ? (Math.round(n)).toLocaleString('es-AR') : n}`
    return `$${s}`
  }

  return (
    <div
      className="stock-product-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '18px 18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.18s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(255,152,0,0.25)'
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(255,152,0,0.07)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        const actions = e.currentTarget.querySelector('.spc-actions')
        if (actions) actions.style.opacity = '1'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
        const actions = e.currentTarget.querySelector('.spc-actions')
        if (actions) actions.style.opacity = '0'
      }}
    >
      {/* Subtle inner glow */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      {/* Action buttons */}
      <div className="spc-actions" style={{
        position: 'absolute', top: 12, right: 12,
        display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s',
      }}>
        {[
          { title: 'Ajuste de precios', icon: '%', fn: onLote, hoverColor: 'var(--gold-light)' },
          { title: 'Editar', icon: '✎', fn: onEdit, hoverColor: 'var(--gold-light)' },
          { title: 'Eliminar', icon: '✕', fn: onDelete, hoverColor: 'var(--red)' },
        ].map(({ title, icon, fn, hoverColor }) => (
          <button key={icon} title={title} onClick={fn}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = hoverColor}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >{icon}</button>
        ))}
      </div>

      {/* Row 1: Name + status dot */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 84, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>{p.nombre}</span>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: statusColor,
          flexShrink: 0, marginTop: 5, boxShadow: `0 0 6px ${statusColor}`
        }} />
      </div>

      {/* Row 2: Brand chip + variant label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {p.marca && (
          <span style={{
            background: 'rgba(255,152,0,0.15)', color: 'var(--gold-light)',
            border: '1px solid rgba(255,152,0,0.22)', borderRadius: 6,
            fontSize: 10, fontWeight: 700, padding: '2px 8px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>{p.marca}</span>
        )}
        {varLabel && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
            {varLabel}{variantes.length > 1 ? ` +${variantes.length - 1}` : ''}
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 10 }} />

      {/* Row 3: Costo → Precio + margen badge */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500 }}>c</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '-0.01em' }}>
          {costoMin > 0 ? formatARS(costoMin) : '—'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6, fontWeight: 500 }}>v</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {formatARS(precioMin)}
        </span>
        {margen > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700,
            color: 'var(--gold-light)', background: 'var(--gold-dim)',
            borderRadius: 6, padding: '2px 7px',
          }}>{margen}%</span>
        )}
      </div>

      {/* Row 4: Per-branch stock + total */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {branchLabels.map((label, i) => {
            const v = stockCols[i]
            const stockVal = v?.stock_actual ?? null
            const isBajo = v ? v.stock_actual <= v.stock_minimo : false
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {/* colored dot */}
                {v && (
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    background: stockVal === 0 ? 'var(--red)' : isBajo ? 'var(--warning)' : 'transparent',
                    border: (!isBajo && stockVal > 0) ? '1px solid var(--text-dim)' : 'none',
                  }} />
                )}
                {v && stockVal !== null && (
                  <span style={{
                    fontSize: 10,
                    color: 'var(--text-dim)',
                    fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}>
                    <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{label}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: isBajo ? (stockVal === 0 ? 'var(--red)' : 'var(--warning)') : 'var(--text)',
                      marginLeft: 1,
                    }}>{stockVal}</span>
                  </span>
                )}
                {!v && (
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', opacity: 0.4 }}>{label} —</span>
                )}
              </div>
            )
          })}
        </div>
        {/* Total */}
        <span style={{
          fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif',
          color: stockTotal === 0 ? 'var(--red)' : 'var(--text)',
          minWidth: 24, textAlign: 'right',
        }}>{stockTotal}</span>
      </div>
    </div>
  )
}

// ─── Main Stats Footer ────────────────────────────────────────────────────────
function StatsFooter({ analisis }) {
  const ingresosHoy = analisis?.ingresos_hoy ?? 0
  const tendencia = analisis?.tendencia_mensual ?? []
  const margenPromedio = analisis?.margen_promedio ?? 0
  const deltaHoy = analisis?.delta_hoy ?? null

  return (
    <div style={{
      margin: '24px 0 0',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '22px 32px',
      display: 'grid',
      gridTemplateColumns: '1fr 1.8fr 1fr',
      alignItems: 'center',
      gap: 0,
    }}>
      {/* Left: Ingresos del día */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,152,0,0.15)',
          border: '1px solid rgba(255,152,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>$</div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            INGRESOS DEL DIA
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {formatARS(ingresosHoy)}
            </span>
            {deltaHoy != null && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: deltaHoy >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color: deltaHoy >= 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {deltaHoy >= 0 ? '↗' : '↘'} {deltaHoy >= 0 ? '+' : ''}{deltaHoy}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Tendencia mensual sparkline */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '0 32px' }}>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>TENDENCIA MENSUAL</span>
        <Sparkline data={tendencia} color="#ff9800" width={240} height={44} />
      </div>

      {/* Right: Margen promedio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2, textAlign: 'right' }}>
            MARGEN PROMEDIO
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--gold-light)', letterSpacing: '-0.02em', textAlign: 'right' }}>
            {margenPromedio > 0 ? `${margenPromedio}%` : '—'}
          </div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,152,0,0.15)',
          border: '1px solid rgba(255,152,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>📊</div>
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
  const [analisis, setAnalisis] = useState(null)
  const [totalProductos, setTotalProductos] = useState(0)

  const cargarCategorias = () => categoriasProductoApi.listar().then(r => setCategorias(r.data))

  const cargar = () => {
    setLoading(true)
    productosApi.listar({ busqueda: busqueda || undefined, categoria: categoria || undefined })
      .then(r => {
        setProductos(r.data)
        setTotalProductos(r.data.length)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargarCategorias()
    // Try to get analytics data for the footer
    finanzasApi.analisisMes()
      .then(r => setAnalisis(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [busqueda, categoria])

  const eliminar = async (id) => { await productosApi.eliminar(id); toast.success('Eliminado'); cargar() }

  // Filter chips: "Todo" + categories from API
  const chips = [
    { key: '', label: 'Todo' },
    ...categorias.map(c => ({ key: c.nombre, label: c.nombre }))
  ]

  // Compute global margin from productos
  const margenPromedio = (() => {
    const all = productos.flatMap(p => (p.variantes || []).filter(v => v.activa !== false))
    const valid = all.filter(v => v.costo > 0 && v.precio_venta > 0)
    if (!valid.length) return 0
    const avg = valid.reduce((acc, v) => acc + ((v.precio_venta - v.costo) / v.precio_venta) * 100, 0) / valid.length
    return Math.round(avg * 10) / 10
  })()

  const analyticsData = analisis ? {
    ...analisis,
    margen_promedio: margenPromedio || analisis.margen_promedio,
  } : { margen_promedio: margenPromedio }

  return (<>
    {/* ── Custom header (matches screenshot) ── */}
    <div style={{
      padding: '0 28px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(10,16,33,0.6)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Top navbar row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(255,152,0,0.15)',
            border: '1px solid rgba(255,152,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>⚡</div>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 17, lineHeight: 1 }}>
              <span style={{ color: 'var(--text)' }}>Aurum </span>
              <span style={{ background: 'linear-gradient(135deg, #ffb74d, #ff9800)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Suplementos</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>Panel de Control</div>
          </div>
        </div>

        {/* Right: bell + settings + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, position: 'relative', padding: 4 }}>
            🔔
            <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)' }} />
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: 4 }}>⚙</button>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff9800, #e65100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
          }}>JD</div>
        </div>
      </div>
    </div>

    <div className="page-content" style={{ paddingTop: 0 }}>
      {/* Page title section */}
      <div style={{ padding: '22px 0 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 2 }}>
          Gestion de Inventario
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
          {totalProductos} productos en 3 sucursales
        </p>

        {/* Search bar + filter icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '0 16px', height: 44,
            transition: 'border-color 0.2s',
          }}
            onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(255,152,0,0.35)'}
            onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span style={{ fontSize: 16, color: 'var(--text-dim)' }}>🔍</span>
            <input
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
              }}
              placeholder="Buscar productos, marcas, categorías..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          {/* Filter icon button */}
          <button
            onClick={() => setModalCats(true)}
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16,
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,152,0,0.35)'; e.currentTarget.style.color = 'var(--gold-light)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="Gestionar categorías"
          >⊟</button>
          <button
            onClick={() => setModalProd({})}
            className="btn btn-primary"
            style={{ height: 44, borderRadius: 12, paddingInline: 20, whiteSpace: 'nowrap' }}
          >+ Nuevo producto</button>
        </div>

        {/* Category filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {chips.map(chip => (
            <button key={chip.key} onClick={() => setCategoria(chip.key)} style={{
              padding: '5px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              border: '1px solid',
              cursor: 'pointer', transition: 'all 0.15s',
              ...(categoria === chip.key
                ? { background: 'var(--gold)', borderColor: 'var(--gold)', color: '#000' }
                : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
              )
            }}
              onMouseEnter={e => { if (categoria !== chip.key) { e.currentTarget.style.borderColor = 'rgba(255,152,0,0.4)'; e.currentTarget.style.color = 'var(--text)' } }}
              onMouseLeave={e => { if (categoria !== chip.key) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' } }}
            >{chip.label}</button>
          ))}
        </div>
      </div>

      {/* Product grid - 4 columns */}
      {loading ? <Loading /> : productos.length === 0
        ? <EmptyState icon="⬡" text="Sin productos." />
        : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
          }}>
            {productos.map(p => (
              <ProductCard
                key={p.id}
                p={p}
                onEdit={() => setModalProd(p)}
                onDelete={() => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: () => eliminar(p.id) })}
                onLote={() => setModalLote(p)}
              />
            ))}
          </div>
        )
      }

      {/* Stats footer bar */}
      {!loading && productos.length > 0 && (
        <StatsFooter analisis={analyticsData} />
      )}
    </div>

    {modalProd !== null && <ModalProducto producto={modalProd} categorias={categorias} onClose={() => setModalProd(null)} onSaved={cargar} />}
    {modalLote && <ModalLote producto={modalLote} onClose={() => setModalLote(null)} onSaved={cargar} />}
    {modalCats && <ModalCategorias onClose={() => { setModalCats(false); cargarCategorias() }} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}

    <style>{`
      @media (max-width: 1200px) {
        .stock-product-grid { grid-template-columns: repeat(3, 1fr) !important; }
      }
      @media (max-width: 900px) {
        .stock-product-grid { grid-template-columns: repeat(2, 1fr) !important; }
      }
      @media (max-width: 600px) {
        .stock-product-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
  </>)
}
