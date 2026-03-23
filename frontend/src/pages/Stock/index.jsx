import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  productosApi,
  categoriasProductoApi,
  stockApi,
  sucursalesApi,
  finanzasApi,
} from '../../api/services'
import { Modal, Loading, EmptyState, ConfirmDialog, formatARS } from '../../components/ui'

// ─── Modal: Gestionar categorías ─────────────────────────────────────────────

function ModalCategorias({ onClose }) {
  const [categorias, setCategorias] = useState([])
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const cargar = () => categoriasProductoApi.listar().then(r => setCategorias(r.data)).catch(() => {})
  useEffect(() => { cargar() }, [])

  const crear = async () => {
    if (!nueva.trim()) return toast.error('Ingresá un nombre')
    try {
      await categoriasProductoApi.crear({ nombre: nueva.trim() })
      setNueva(''); cargar(); toast.success('Categoría creada')
    } catch (e) { toast.error(e.message || 'Error') }
  }

  const guardarEdicion = async () => {
    if (!editando?.nombre.trim()) return toast.error('El nombre no puede estar vacío')
    try {
      await categoriasProductoApi.actualizar(editando.id, { nombre: editando.nombre.trim() })
      setEditando(null); cargar(); toast.success('Categoría actualizada')
    } catch (e) { toast.error(e.message || 'Error') }
  }

  const eliminar = async (id) => {
    await categoriasProductoApi.eliminar(id); cargar(); toast.success('Categoría eliminada')
  }

  return (
    <Modal title="Gestionar categorías" onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Cerrar</button>}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input className="input" placeholder="Nueva categoría (ej: Magnesio)"
          value={nueva} onChange={e => setNueva(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && crear()} />
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
    nombre: producto?.nombre || '', marca: producto?.marca || '',
    categoria: producto?.categoria || '', imagen_url: producto?.imagen_url || ''
  })
  const [variantes, setVariantes] = useState(
    producto?.variantes?.length
      ? producto.variantes.filter(v => v.activa !== false).map(v => ({
          id: v.id,
          sabor: v.sabor || '',
          tamanio: v.tamanio || '',
          costo: v.costo ?? '',
          precio_venta: v.precio_venta ?? '',
          stock_minimo: v.stock_minimo ?? 0,
        }))
      : [{ sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }]
  )
  const [loading, setLoading] = useState(false)
  const [showVariantes, setShowVariantes] = useState(false)

  const addVar = () => setVariantes(v => [...v, { sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }])
  const rmVar = i => setVariantes(v => v.filter((_, idx) => idx !== i))
  const upVar = (i, f, v) => setVariantes(arr => arr.map((item, idx) => idx === i ? { ...item, [f]: v } : item))

  const submit = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    setLoading(true)
    try {
      if (isEdit) {
        await productosApi.actualizar(producto.id, form)
        if (showVariantes) {
          // Procesar variantes: eliminar, actualizar, crear
          const ops = []
          for (const v of variantes) {
            if (v._eliminada && v.id) {
              ops.push(productosApi.eliminarVariante(v.id))
            } else if (v.id) {
              ops.push(productosApi.actualizarVariante(v.id, {
                sabor: v.sabor || null,
                tamanio: v.tamanio || null,
                costo: parseFloat(v.costo) || 0,
                precio_venta: parseFloat(v.precio_venta) || 0,
                stock_minimo: parseInt(v.stock_minimo) || 0,
              }))
            } else {
              ops.push(productosApi.crearVariante(producto.id, {
                sabor: v.sabor || null,
                tamanio: v.tamanio || null,
                costo: parseFloat(v.costo) || 0,
                precio_venta: parseFloat(v.precio_venta) || 0,
                stock_minimo: parseInt(v.stock_minimo) || 0,
              }))
            }
          }
          await Promise.all(ops)
        }
        toast.success('Actualizado')
      } else {
        await productosApi.crear({ ...form, variantes })
        toast.success('Creado')
      }
      onSaved(); onClose()
    } catch (e) { toast.error(e.message || 'Error') } finally { setLoading(false) }
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
      <>
        <hr className="divider" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showVariantes ? 12 : 0 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowVariantes(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
              letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.2s',
              transform: showVariantes ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            Variantes ({variantes.length})
          </button>
          {showVariantes && <button className="btn btn-ghost btn-sm" onClick={addVar}>+ Agregar</button>}
        </div>
        {showVariantes && variantes.map((v, i) => (
          <div key={v.id || i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginBottom: 10,
            border: v._eliminada ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
            opacity: v._eliminada ? 0.5 : 1 }}>
            {v._eliminada ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {[v.sabor, v.tamanio].filter(Boolean).join(' · ') || `Variante ${i + 1}`} — <em>se eliminará al guardar</em>
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => upVar(i, '_eliminada', false)}>Deshacer</button>
              </div>
            ) : (
              <>
                <div className="grid-2" style={{ marginBottom: 8 }}>
                  <div><label className="input-label">Sabor</label><input className="input" value={v.sabor || ''} onChange={e => upVar(i, 'sabor', e.target.value)} /></div>
                  <div><label className="input-label">Tamaño</label><input className="input" value={v.tamanio || ''} onChange={e => upVar(i, 'tamanio', e.target.value)} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                  <div><label className="input-label">Costo $</label><input className="input" type="number" value={v.costo || ''} onChange={e => upVar(i, 'costo', e.target.value)} /></div>
                  <div><label className="input-label">Precio $</label><input className="input" type="number" value={v.precio_venta || ''} onChange={e => upVar(i, 'precio_venta', e.target.value)} /></div>
                  <div><label className="input-label">Stock mín.</label><input className="input" type="number" value={v.stock_minimo || 0} onChange={e => upVar(i, 'stock_minimo', e.target.value)} /></div>
                  <button className="btn btn-danger btn-sm" onClick={() => {
                    if (v.id) upVar(i, '_eliminada', true)
                    else rmVar(i)
                  }}>✕</button>
                </div>
              </>
            )}
          </div>
        ))}
      </>
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
    } catch (e) { toast.error(e.message || 'Error') } finally { setLoading(false) }
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

