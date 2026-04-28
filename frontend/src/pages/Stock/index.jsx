import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { productosApi, categoriasProductoApi, stockApi, sucursalesApi, finanzasApi } from '../../api/services'
import { Modal, Loading, EmptyState, ConfirmDialog, formatARS } from '../../components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtN = (n) => Number(n ?? 0).toLocaleString('es-AR')

const stockColor = (qty, minimo) => {
  if (qty < 0)        return { fg: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)' }
  if (qty === 0)      return { fg: '#ef4444', bg: 'rgba(239,68,68,0.09)', border: 'rgba(239,68,68,0.20)' }
  if (qty <= minimo)  return { fg: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.28)' }
  return                     { fg: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.22)'  }
}

// ─── Chip de sucursal ─────────────────────────────────────────────────────────
// Puede ser editable (onClick para abrir input inline)

function SucChip({ label, qty, minimo, editable, onEdit }) {
  const c = stockColor(qty, minimo)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.28)' }}>
        {label}
      </span>
      <span
        onClick={editable ? onEdit : undefined}
        title={editable ? 'Click para editar' : undefined}
        style={{
          minWidth: 30, height: 24, borderRadius: 999,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px',
          background: c.bg, color: c.fg, fontSize: 12, fontWeight: 700,
          border: `1px solid ${c.border}`,
          cursor: editable ? 'text' : 'default',
          transition: 'all 0.12s',
          userSelect: 'none',
        }}
        onMouseEnter={e => { if (editable) { e.currentTarget.style.background = 'rgba(255,152,0,0.18)'; e.currentTarget.style.color = '#ff9800'; e.currentTarget.style.borderColor = 'rgba(255,152,0,0.45)' } }}
        onMouseLeave={e => { if (editable) { e.currentTarget.style.background = c.bg; e.currentTarget.style.color = c.fg; e.currentTarget.style.borderColor = c.border } }}
      >
        {fmtN(qty)}
      </span>
    </div>
  )
}

// ─── Modal: Transferir stock ──────────────────────────────────────────────────

