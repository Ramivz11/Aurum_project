import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ventasApi, clientesApi, stockApi, sucursalesApi, finanzasApi } from '../../api/services'
import { useMarca } from '../../context/MarcaContext'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS, formatDateTime, METODO_PAGO_COLOR, METODO_PAGO_LABEL } from '../../components/ui'

function ModalVenta({ onClose, onSaved, ventaEditar = null }) {
  const esEdicion = ventaEditar !== null
  const [sucursales, setSucursales] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState({
    cliente_id: ventaEditar ? String(ventaEditar.cliente_id || '') : '',
    sucursal_id: ventaEditar ? String(ventaEditar.sucursal_id) : '',
    metodo_pago: ventaEditar?.metodo_pago || 'efectivo',
    estado: ventaEditar?.estado || 'confirmada',
    notas: ventaEditar?.notas || '',
  })
  const [carrito, setCarrito] = useState(
    ventaEditar?.items?.map(it => ({
      key: `v${it.variante_id}`,
      variante_id: it.variante_id,
      cantidad: it.cantidad,
      precio_unitario: Number(it.precio_unitario),
      nombre: it.variante ? [it.variante.producto?.nombre, it.variante.producto?.marca].filter(Boolean).join(' · ') : `Variante #${it.variante_id}`,
      detalle: it.variante ? [it.variante.sabor, it.variante.tamanio].filter(Boolean).join(' / ') : '',
    })) || []
  )
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState(null)
  const [formCliente, setFormCliente] = useState({ nombre: '', ubicacion: '', telefono: '' })

  useEffect(() => {
    Promise.all([sucursalesApi.listar(), clientesApi.listar(), stockApi.listar()])
      .then(([s, c, p]) => { setSucursales(s.data.filter(x => !x.es_central)); setClientes(c.data); setProductos(p.data) })
  }, [])

  const { getStyles } = useMarca()

  const filtrados = busqueda
    ? productos.filter(p => {
        const q = busqueda.toLowerCase()
        return p.nombre.toLowerCase().includes(q) || (p.marca || '').toLowerCase().includes(q)
      })
    : []

  const agregar = (prod, vari) => {
    const key = `v${vari.id}`
    const ex = carrito.find(i => i.key === key)
    if (ex) {
      setCarrito(c => c.map(i => i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i))
    } else {
      setCarrito(c => [...c, {
        key, variante_id: vari.id, cantidad: 1, precio_unitario: Number(vari.precio_venta),
        nombre: [prod.nombre, prod.marca].filter(Boolean).join(' · '),
        detalle: [vari.sabor, vari.tamanio].filter(Boolean).join(' / ')
      }])
    }
    setBusqueda('')
  }

  const [creandoCliente, setCreandoCliente] = useState(false)

  const crearCliente = async () => {
    if (!formCliente.nombre.trim()) return toast.error('El nombre es obligatorio')
    setCreandoCliente(true)
    try {
      const { data } = await clientesApi.crear(formCliente)
      setClientes(c => [...c, data])
      setForm(f => ({ ...f, cliente_id: String(data.id) }))
      setFormCliente({ nombre: '', ubicacion: '', telefono: '' })
      setNuevoCliente(null)
      toast.success('Cliente creado')
    } catch (e) {
      toast.error(e.message || 'Error al crear cliente')
    } finally {
      setCreandoCliente(false)
    }
  }

  const total = carrito.reduce((a, i) => a + i.precio_unitario * i.cantidad, 0)

  const submit = async (estadoOverride) => {
    if (!form.sucursal_id) return toast.error('Seleccioná una sucursal')
    if (!carrito.length) return toast.error('El carrito está vacío')
    setLoading(true)
    const estadoFinal = estadoOverride || form.estado
    const payload = {
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      sucursal_id: Number(form.sucursal_id),
      metodo_pago: form.metodo_pago,
      estado: estadoFinal,
      notas: form.notas || null,
      items: carrito.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
    }
    try {
      if (esEdicion) {
        await ventasApi.actualizar(ventaEditar.id, payload)
        toast.success('Pedido actualizado')
      } else {
        await ventasApi.crear(payload)
        toast.success(estadoFinal === 'confirmada' ? 'Venta registrada' : 'Pedido guardado')
      }
      onSaved(); onClose()
    } catch (e) { toast.error(e.message || 'Error') } finally { setLoading(false) }
  }

  return (
    <Modal title={esEdicion ? 'Editar pedido' : 'Registrar venta'} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        {!esEdicion && (
          <button className="btn btn-ghost" onClick={() => submit('abierta')}>Guardar como pedido</button>
        )}
        <button className="btn btn-primary" onClick={() => submit(esEdicion ? 'abierta' : null)} disabled={loading}>
          {loading ? (esEdicion ? 'Guardando...' : 'Registrando...') : (esEdicion ? `Guardar cambios ${formatARS(total)}` : `Confirmar ${formatARS(total)}`)}
        </button>
      </>}
    >
      <div className="grid-2" style={{ marginBottom: 0 }}>
        <div className="form-group">
          <label className="input-label">Cliente</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
              <option value="">Sin cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setNuevoCliente(true)}>+ Nuevo</button>
          </div>
        </div>
        <div className="form-group">
          <label className="input-label">Sucursal *</label>
          <select className="input" value={form.sucursal_id} onChange={e => setForm(f => ({ ...f, sucursal_id: e.target.value }))}>
            <option value="">Seleccionar...</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="input-label">Método de pago</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['efectivo', 'transferencia', 'tarjeta'].map(m => (
            <button key={m} className={`btn btn-sm ${form.metodo_pago === m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setForm(f => ({ ...f, metodo_pago: m }))}>{METODO_PAGO_LABEL[m]}</button>
          ))}
        </div>
      </div>
      <hr className="divider" />
      <div className="form-group">
        <label className="input-label">Buscar producto</label>
        <input className="input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o marca..." />
        {filtrados.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
            {filtrados.map(p => p.variantes?.filter(v => v.activa !== false).map(v => (
              <div key={v.id} onClick={() => agregar(p, v)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</span>
                    {p.marca && (() => { const s = getStyles(p.marca); return <span className="brand-badge" style={{ '--brand-color': s.color, '--brand-bg': s.background, '--brand-border': s.border }}>{p.marca}</span> })()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[v.sabor, v.tamanio].filter(Boolean).join(' · ')}
                    {' — '}Stock en sucursal:{' '}
                    {(() => {
                      const ss = v.stocks_sucursal?.find(s => s.sucursal_id === Number(form.sucursal_id))
                      const cant = ss ? ss.cantidad : (v.stock_central || 0)
                      return <strong style={{ color: cant <= (v.stock_minimo || 0) ? 'var(--red)' : 'var(--text-muted)' }}>{cant}</strong>
                    })()}
                  </div>
                </div>
                <div style={{ fontWeight: 600, marginLeft: 12, whiteSpace: 'nowrap' }}>{formatARS(v.precio_venta)}</div>
              </div>
            )))}
          </div>
        )}
      </div>
      {carrito.length > 0 && (
        <div>
          <label className="input-label">Carrito</label>
          {carrito.map((item, i) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.nombre}</div>
                {item.detalle && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.detalle}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="btn btn-ghost btn-xs" onClick={() => setCarrito(c => c.map((x, idx) => idx === i && x.cantidad > 1 ? { ...x, cantidad: x.cantidad - 1 } : x))}>−</button>
                <span style={{ width: 24, textAlign: 'center' }}>{item.cantidad}</span>
                <button className="btn btn-ghost btn-xs" onClick={() => setCarrito(c => c.map((x, idx) => idx === i ? { ...x, cantidad: x.cantidad + 1 } : x))}>+</button>
              </div>
              <input type="number" className="input" style={{ width: 110 }} value={item.precio_unitario}
                onChange={e => setCarrito(c => c.map((x, idx) => idx === i ? { ...x, precio_unitario: Number(e.target.value) } : x))} />
              <button className="btn btn-danger btn-xs" onClick={() => setCarrito(c => c.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 12, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--gold-light)' }}>
            Total: {formatARS(total)}
          </div>
        </div>
      )}
      {nuevoCliente && (
        <div style={{ marginTop: 16, padding: 16, background: 'var(--surface2)', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Nuevo cliente</div>
          <input className="input mb-8" placeholder="Nombre *" value={formCliente.nombre} onChange={e => setFormCliente(n => ({ ...n, nombre: e.target.value }))} />
          <input className="input mb-8" placeholder="Ubicación" value={formCliente.ubicacion} onChange={e => setFormCliente(n => ({ ...n, ubicacion: e.target.value }))} />
          <input className="input mb-8" placeholder="Teléfono" value={formCliente.telefono} onChange={e => setFormCliente(n => ({ ...n, telefono: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setNuevoCliente(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={crearCliente} disabled={creandoCliente}>{creandoCliente ? 'Creando...' : 'Crear'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Métodos de pago color badge ─────────────────────────────────────────────
const PAGO_COLORS = {
  efectivo: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.22)' },
  transferencia: { bg: 'rgba(91,143,232,0.12)', text: '#5b8fe8', border: 'rgba(91,143,232,0.22)' },
  tarjeta: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.22)' },
}

function PagoBadge({ metodo }) {
  const c = PAGO_COLORS[metodo] || { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.1)' }
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 8, fontSize: 11, fontWeight: 600, padding: '3px 10px',
    }}>{METODO_PAGO_LABEL[metodo] || metodo}</span>
  )
}

function EstadoBadge({ estado }) {
  const map = {
    confirmada: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.22)' },
    abierta: { bg: 'rgba(255,152,0,0.12)', text: '#ff9800', border: 'rgba(255,152,0,0.22)' },
    cancelada: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.22)' },
  }
  const c = map[estado] || map.abierta
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 8, fontSize: 11, fontWeight: 600, padding: '3px 10px',
      textTransform: 'capitalize',
    }}>{estado}</span>
  )
}

// ─── Ventas Footer ────────────────────────────────────────────────────────────

function VentasFooter({ ventas, resumenDia, loadingResumen }) {
  const pendientes = ventas.filter(v => v.estado === 'abierta').length

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
      margin: '24px 0 8px',
      borderRadius: 20,
      background: 'linear-gradient(135deg, rgba(15,22,41,0.97) 0%, rgba(26,32,53,0.92) 100%)',
      border: '1px solid rgba(255,152,0,0.15)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>

        {/* Ingresos del día */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(255,152,0,0.2), rgba(255,152,0,0.08))',
            border: '1px solid rgba(255,152,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0, color: '#ff9800',
          }}>$</div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Ingresos del Día</div>
            {loadingResumen
              ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Cargando...</div>
              : <>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#f1f5f9', lineHeight: 1 }}>
                    {formatARS(ingresosHoy)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    {delta !== null && (
                      <span style={{
                        background: delta >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: delta >= 0 ? '#22c55e' : '#ef4444',
                        borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                      }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs ayer</span>
                    )}
                    {pendientes > 0 && (
                      <span style={{ background: 'rgba(255,152,0,0.15)', color: '#ff9800', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                        +{pendientes} pendientes
                      </span>
                    )}
                  </div>
                </>
            }
          </div>
        </div>

        {/* Tendencia mensual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 28px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Tendencia Mensual</div>
            {loadingResumen
              ? <div style={{ height: H, display: 'flex', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Cargando...</div>
                </div>
              : <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="vk-g" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ff9800" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#ffb74d" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  <polyline points={pts} fill="none" stroke="url(#vk-g)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(255,152,0,0.2), rgba(255,152,0,0.08))',
            border: '1px solid rgba(255,152,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>◇</div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Margen Promedio</div>
            {loadingResumen
              ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Cargando...</div>
              : <>
                  <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#ff9800', lineHeight: 1 }}>{margenPromedio}%</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>global · todas las variantes</div>
                </>
            }
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Row Card ─────────────────────────────────────────────────────────────────

function VentaRow({ venta, clienteNombre, sucursalNombre, onConfirmar, onEliminar, onEditar }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 160px 100px 120px 140px 110px auto',
        alignItems: 'center',
        gap: 12,
        padding: '16px 20px',
        borderRadius: 16,
        background: hovered
          ? 'linear-gradient(135deg, rgba(26,32,53,0.98), rgba(22,28,48,0.95))'
          : 'linear-gradient(135deg, rgba(15,22,41,0.9), rgba(20,26,46,0.85))',
        border: hovered ? '1px solid rgba(255,152,0,0.2)' : '1px solid rgba(255,255,255,0.05)',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateX(2px)' : 'translateX(0)',
        boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,152,0,0.06)' : 'none',
        marginBottom: 8,
        cursor: 'default',
      }}
    >
      {/* Cliente + fecha */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9', marginBottom: 2 }}>
          {clienteNombre || '— Sin cliente —'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{formatDateTime(venta.fecha)}</div>
      </div>

      {/* Sucursal */}
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{sucursalNombre}</div>

      {/* Items */}
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
        {venta.items?.length || 0} producto{(venta.items?.length || 0) !== 1 ? 's' : ''}
      </div>

      {/* Pago */}
      <div><PagoBadge metodo={venta.metodo_pago} /></div>

      {/* Total */}
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: '#ff9800' }}>
        {formatARS(venta.total)}
      </div>

      {/* Estado */}
      <div><EstadoBadge estado={venta.estado} /></div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
        {venta.estado === 'abierta' && (
          <button
            onClick={onEditar}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(91,143,232,0.15)'; e.currentTarget.style.borderColor = 'rgba(91,143,232,0.4)'; e.currentTarget.style.color = '#5b8fe8' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,22,41,0.9)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            style={{
              background: 'rgba(15,22,41,0.9)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
            }}>✎</button>
        )}
        {venta.estado === 'abierta' && (
          <button
            onClick={onConfirmar}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.15)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.4)'; e.currentTarget.style.color = '#22c55e' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,22,41,0.9)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            style={{
              background: 'rgba(15,22,41,0.9)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
            }}>✓</button>
        )}
        <button
          onClick={onEliminar}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,22,41,0.9)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
          style={{
            background: 'rgba(15,22,41,0.9)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
          }}>✕</button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Ventas() {
  const [ventas, setVentas] = useState([])
  const [clientes, setClientes] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [resumenDia, setResumenDia] = useState(null)
  const [loadingResumen, setLoadingResumen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [ventaEditando, setVentaEditando] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    finanzasApi.resumenDia()
      .then(r => setResumenDia(r.data))
      .catch(() => {})
      .finally(() => setLoadingResumen(false))
  }, [])

  const cargar = () => {
    setLoading(true)
    Promise.all([
      ventasApi.listar({ estado: filtro || undefined }),
      clientesApi.listar(),
      sucursalesApi.listar(),
    ]).then(([v, c, s]) => {
      setVentas(v.data)
      setClientes(c.data)
      setSucursales(s.data)
    }).catch(err => {
      console.error('Error cargando ventas:', err)
      toast.error('Error al cargar ventas: ' + (err.message || 'Sin conexión'))
    }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [filtro])

  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nombre]))
  const sucursalMap = Object.fromEntries(sucursales.map(s => [s.id, s.nombre]))

  const eliminar = async (id) => { await ventasApi.eliminar(id); toast.success('Eliminada'); cargar() }
  const confirmar = async (id) => {
    try { await ventasApi.confirmar(id); toast.success('Confirmado'); cargar() }
    catch (e) { toast.error(e.message || 'Error al confirmar') }
  }

  const filtros = [
    { key: '', label: 'Todas' },
    { key: 'abierta', label: 'Pedidos abiertos' },
    { key: 'confirmada', label: 'Confirmadas' },
  ]

  return (<>
    <div className="topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="page-title" style={{ fontSize: 22, fontWeight: 800 }}>Ventas</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          {ventas.length} registros
        </div>
      </div>
      <div className="topbar-actions">
        {filtros.map(f => {
          const isActive = filtro === f.key
          return (
            <button key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                padding: '6px 16px', borderRadius: 999,
                fontSize: 13, fontWeight: 500,
                border: isActive ? '1px solid rgba(255,152,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? 'rgba(255,152,0,0.15)' : 'rgba(15,22,41,0.6)',
                color: isActive ? '#ff9800' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >{f.label}</button>
          )
        })}
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar venta</button>
      </div>
    </div>

    <div className="page-content">
      {loading ? <Loading /> : ventas.length === 0 ? <EmptyState icon="↑" text="Sin ventas." /> : (
        <>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px 100px 120px 140px 110px auto',
            gap: 12, padding: '0 20px 10px',
            fontSize: 11, color: 'rgba(255,255,255,0.25)',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            <div>Cliente</div>
            <div>Sucursal</div>
            <div>Items</div>
            <div>Pago</div>
            <div>Total</div>
            <div>Estado</div>
            <div></div>
          </div>

          {ventas.map(v => (
            <VentaRow
              key={v.id}
              venta={v}
              clienteNombre={v.cliente_id ? (clienteMap[v.cliente_id] || `Cliente #${v.cliente_id}`) : null}
              sucursalNombre={sucursalMap[v.sucursal_id] || `Sucursal #${v.sucursal_id}`}
              onConfirmar={() => confirmar(v.id)}
              onEditar={() => setVentaEditando(v)}
              onEliminar={() => setConfirm({ msg: '¿Eliminar venta?', fn: () => eliminar(v.id) })}
            />
          ))}

          <VentasFooter ventas={ventas} resumenDia={resumenDia} loadingResumen={loadingResumen} />
        </>
      )}
    </div>

    {modal && <ModalVenta onClose={() => setModal(false)} onSaved={cargar} />}
    {ventaEditando && <ModalVenta onClose={() => setVentaEditando(null)} onSaved={cargar} ventaEditar={ventaEditando} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
  </>)
}