// ─── Panel de Filtros Avanzados ───────────────────────────────────────────────

function FiltrosPanel({ visible, onClose, filtros, onChange, sucursales, marcas, categorias }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!visible) return
    const handleClick = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [visible, onClose])

  if (!visible) return null

  const btnStyle = active => ({
    padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid rgba(255,152,0,0.5)' : '1px solid rgba(255,255,255,0.07)',
    background: active ? 'rgba(255,152,0,0.15)' : 'rgba(255,255,255,0.03)',
    color: active ? '#ff9800' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
  })

  const selectStyle = {
    width: '100%', padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    fontSize: 12, outline: 'none', cursor: 'pointer',
    appearance: 'none', WebkitAppearance: 'none',
  }

  const hayFiltros = Object.values(filtros).some(Boolean)

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 300, zIndex: 100,
      background: 'linear-gradient(145deg, rgba(18,25,45,0.99), rgba(22,30,52,0.98))',
      border: '1px solid rgba(255,152,0,0.2)', borderRadius: 16, padding: 20,
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
          Filtros avanzados
        </span>
        {hayFiltros && (
          <button onClick={() => onChange({ sucursalId: '', marca: '', categoria: '' })}
            style={{ background: 'none', border: 'none', color: '#ff9800', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}>
            Limpiar todo
          </button>
        )}
      </div>

      {/* Categoría */}
      {categorias.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Categoría</div>
          <div style={{ position: 'relative' }}>
            <select
              value={filtros.categoria}
              onChange={e => onChange({ ...filtros, categoria: e.target.value })}
              style={{ ...selectStyle, color: filtros.categoria ? '#f1f5f9' : 'rgba(255,255,255,0.35)' }}
            >
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 10, pointerEvents: 'none' }}>▼</span>
          </div>
        </div>
      )}

      {/* Marca */}
      {marcas.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Marca</div>
          <div style={{ position: 'relative' }}>
            <select
              value={filtros.marca}
              onChange={e => onChange({ ...filtros, marca: e.target.value })}
              style={{ ...selectStyle, color: filtros.marca ? '#f1f5f9' : 'rgba(255,255,255,0.35)' }}
            >
              <option value="">Todas las marcas</option>
              {marcas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 10, pointerEvents: 'none' }}>▼</span>
          </div>
        </div>
      )}

      {/* Sucursal — solo si hay más de una */}
      {sucursales.length > 1 && (
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sucursal</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[{ id: '', nombre: 'Todas' }, ...sucursales].map(s =>
              <button key={s.id} onClick={() => onChange({ ...filtros, sucursalId: s.id })} style={btnStyle(filtros.sucursalId === s.id)}>{s.nombre}</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Tarjeta de producto ──────────────────────────────────────────────────────

function ProductCard({ p, sucursales, onEdit, onLote, onDelete, onStockSaved }) {
  const [hovered, setHovered] = useState(false)
  const variantes = p.variantes?.filter(v => v.activa !== false) || []

  // stock_total viene del backend /stock (central + sucursales)
  const stockTotal = variantes.reduce((a, v) => a + (v.stock_total ?? v.stock_actual ?? 0), 0)
  const hayBajo = variantes.some(v => (v.stock_total ?? v.stock_actual ?? 0) <= v.stock_minimo)

  const costoMin = variantes.length ? Math.min(...variantes.map(v => Number(v.costo || 0))) : 0
  const precioMin = variantes.length ? Math.min(...variantes.map(v => Number(v.precio_venta || 0))) : 0
  const margen = costoMin > 0 && precioMin > 0 ? Math.round(((precioMin - costoMin) / precioMin) * 100) : 0

  const primerVar = variantes[0]
  const varLabel = primerVar ? [primerVar.sabor, primerVar.tamanio].filter(Boolean).join(' · ') : null
  const statusColor = stockTotal === 0 ? '#ef4444' : hayBajo ? '#fbbf24' : '#22c55e'

  // Inline stock editing state
  const [editingKey, setEditingKey] = useState(null) // "varId_sucId" | "varId_central"
  const [editingVal, setEditingVal] = useState('')
  const [savingKey, setSavingKey] = useState(null)

  const startEdit = (key, cantidad) => {
    setEditingKey(key)
    setEditingVal(String(cantidad))
  }

  const commitEdit = async (key, varianteId, sucursalId) => {
    const n = parseInt(editingVal, 10)
    if (isNaN(n) || n < 0) { setEditingKey(null); return }
    setSavingKey(key)
    setEditingKey(null)
    try {
      await stockApi.ajustarManual(varianteId, { cantidad: n, sucursal_id: sucursalId ?? null })
      onStockSaved()
    } catch (e) {
      toast.error(e.message || 'Error al guardar stock')
    } finally {
      setSavingKey(null)
    }
  }

  // Desglose de stock: todas las variantes × todas las sucursales
  // Items: { key, varianteId, sucursalId, label, cantidad, bajo, isCentral }
  const stockItems = (() => {
    if (variantes.length === 0) return []
    const items = []
    variantes.forEach((v, vi) => {
      const varPrefix = variantes.length > 1
        ? ([v.sabor, v.tamanio].filter(Boolean).join('/') || `V${vi + 1}`) + ' '
        : ''
      // Central
      const cQty = v.stock_central ?? v.stock_actual ?? 0
      items.push({
        key: `${v.id}_central`, varianteId: v.id, sucursalId: null,
        label: varPrefix + 'CTR', cantidad: cQty,
        bajo: cQty <= v.stock_minimo, isCentral: true,
      })
      // Sucursales de venta
      sucursales.filter(s => !s.es_central).forEach(s => {
        const ss = v.stocks_sucursal?.find(x => x.sucursal_id === s.id)
        const qty = ss?.cantidad ?? 0
        items.push({
          key: `${v.id}_${s.id}`, varianteId: v.id, sucursalId: s.id,
          label: varPrefix + s.nombre.slice(0, 3).toUpperCase(), cantidad: qty,
          bajo: qty === 0, isCentral: false,
        })
      })
    })
    return items
  })()

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
        borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,152,0,0.08), 0 8px 20px rgba(255,152,0,0.07)'
          : '0 2px 12px rgba(0,0,0,0.3)',
        cursor: 'default', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        background: hovered ? 'radial-gradient(ellipse at top left, rgba(255,152,0,0.05), transparent 60%)' : 'none',
        transition: 'all 0.2s' }} />

      {/* Botones acción */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', zIndex: 2 }}>
        {[
          { label: '%', title: 'Ajuste de precios', action: onLote, hoverColor: '#ff9800' },
          { label: '✎', title: 'Editar', action: onEdit, hoverColor: '#ff9800' },
          { label: '✕', title: 'Eliminar', action: onDelete, hoverColor: '#ef4444' },
        ].map(btn => (
          <button key={btn.label} title={btn.title} onClick={btn.action}
            onMouseEnter={e => { e.currentTarget.style.color = btn.hoverColor; e.currentTarget.style.borderColor = btn.hoverColor + '55' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            style={{ background: 'rgba(10,16,36,0.9)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
              fontSize: 12, transition: 'all 0.15s', backdropFilter: 'blur(8px)' }}>{btn.label}</button>
        ))}
      </div>

      {/* Nombre + estado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 90 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', lineHeight: 1.3, flex: 1 }}>{p.nombre}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor,
          flexShrink: 0, marginTop: 4, boxShadow: `0 0 8px ${statusColor}` }} />
      </div>

      {/* Marca + variante */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {p.marca && (
          <span style={{ background: 'rgba(255,152,0,0.12)', color: '#ffb74d',
            border: '1px solid rgba(255,152,0,0.22)', borderRadius: 6, fontSize: 9,
            fontWeight: 700, padding: '2px 8px', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{p.marca}</span>
        )}
        {varLabel && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {varLabel}{variantes.length > 1 ? ` +${variantes.length - 1}` : ''}
          </span>
        )}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '2px 0' }} />

      {/* Precios + margen */}
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
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#ff9800',
            background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.18)',
            borderRadius: 6, padding: '2px 7px' }}>{margen}%</span>
        )}
      </div>

      {/* Stock por sucursal — inline editable */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 0' }}>
        {stockItems.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              color: item.bajo ? '#ef4444' : item.isCentral ? 'rgba(255,152,0,0.6)' : 'rgba(255,255,255,0.28)',
            }}>
              {item.bajo ? '●' : '○'} {item.label}
            </span>
            {editingKey === item.key ? (
              <input
                autoFocus
                type="number" min="0"
                value={editingVal}
                onChange={e => setEditingVal(e.target.value)}
                onBlur={() => commitEdit(item.key, item.varianteId, item.sucursalId)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(item.key, item.varianteId, item.sucursalId)
                  if (e.key === 'Escape') setEditingKey(null)
                }}
                style={{
                  width: 44, padding: '1px 4px', textAlign: 'center',
                  background: 'rgba(255,152,0,0.12)', border: '1px solid rgba(255,152,0,0.5)',
                  borderRadius: 6, color: '#ff9800', fontFamily: 'Syne, sans-serif',
                  fontSize: 13, fontWeight: 700, outline: 'none',
                }}
              />
            ) : (
              <span
                title="Click para editar"
                onClick={() => startEdit(item.key, item.cantidad)}
                style={{
                  fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif',
                  color: savingKey === item.key ? 'rgba(255,152,0,0.5)'
                       : item.bajo ? '#ef4444' : 'rgba(255,255,255,0.82)',
                  cursor: 'text',
                  borderBottom: '1px dashed rgba(255,255,255,0.15)',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ff9800'; e.currentTarget.style.borderBottomColor = 'rgba(255,152,0,0.5)' }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = savingKey === item.key ? 'rgba(255,152,0,0.5)' : item.bajo ? '#ef4444' : 'rgba(255,255,255,0.82)'
                  e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.15)'
                }}
              >
                {savingKey === item.key ? '…' : item.cantidad}
              </span>
            )}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>total</span>
          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Syne, sans-serif',
            color: stockTotal === 0 ? '#ef4444' : '#f1f5f9' }}>{stockTotal}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Footer: Ingresos del día / Tendencia / Margen ───────────────────────────