function ModalTransferencia({ variante, productoNombre, sucursales, onClose, onSaved }) {
  const [origenId, setOrigenId]   = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [cantidad, setCantidad]   = useState(1)
  const [notas, setNotas]         = useState('')
  const [loading, setLoading]     = useState(false)

  const stockOrigen = (() => {
    if (!origenId) return 0
    return (variante.stocks_sucursal || []).find(s => String(s.sucursal_id) === String(origenId))?.cantidad ?? 0
  })()

  const conStock  = sucursales.filter(s => ((variante.stocks_sucursal || []).find(x => x.sucursal_id === s.id)?.cantidad ?? 0) > 0)
  const destinos  = sucursales.filter(s => String(s.id) !== String(origenId))
  const nomSuc    = id => sucursales.find(s => String(s.id) === String(id))?.nombre ?? id
  const canOk     = origenId && destinoId && cantidad >= 1 && cantidad <= stockOrigen && !loading

  const confirmar = async () => {
    if (!canOk) return
    setLoading(true)
    try {
      await stockApi.transferir({ variante_id: variante.id, sucursal_origen_id: Number(origenId), sucursal_destino_id: Number(destinoId), cantidad: Number(cantidad), notas: notas || null })
      toast.success(`${cantidad} ud${cantidad > 1 ? 's' : ''} transferidas`)
      onSaved(); onClose()
    } catch (e) { toast.error(e?.response?.data?.detail || e.message || 'Error al transferir') }
    finally { setLoading(false) }
  }

  const varLabel = [variante.sabor, variante.tamanio].filter(Boolean).join(' · ') || 'Variante única'
  const sel = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f1f5f9', fontSize: 13, outline: 'none', appearance: 'none', cursor: 'pointer' }

  return (
    <Modal title="Transferir stock" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={confirmar} disabled={!canOk}>{loading ? 'Transfiriendo...' : 'Confirmar'}</button></>}
    >
      <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{productoNombre}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>{varLabel}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(variante.stocks_sucursal || []).map(ss => {
            const c = stockColor(ss.cantidad, variante.stock_minimo)
            return <span key={ss.sucursal_id} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: c.bg, border: `1px solid ${c.border}`, color: c.fg }}>{ss.sucursal_nombre}: {fmtN(ss.cantidad)}</span>
          })}
        </div>
      </div>

      <div className="form-group">
        <label className="input-label">Desde</label>
        <select style={sel} value={origenId} onChange={e => { setOrigenId(e.target.value); setDestinoId(''); setCantidad(1) }}>
          <option value="">Seleccioná origen...</option>
          {conStock.map(s => { const ss = (variante.stocks_sucursal || []).find(x => x.sucursal_id === s.id); return <option key={s.id} value={s.id}>{s.nombre}{s.es_central ? ' (Central)' : ''} — {ss?.cantidad ?? 0} uds</option> })}
        </select>
      </div>
      <div className="form-group">
        <label className="input-label">Hacia</label>
        <select style={sel} value={destinoId} onChange={e => setDestinoId(e.target.value)} disabled={!origenId}>
          <option value="">Seleccioná destino...</option>
          {destinos.map(s => <option key={s.id} value={s.id}>{s.nombre}{s.es_central ? ' (Central)' : ''}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="input-label">Cantidad</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setCantidad(c => Math.max(1, c - 1))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9', cursor: 'pointer', fontSize: 18 }}>−</button>
          <input type="number" min={1} max={stockOrigen} value={cantidad} onChange={e => setCantidad(Math.max(1, Number(e.target.value)))} style={{ ...sel, textAlign: 'center', width: 80 }} />
          <button onClick={() => setCantidad(c => Math.min(stockOrigen, c + 1))} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#f1f5f9', cursor: 'pointer', fontSize: 18 }}>+</button>
          {origenId && <button onClick={() => setCantidad(stockOrigen)} style={{ background: 'none', border: 'none', color: '#ff9800', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Todo ({fmtN(stockOrigen)})</button>}
        </div>
        {cantidad > stockOrigen && origenId && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠ Supera el disponible ({fmtN(stockOrigen)})</div>}
      </div>
      <div className="form-group">
        <label className="input-label">Notas (opcional)</label>
        <input style={sel} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: reposición semanal" />
      </div>
      {canOk && (
        <div style={{ textAlign: 'center', padding: '10px 14px', background: 'rgba(255,152,0,0.07)', border: '1px solid rgba(255,152,0,0.18)', borderRadius: 10, fontSize: 13 }}>
          <strong style={{ color: '#f1f5f9' }}>{nomSuc(origenId)}</strong>
          <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 10px' }}>→</span>
          <strong style={{ color: '#f1f5f9' }}>{nomSuc(destinoId)}</strong>
          <span style={{ color: '#ff9800', fontWeight: 700, marginLeft: 10 }}>× {fmtN(cantidad)}</span>
        </div>
      )}
    </Modal>
  )
}

// ─── Modal: Categorías ────────────────────────────────────────────────────────

function ModalCategorias({ onClose }) {
  const [cats, setCats]         = useState([])
  const [nueva, setNueva]       = useState('')
  const [editando, setEditando] = useState(null)
  const [confirm, setConfirm]   = useState(null)

  const cargar = () => categoriasProductoApi.listar().then(r => setCats(r.data)).catch(() => {})
  useEffect(() => { cargar() }, [])

  const crear = async () => {
    if (!nueva.trim()) return toast.error('Ingresá un nombre')
    try { await categoriasProductoApi.crear({ nombre: nueva.trim() }); setNueva(''); cargar(); toast.success('Categoría creada') }
    catch (e) { toast.error(e.message || 'Error') }
  }
  const guardar = async () => {
    if (!editando?.nombre.trim()) return toast.error('El nombre no puede estar vacío')
    try { await categoriasProductoApi.actualizar(editando.id, { nombre: editando.nombre.trim() }); setEditando(null); cargar(); toast.success('Actualizada') }
    catch (e) { toast.error(e.message || 'Error') }
  }
  const eliminar = async (id) => { await categoriasProductoApi.eliminar(id); cargar(); toast.success('Eliminada') }

  return (
    <Modal title="Gestionar categorías" onClose={onClose} footer={<button className="btn btn-ghost" onClick={onClose}>Cerrar</button>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input className="input" placeholder="Nueva categoría..." value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crear()} />
        <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={crear}>+ Agregar</button>
      </div>
      {cats.length === 0
        ? <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Sin categorías</p>
        : cats.map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {editando?.id === cat.id ? (
              <><input className="input" style={{ flex: 1 }} value={editando.nombre} autoFocus onChange={e => setEditando(ed => ({ ...ed, nombre: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(null) }} /><button className="btn btn-primary btn-sm" onClick={guardar}>✓</button><button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>✕</button></>
            ) : (
              <><span style={{ flex: 1, fontSize: 14 }}>{cat.nombre}</span><button className="btn btn-ghost btn-xs" onClick={() => setEditando({ id: cat.id, nombre: cat.nombre })}>Editar</button><button className="btn btn-danger btn-xs" onClick={() => setConfirm({ msg: `¿Eliminar "${cat.nombre}"?`, fn: () => eliminar(cat.id) })}>✕</button></>
            )}
          </div>
        ))
      }
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
    </Modal>
  )
}

// ─── Modal: Producto ──────────────────────────────────────────────────────────

function ModalProducto({ producto, categorias, onClose, onSaved }) {
  const isEdit = !!producto?.id
  const [form, setForm]   = useState({ nombre: producto?.nombre || '', marca: producto?.marca || '', categoria: producto?.categoria || '', imagen_url: producto?.imagen_url || '' })
  const [vars, setVars]   = useState(producto?.variantes?.filter(v => v.activa !== false).map(v => ({ id: v.id, sabor: v.sabor || '', tamanio: v.tamanio || '', costo: v.costo ?? '', precio_venta: v.precio_venta ?? '', stock_minimo: v.stock_minimo ?? 0 })) || [{ sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }])
  const [loading, setLoading]   = useState(false)
  const [showVars, setShowVars] = useState(false)

  const norm = v => ({ sabor: v.sabor || null, tamanio: v.tamanio || null, costo: parseFloat(v.costo) || 0, precio_venta: parseFloat(v.precio_venta) || 0, stock_minimo: parseInt(v.stock_minimo) || 0 })
  const upVar = (i, f, v) => setVars(arr => arr.map((item, idx) => idx === i ? { ...item, [f]: v } : item))

  const submit = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    setLoading(true)
    try {
      if (isEdit) {
        await productosApi.actualizar(producto.id, form)
        if (showVars) await Promise.all(vars.map(v => v._eliminada && v.id ? productosApi.eliminarVariante(v.id) : v.id ? productosApi.actualizarVariante(v.id, norm(v)) : productosApi.crearVariante(producto.id, norm(v))))
        toast.success('Actualizado')
      } else { await productosApi.crear({ ...form, variantes: vars.map(norm) }); toast.success('Creado') }
      onSaved(); onClose()
    } catch (e) { toast.error(e.message || 'Error') } finally { setLoading(false) }
  }

  return (
    <Modal title={isEdit ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} size="modal-lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button></>}
    >
      <div className="grid-2"><div className="form-group"><label className="input-label">Nombre *</label><input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div><div className="form-group"><label className="input-label">Marca</label><input className="input" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} /></div></div>
      <div className="grid-2"><div className="form-group"><label className="input-label">Categoría</label><select className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}><option value="">Seleccionar...</option>{categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div><div className="form-group"><label className="input-label">URL imagen</label><input className="input" value={form.imagen_url} onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))} /></div></div>
      <hr className="divider" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showVars ? 12 : 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowVars(v => !v)} style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: showVars ? 'rotate(90deg)' : 'none' }}>▶</span> Variantes ({vars.length})
        </button>
        {showVars && <button className="btn btn-ghost btn-sm" onClick={() => setVars(v => [...v, { sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0 }])}>+ Agregar</button>}
      </div>
      {showVars && vars.map((v, i) => (
        <div key={v.id || i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, marginBottom: 10, border: v._eliminada ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent', opacity: v._eliminada ? 0.5 : 1 }}>
          {v._eliminada
            ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{[v.sabor, v.tamanio].filter(Boolean).join(' · ') || `Variante ${i + 1}`} — <em>se eliminará</em></span><button className="btn btn-ghost btn-sm" onClick={() => upVar(i, '_eliminada', false)}>Deshacer</button></div>
            : <><div className="grid-2" style={{ marginBottom: 8 }}><div><label className="input-label">Sabor</label><input className="input" value={v.sabor || ''} onChange={e => upVar(i, 'sabor', e.target.value)} /></div><div><label className="input-label">Tamaño</label><input className="input" value={v.tamanio || ''} onChange={e => upVar(i, 'tamanio', e.target.value)} /></div></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}><div><label className="input-label">Costo $</label><input className="input" type="number" value={v.costo || ''} onChange={e => upVar(i, 'costo', e.target.value)} /></div><div><label className="input-label">Precio $</label><input className="input" type="number" value={v.precio_venta || ''} onChange={e => upVar(i, 'precio_venta', e.target.value)} /></div><div><label className="input-label">Mín.</label><input className="input" type="number" value={v.stock_minimo || 0} onChange={e => upVar(i, 'stock_minimo', e.target.value)} /></div><button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (v.id) upVar(i, '_eliminada', true); else setVars(arr => arr.filter((_, idx) => idx !== i)) }}>✕</button></div></>
          }
        </div>
      ))}
    </Modal>
  )
}