function StockFooter({ resumenDia, loadingResumen }) {
  const ingresosHoy = resumenDia?.ingresos_hoy ?? 0
  const delta = resumenDia?.delta_hoy ?? null
  const tendencia = resumenDia?.tendencia_mensual ?? []
  const margenPromedio = resumenDia?.margen_promedio ?? 0

  const sparkPoints = tendencia.length >= 2 ? tendencia : [0, 10, 5, 20, 15, 30, 25, 40, 35, 50, 42, 55]
  const sparkMax = Math.max(...sparkPoints, 1)
  const sparkMin = Math.min(...sparkPoints, 0)
  const range = sparkMax - sparkMin || 1
  const W = 220; const H = 38
  const pts = sparkPoints.map((v, i) => {
    const x = (i / (sparkPoints.length - 1)) * W
    const y = H - ((v - sparkMin) / range) * (H - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{
      margin: '24px 0 8px', borderRadius: 20,
      background: 'linear-gradient(135deg, rgba(15,22,41,0.97) 0%, rgba(26,32,53,0.92) 100%)',
      border: '1px solid rgba(255,152,0,0.15)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>

        {/* Ingresos del día */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(255,152,0,0.2), rgba(255,152,0,0.08))',
            border: '1px solid rgba(255,152,0,0.25)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20, flexShrink: 0, color: '#ff9800' }}>$</div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Ingresos del día
            </div>
            {loadingResumen
              ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Cargando...</div>
              : <>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#f1f5f9', lineHeight: 1 }}>
                    {formatARS(ingresosHoy)}
                  </div>
                  {delta !== null && (
                    <div style={{ fontSize: 11, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{
                        background: delta >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: delta >= 0 ? '#22c55e' : '#ef4444',
                        borderRadius: 999, padding: '1px 8px', fontWeight: 700,
                      }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>vs ayer</span>
                    </div>
                  )}
                </>
            }
          </div>
        </div>

        {/* Tendencia mensual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Tendencia mensual
            </div>
            {loadingResumen
              ? <div style={{ height: H, display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Cargando...</div>
                </div>
              : <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="sk-g-stock" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ff9800" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#ffb74d" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  <polyline points={pts} fill="none" stroke="url(#sk-g-stock)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            }
            {!loadingResumen && tendencia.length > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                {tendencia.length} días registrados este mes
              </div>
            )}
          </div>
        </div>

        {/* Margen promedio */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(255,152,0,0.2), rgba(255,152,0,0.08))',
            border: '1px solid rgba(255,152,0,0.25)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>◇</div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Margen Promedio
            </div>
            {loadingResumen
              ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Cargando...</div>
              : <>
                  <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#ff9800', lineHeight: 1 }}>
                    {margenPromedio}%
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                    global · todas las variantes
                  </div>
                </>
            }
          </div>
        </div>
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
  const [loadingResumen, setLoadingResumen] = useState(true)
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [marcas, setMarcas] = useState([])
  const [filtros, setFiltros] = useState({
    sucursalId: '',
    marca: '',
    categoria: '',
  })
  const [showFiltros, setShowFiltros] = useState(false)

  const [modalProd, setModalProd] = useState(null)
  const [modalLote, setModalLote] = useState(null)
  const [modalCats, setModalCats] = useState(false)
  const [confirm, setConfirm] = useState(null)

  // Carga inicial: categorías, sucursales y resumen del día en paralelo
  useEffect(() => {
    categoriasProductoApi.listar().then(r => setCategorias(r.data)).catch(() => {})
    sucursalesApi.listar().then(r => setSucursales(r.data)).catch(() => {})
    stockApi.marcas().then(r => setMarcas(r.data)).catch(() => {})
    finanzasApi.resumenDia()
      .then(r => setResumenDia(r.data))
      .catch(() => {})
      .finally(() => setLoadingResumen(false))
  }, [])

  // Carga de productos via /stock — incluye desglose por sucursal
  const cargar = useCallback(() => {
    setLoading(true)
    const params = {}
    if (busqueda) params.busqueda = busqueda
    if (filtros.categoria) params.categoria = filtros.categoria
    if (filtros.marca) params.marca = filtros.marca
    if (filtros.sucursalId) params.sucursal_id = filtros.sucursalId

    stockApi.listar(params)
      .then(r => setProductos(r.data))
      .catch(() => toast.error('Error al cargar productos'))
      .finally(() => setLoading(false))
  }, [busqueda, filtros.categoria, filtros.marca, filtros.sucursalId])

  useEffect(() => { cargar() }, [cargar])

  const productosFiltrados = productos

  const eliminar = async id => {
    await productosApi.eliminar(id); toast.success('Eliminado'); cargar()
  }

  const recargarCategorias = () => categoriasProductoApi.listar().then(r => setCategorias(r.data)).catch(() => {})

  const categoriasFiltro = [
    'Todo',
    ...[...categorias]
      .filter(c => c.nombre.toLowerCase() !== 'otras')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(c => c.nombre),
    ...(categorias.some(c => c.nombre.toLowerCase() === 'otras') ? ['Otras'] : [])
  ]

  const filtrosActivos = Object.values(filtros).filter(Boolean).length

  return (<>
    {/* ── Topbar ── */}
    <div className="topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="page-title" style={{ fontSize: 22, fontWeight: 800 }}>Gestion de Inventario</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          {productosFiltrados.length} productos en {categorias.length} categorías
        </div>
      </div>
      <div className="topbar-actions">
        <button className="btn btn-ghost" onClick={() => setModalCats(true)}>Categorías</button>
        <button className="btn btn-primary" onClick={() => setModalProd({})}>+ Nuevo producto</button>
      </div>
    </div>

    <div className="page-content">

      {/* ── Search bar + botón filtros avanzados ── */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(255,255,255,0.25)', fontSize: 16, pointerEvents: 'none' }}>⌕</span>

          <input
            style={{ width: '100%', padding: '13px 52px 13px 44px',
              background: 'rgba(15,22,41,0.8)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, color: '#f1f5f9', fontSize: 14, outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s' }}
            placeholder="Buscar productos, marcas, categorías..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onFocus={e => { e.target.style.borderColor = 'rgba(255,152,0,0.35)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,152,0,0.08)' }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none' }}
          />

          {/* Botón filtros avanzados */}
          <button
            onClick={() => setShowFiltros(v => !v)}
            title="Filtros avanzados"
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              width: 34, height: 34, borderRadius: 9, cursor: 'pointer',
              background: showFiltros || filtrosActivos > 0 ? 'rgba(255,152,0,0.15)' : 'rgba(255,255,255,0.04)',
              border: showFiltros || filtrosActivos > 0 ? '1px solid rgba(255,152,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: showFiltros || filtrosActivos > 0 ? '#ff9800' : 'rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {filtrosActivos > 0
              ? <span style={{ background: '#ff9800', color: '#000', borderRadius: '50%',
                  width: 16, height: 16, fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filtrosActivos}</span>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 3h12M3 7h8M5 11h4" />
                </svg>
            }
          </button>
        </div>

        {/* Panel de filtros avanzados */}
        <FiltrosPanel
          visible={showFiltros}
          onClose={() => setShowFiltros(false)}
          filtros={filtros}
          onChange={setFiltros}
          sucursales={sucursales}
          marcas={marcas}
          categorias={categorias}
        />
      </div>

      {/* ── Filtros por categoría ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {categoriasFiltro.map(cat => {
          const isActive = cat === 'Todo' ? !filtros.categoria : filtros.categoria === cat
          return (
            <button key={cat}
              onClick={() => setFiltros(f => ({ ...f, categoria: cat === 'Todo' ? '' : cat }))}
              style={{
                padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                border: isActive ? '1px solid rgba(255,152,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? 'rgba(255,152,0,0.15)' : 'rgba(15,22,41,0.6)',
                color: isActive ? '#ff9800' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >{cat}</button>
          )
        })}
      </div>

      {/* ── Grilla de tarjetas ── */}
      {loading
        ? <Loading />
        : productosFiltrados.length === 0
          ? <EmptyState icon="⬡" text="Sin productos." />
          : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
                {productosFiltrados.map(p => (
                  <ProductCard
                    key={p.id} p={p} sucursales={sucursales}
                    onEdit={() => setModalProd(p)}
                    onLote={() => setModalLote(p)}
                    onStockSaved={cargar}
                    onDelete={() => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: () => eliminar(p.id) })}
                  />
                ))}
              </div>
              <StockFooter resumenDia={resumenDia} loadingResumen={loadingResumen} />
            </>
          )
      }
    </div>

    {modalProd !== null && <ModalProducto producto={modalProd} categorias={categorias} onClose={() => setModalProd(null)} onSaved={cargar} />}
    {modalLote && <ModalLote producto={modalLote} onClose={() => setModalLote(null)} onSaved={cargar} />}
    {modalCats && <ModalCategorias onClose={() => { setModalCats(false); recargarCategorias() }} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
  </>)
}