// ─── Modal: Ajuste de precios por lote ───────────────────────────────────────

function ModalLote({ producto, onClose, onSaved }) {
  const [modo, setModo]   = useState('porcentaje')
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const modos = [{ key: 'porcentaje', label: '+/- %' }, { key: 'margen_deseado', label: 'Margen %' }, { key: 'precio_fijo', label: 'Precio fijo $' }]
  const aplicar = async () => {
    if (!valor) return toast.error('Ingresá un valor')
    setLoading(true)
    try { await productosApi.ajustarPrecioLote({ producto_id: producto.id, modo, valor: parseFloat(valor) }); toast.success('Precios actualizados'); onSaved(); onClose() }
    catch (e) { toast.error(e.message || 'Error') } finally { setLoading(false) }
  }
  return (
    <Modal title={`Ajuste de precios — ${producto.nombre}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={aplicar} disabled={loading}>{loading ? 'Aplicando...' : 'Aplicar a todas'}</button></>}
    >
      <div style={{ marginBottom: 20 }}>
        <label className="input-label">Modo</label>
        <div style={{ display: 'flex', gap: 8 }}>{modos.map(m => <button key={m.key} className={`btn btn-sm ${modo === m.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setModo(m.key)}>{m.label}</button>)}</div>
      </div>
      <div className="form-group"><label className="input-label">Valor</label><input className="input" type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder={modo === 'precio_fijo' ? 'Ej: 28000' : 'Ej: 15'} /></div>
      <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>Afecta <strong style={{ color: 'var(--text)' }}>{producto.variantes?.length || 0} variantes</strong> activas</div>
    </Modal>
  )
}

// ─── Fila de variante (expandida) ────────────────────────────────────────────

function VarianteRow({ variante, sucursales, productoNombre, onStockSaved, onTransfer }) {
  const [editingKey, setEditingKey] = useState(null)
  const [editingVal, setEditingVal] = useState('')
  const [savingKey, setSavingKey]   = useState(null)

  const startEdit = (key, qty) => { setEditingKey(key); setEditingVal(String(qty)) }
  const commitEdit = async (key, varianteId, sucursalId) => {
    const n = parseInt(editingVal, 10)
    if (isNaN(n)) { setEditingKey(null); return }
    setSavingKey(key); setEditingKey(null)
    try { await stockApi.ajustarManual(varianteId, { cantidad: n, sucursal_id: sucursalId ?? null }); onStockSaved() }
    catch (e) { toast.error(e.message || 'Error al guardar') } finally { setSavingKey(null) }
  }

  const varLabel = [variante.sabor, variante.tamanio].filter(Boolean).join(' · ') || 'Sin variante'
  const margen = variante.costo > 0 && variante.precio_venta > 0
    ? Math.round(((variante.precio_venta - variante.costo) / variante.precio_venta) * 100) : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, padding: '9px 14px 9px 54px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        {/* Etiqueta */}
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, minWidth: 80 }}>{varLabel}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          {formatARS(variante.precio_venta)}
          {margen !== null && <span style={{ color: '#ff9800', marginLeft: 5, fontWeight: 600 }}>{margen}%</span>}
        </span>

        {/* Chips editables */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sucursales.map(s => {
            const ss = (variante.stocks_sucursal || []).find(x => x.sucursal_id === s.id)
            const qty = ss?.cantidad ?? 0
            const key = `${variante.id}_${s.id}`
            const isSaving = savingKey === key
            const shortNom = s.nombre.length > 7 ? s.nombre.slice(0, 6) + '.' : s.nombre
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.28)' }}>{shortNom}</span>
                {editingKey === key ? (
                  <input autoFocus type="number" min="0" value={editingVal}
                    onChange={e => setEditingVal(e.target.value)}
                    onBlur={() => commitEdit(key, variante.id, s.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(key, variante.id, s.id); if (e.key === 'Escape') setEditingKey(null) }}
                    style={{ width: 44, padding: '2px 5px', textAlign: 'center', background: 'rgba(255,152,0,0.15)', border: '1px solid rgba(255,152,0,0.5)', borderRadius: 999, color: '#ff9800', fontSize: 11, fontWeight: 700, outline: 'none' }}
                  />
                ) : (
                  <SucChip label="" qty={isSaving ? undefined : qty} minimo={variante.stock_minimo} editable={!isSaving} onEdit={() => startEdit(key, qty)} />
                )}
                {isSaving && <span style={{ fontSize: 10, color: '#ff9800' }}>…</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Botón mover */}
      <button onClick={() => onTransfer(variante)}
        style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid rgba(255,152,0,0.2)', background: 'rgba(255,152,0,0.06)', color: 'rgba(255,152,0,0.7)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,152,0,0.18)'; e.currentTarget.style.color = '#ff9800' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,152,0,0.06)'; e.currentTarget.style.color = 'rgba(255,152,0,0.7)' }}
      >⇄ Mover</button>
    </div>
  )
}

// ─── Fila de producto ─────────────────────────────────────────────────────────

function ProductRow({ p, sucursales, onEdit, onLote, onDelete, onStockSaved }) {
  const [expanded, setExpanded]         = useState(false)
  const [transferVar, setTransferVar]   = useState(null)
  const [editingKey, setEditingKey]     = useState(null)
  const [editingVal, setEditingVal]     = useState('')
  const [savingKey, setSavingKey]       = useState(null)

  const variantes  = p.variantes?.filter(v => v.activa !== false) || []
  const esSingle   = variantes.length === 1
  const v0         = variantes[0]

  const stockTotal  = variantes.reduce((a, v) => a + (v.stocks_sucursal || []).reduce((s, ss) => s + ss.cantidad, 0), 0)
  const hayAlerta   = variantes.some(v => (v.stocks_sucursal || []).some(ss => ss.cantidad <= v.stock_minimo && ss.cantidad >= 0))
  const hayNegativo = variantes.some(v => (v.stocks_sucursal || []).some(ss => ss.cantidad < 0))

  const precioMin = variantes.length ? Math.min(...variantes.map(v => Number(v.precio_venta || 0))) : 0
  const costoMin  = variantes.length ? Math.min(...variantes.map(v => Number(v.costo || 0))) : 0
  const margen    = costoMin > 0 && precioMin > 0 ? Math.round(((precioMin - costoMin) / precioMin) * 100) : null

  // Stock por sucursal (agrupado para multi-variante)
  const stockPorSuc = sucursales.map(s => ({
    ...s,
    total: variantes.reduce((sum, v) => sum + ((v.stocks_sucursal || []).find(x => x.sucursal_id === s.id)?.cantidad ?? 0), 0),
    bajo:  variantes.some(v => { const ss = (v.stocks_sucursal || []).find(x => x.sucursal_id === s.id); return (ss?.cantidad ?? 0) <= v.stock_minimo }),
  }))

  // Edición inline para variante única
  const startEdit = (key, qty) => { setEditingKey(key); setEditingVal(String(qty)) }
  const commitEdit = async (key, varId, sucId) => {
    const n = parseInt(editingVal, 10)
    if (isNaN(n)) { setEditingKey(null); return }
    setSavingKey(key); setEditingKey(null)
    try { await stockApi.ajustarManual(varId, { cantidad: n, sucursal_id: sucId ?? null }); onStockSaved() }
    catch (e) { toast.error(e.message || 'Error') } finally { setSavingKey(null) }
  }

  const shortNom = (nombre) => nombre.length > 8 ? nombre.slice(0, 7) + '.' : nombre

  // Color del borde de la card
  const borderColor = hayNegativo ? 'rgba(239,68,68,0.22)' : hayAlerta ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)'
  const statusDot   = hayNegativo ? '#ef4444' : hayAlerta ? '#fbbf24' : stockTotal === 0 ? '#ef4444' : '#22c55e'

  return (
    <>
      <div style={{ background: 'rgba(15,22,41,0.75)', border: `1px solid ${borderColor}`, borderRadius: 14, marginBottom: 6, overflow: 'hidden', transition: 'border-color 0.2s' }}>

        {/* ── Fila principal ── */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto', alignItems: 'center', minHeight: 66, cursor: !esSingle ? 'pointer' : 'default', padding: '0 10px 0 0' }}
          onClick={() => !esSingle && setExpanded(e => !e)}
        >
          {/* Toggle / dot */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!esSingle
              ? <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none', userSelect: 'none' }}>▶</span>
              : <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot, display: 'block', boxShadow: `0 0 7px ${statusDot}88` }} />
            }
          </div>

          {/* Info producto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', minWidth: 0 }} onClick={e => e.stopPropagation()}>
            {/* Thumbnail */}
            <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {p.imagen_url
                ? <img src={p.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                : <span style={{ fontSize: 18, opacity: 0.2 }}>◉</span>
              }
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              {/* Nombre + badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 7 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{p.nombre}</span>
                {p.marca && <span style={{ background: 'rgba(255,152,0,0.1)', color: '#ffb74d', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>{p.marca}</span>}
                {p.categoria && <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>{p.categoria}</span>}
                {!esSingle && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>{variantes.length} variantes</span>}
              </div>

              {/* Chips de stock — siempre visibles, editables si es variante única */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {esSingle
                  ? sucursales.map(s => {
                      const ss = (v0.stocks_sucursal || []).find(x => x.sucursal_id === s.id)
                      const qty = ss?.cantidad ?? 0
                      const key = `${v0.id}_${s.id}`
                      const isSaving = savingKey === key
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.28)' }}>{shortNom(s.nombre)}</span>
                          {editingKey === key ? (
                            <input autoFocus type="number" min="0" value={editingVal}
                              onChange={e => setEditingVal(e.target.value)}
                              onBlur={() => commitEdit(key, v0.id, s.id)}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit(key, v0.id, s.id); if (e.key === 'Escape') setEditingKey(null) }}
                              style={{ width: 44, padding: '2px 5px', textAlign: 'center', background: 'rgba(255,152,0,0.15)', border: '1px solid rgba(255,152,0,0.5)', borderRadius: 999, color: '#ff9800', fontSize: 12, fontWeight: 700, outline: 'none' }}
                            />
                          ) : (
                            <SucChip label="" qty={isSaving ? 0 : qty} minimo={v0.stock_minimo} editable={!isSaving} onEdit={() => startEdit(key, qty)} />
                          )}
                          {isSaving && <span style={{ fontSize: 10, color: '#ff9800' }}>…</span>}
                        </div>
                      )
                    })
                  : /* Multi-variante: solo totales por sucursal, no editables */
                    stockPorSuc.map(s => {
                      const c = s.total === 0 ? stockColor(0, 1) : s.bajo ? stockColor(1, 999) : stockColor(999, 0)
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.28)' }}>{shortNom(s.nombre)}</span>
                          <span style={{ minWidth: 30, height: 24, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', background: c.bg, color: c.fg, fontSize: 12, fontWeight: 700, border: `1px solid ${c.border}` }}>{fmtN(s.total)}</span>
                        </div>
                      )
                    })
                }
                {/* Total global */}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>= <strong style={{ color: stockTotal === 0 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>{fmtN(stockTotal)}</strong></span>
              </div>
            </div>
          </div>

          {/* Precio + margen */}
          <div style={{ textAlign: 'right', paddingRight: 14, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{formatARS(precioMin)}</div>
            {margen !== null && (
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3, color: margen >= 25 ? '#22c55e' : margen >= 15 ? '#fbbf24' : '#ef4444' }}>{margen}% mrg</div>
            )}
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={e => e.stopPropagation()}>
            {esSingle && (
              <button title="Transferir stock" onClick={() => setTransferVar(v0)}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,152,0,0.2)', background: 'rgba(255,152,0,0.08)', color: 'rgba(255,152,0,0.8)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,152,0,0.22)'; e.currentTarget.style.color = '#ff9800' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,152,0,0.08)'; e.currentTarget.style.color = 'rgba(255,152,0,0.8)' }}
              >⇄</button>
            )}
            {[
              { icon: '%', title: 'Ajustar precios', fn: onLote },
              { icon: '✎', title: 'Editar', fn: onEdit },
              { icon: '✕', title: 'Eliminar', fn: onDelete, danger: true },
            ].map(a => (
              <button key={a.icon} title={a.title} onClick={a.fn}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: 'rgba(255,255,255,0.28)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = a.danger ? '#ef4444' : '#ff9800'; e.currentTarget.style.borderColor = a.danger ? 'rgba(239,68,68,0.4)' : 'rgba(255,152,0,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.28)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
              >{a.icon}</button>
            ))}
          </div>
        </div>

        {/* ── Sub-filas de variantes ── */}
        {!esSingle && expanded && variantes.map(v => (
          <VarianteRow key={v.id} variante={v} sucursales={sucursales} productoNombre={p.nombre} onStockSaved={onStockSaved} onTransfer={setTransferVar} />
        ))}
      </div>

      {transferVar && (
        <ModalTransferencia variante={transferVar} productoNombre={p.nombre} sucursales={sucursales} onClose={() => setTransferVar(null)} onSaved={onStockSaved} />
      )}
    </>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ productos, sucursales, resumenDia, loadingResumen }) {
  const totalProds = productos.length
  const totalUnids = productos.reduce((a, p) => a + (p.variantes || []).reduce((b, v) => b + (v.stocks_sucursal || []).reduce((c, ss) => c + ss.cantidad, 0), 0), 0)
  const bajoStock  = productos.filter(p => (p.variantes || []).some(v => (v.stocks_sucursal || []).some(ss => ss.cantidad <= v.stock_minimo))).length
  const ingresos   = resumenDia?.ingresos_hoy ?? 0
  const delta      = resumenDia?.delta_hoy ?? null
  const margen     = resumenDia?.margen_promedio ?? 0

  const stats = [
    { label: 'Productos', value: totalProds, color: '#f1f5f9', icon: '◉' },
    { label: 'Unidades en stock', value: fmtN(totalUnids), sub: `${sucursales.filter(s => !s.es_central).length} sucursales + central`, color: '#f1f5f9', icon: '▣' },
    { label: 'Bajo mínimo', value: bajoStock, sub: bajoStock > 0 ? '⚠ Revisar' : '✓ OK', color: bajoStock > 0 ? '#fbbf24' : '#22c55e', icon: '◈' },
    { label: 'Ingresos hoy', value: loadingResumen ? '—' : formatARS(ingresos), sub: delta !== null ? `${delta >= 0 ? '+' : ''}${delta}% vs ayer` : undefined, color: delta !== null ? (delta >= 0 ? '#22c55e' : '#ef4444') : '#f1f5f9', icon: '$' },
    { label: 'Margen promedio', value: loadingResumen ? '—' : `${margen}%`, color: margen >= 25 ? '#22c55e' : margen >= 15 ? '#fbbf24' : '#ef4444', icon: '◇' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
      {stats.map((s, i) => (
        <div key={i} style={{ background: 'rgba(15,22,41,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '13px 15px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: s.color, opacity: 0.6 }}>{s.icon}</span>{s.label}
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 21, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
          {s.sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── Alerta de stock bajo ─────────────────────────────────────────────────────

function AlertaBajoStock({ productos }) {
  const [off, setOff] = useState(false)
  const alertas = productos.filter(p => (p.variantes || []).some(v => (v.stocks_sucursal || []).some(ss => ss.cantidad <= v.stock_minimo && ss.cantidad >= 0)))
  if (!alertas.length || off) return null
  return (
    <div style={{ marginBottom: 14, padding: '11px 16px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>⚠</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>{alertas.length} producto{alertas.length > 1 ? 's' : ''} con stock bajo: </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{alertas.slice(0, 3).map(p => p.nombre).join(', ')}{alertas.length > 3 ? ` y ${alertas.length - 3} más` : ''}</span>
      </div>
      <button onClick={() => setOff(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.28)', cursor: 'pointer', fontSize: 15 }}>✕</button>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Stock() {
  const [productos, setProductos]     = useState([])
  const [categorias, setCategorias]   = useState([])
  const [sucursales, setSucursales]   = useState([])
  const [marcas, setMarcas]           = useState([])
  const [resumenDia, setResumenDia]   = useState(null)
  const [loadingResumen, setLoadingResumen] = useState(true)
  const [loading, setLoading]         = useState(true)

  const [busqueda, setBusqueda]       = useState('')
  const [catFiltro, setCatFiltro]     = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState('')
  const [sucFiltro, setSucFiltro]     = useState('')

  const [modalProd, setModalProd]     = useState(null)
  const [modalLote, setModalLote]     = useState(null)
  const [modalCats, setModalCats]     = useState(false)
  const [confirm, setConfirm]         = useState(null)

  useEffect(() => {
    categoriasProductoApi.listar().then(r => setCategorias(r.data)).catch(() => {})
    sucursalesApi.listar().then(r => setSucursales(r.data)).catch(() => {})
    stockApi.marcas().then(r => setMarcas(r.data)).catch(() => {})
    finanzasApi.resumenDia().then(r => setResumenDia(r.data)).catch(() => {}).finally(() => setLoadingResumen(false))
  }, [])

  const cargar = useCallback(() => {
    setLoading(true)
    const params = {}
    if (busqueda)    params.busqueda    = busqueda
    if (catFiltro)   params.categoria   = catFiltro
    if (marcaFiltro) params.marca       = marcaFiltro
    if (sucFiltro)   params.sucursal_id = sucFiltro
    stockApi.listar(params)
      .then(r => setProductos(r.data))
      .catch(() => toast.error('Error al cargar stock'))
      .finally(() => setLoading(false))
  }, [busqueda, catFiltro, marcaFiltro, sucFiltro])

  useEffect(() => { cargar() }, [cargar])

  const eliminar = async id => { await productosApi.eliminar(id); toast.success('Eliminado'); cargar() }

  const hayFiltros = catFiltro || marcaFiltro || sucFiltro

  return (
    <>
      {/* ── Topbar ── */}
      <div className="topbar">
        <div>
          <div className="page-title">Inventario</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>
            {productos.length} productos · {sucursales.filter(s => !s.es_central).length} sucursales + central
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setModalCats(true)}>Categorías</button>
          <button className="btn btn-primary" onClick={() => setModalProd({})}>+ Nuevo producto</button>
        </div>
      </div>

      <div className="page-content">

        {/* Stats */}
        <StatsBar productos={productos} sucursales={sucursales} resumenDia={resumenDia} loadingResumen={loadingResumen} />

        {/* Alerta */}
        <AlertaBajoStock productos={productos} />

        {/* Búsqueda */}
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)', fontSize: 16, pointerEvents: 'none' }}>⌕</span>
            <input
              style={{ width: '100%', padding: '11px 40px', background: 'rgba(15,22,41,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f1f5f9', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
              placeholder="Buscar producto, marca..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onFocus={e => { e.target.style.borderColor = 'rgba(255,152,0,0.35)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
            {busqueda && <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14 }}>✕</button>}
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Categoría pills */}
            {[{ id: '', nombre: 'Todo' }, ...categorias].map(cat => {
              const active = (cat.nombre === 'Todo' && !catFiltro) || catFiltro === cat.nombre
              return (
                <button key={cat.id ?? 'all'} onClick={() => setCatFiltro(cat.nombre === 'Todo' ? '' : cat.nombre)}
                  style={{ padding: '5px 13px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: active ? '1px solid rgba(255,152,0,0.45)' : '1px solid rgba(255,255,255,0.08)', background: active ? 'rgba(255,152,0,0.12)' : 'rgba(15,22,41,0.6)', color: active ? '#ff9800' : 'rgba(255,255,255,0.38)', transition: 'all 0.15s' }}
                >{cat.nombre}</button>
              )
            })}

            {(marcas.length > 0 || sucursales.length > 1) && <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 16 }}>|</span>}

            {/* Marca */}
            {marcas.length > 0 && (
              <select value={marcaFiltro} onChange={e => setMarcaFiltro(e.target.value)}
                style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${marcaFiltro ? 'rgba(255,152,0,0.4)' : 'rgba(255,255,255,0.08)'}`, background: 'rgba(15,22,41,0.8)', color: marcaFiltro ? '#ff9800' : 'rgba(255,255,255,0.38)', fontSize: 12, outline: 'none', cursor: 'pointer', appearance: 'none' }}
              >
                <option value="">Marca</option>
                {marcas.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}

            {/* Sucursal */}
            {sucursales.length > 1 && (
              <select value={sucFiltro} onChange={e => setSucFiltro(e.target.value)}
                style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${sucFiltro ? 'rgba(255,152,0,0.4)' : 'rgba(255,255,255,0.08)'}`, background: 'rgba(15,22,41,0.8)', color: sucFiltro ? '#ff9800' : 'rgba(255,255,255,0.38)', fontSize: 12, outline: 'none', cursor: 'pointer', appearance: 'none' }}
              >
                <option value="">Todas las sucursales</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}{s.es_central ? ' (Central)' : ''}</option>)}
              </select>
            )}

            {hayFiltros && (
              <button onClick={() => { setCatFiltro(''); setMarcaFiltro(''); setSucFiltro('') }}
                style={{ background: 'none', border: 'none', color: '#ff9800', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Limpiar ✕
              </button>
            )}
          </div>
        </div>

        {/* Header columnas */}
        {!loading && productos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto', padding: '0 10px 6px 0' }}>
            <div />
            <div style={{ paddingLeft: 54, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.18)' }}>
              Producto · chips = stock por sucursal (click para editar)
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.18)', textAlign: 'right', paddingRight: 14 }}>Precio</div>
            <div style={{ width: 120 }} />
          </div>
        )}

        {/* Lista */}
        {loading
          ? <Loading />
          : productos.length === 0
            ? <EmptyState icon="◉" text="Sin productos." action={<button className="btn btn-primary" onClick={() => setModalProd({})}>+ Nuevo producto</button>} />
            : productos.map(p => (
              <ProductRow key={p.id} p={p} sucursales={sucursales}
                onEdit={() => setModalProd(p)}
                onLote={() => setModalLote(p)}
                onStockSaved={cargar}
                onDelete={() => setConfirm({ msg: `¿Eliminar "${p.nombre}"?`, fn: () => eliminar(p.id) })}
              />
            ))
        }
      </div>

      {modalProd !== null && <ModalProducto producto={modalProd} categorias={categorias} onClose={() => setModalProd(null)} onSaved={cargar} />}
      {modalLote && <ModalLote producto={modalLote} onClose={() => setModalLote(null)} onSaved={cargar} />}
      {modalCats && <ModalCategorias onClose={() => { setModalCats(false); categoriasProductoApi.listar().then(r => setCategorias(r.data)).catch(() => {}) }} />}
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
    </>
  )
}
