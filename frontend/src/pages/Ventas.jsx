import { useState, useEffect } from 'react'
import { ventasApi, clientesApi, sucursalesApi, productosApi } from '../api'
import { useToast } from '../components/Toast'
import { useSucursal } from '../context/SucursalContext'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const METODOS = ['efectivo', 'transferencia', 'tarjeta']
const CHIP = { efectivo: 'chip-green', transferencia: 'chip-blue', tarjeta: 'chip-gray' }
const ESTADO_CHIP = { confirmada: 'chip-green', abierta: 'chip-gold', cancelada: 'chip-red' }

function ModalNuevoCliente({ onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ nombre: '', ubicacion: '', telefono: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.nombre) return toast('El nombre es obligatorio', 'error')
    setSaving(true)
    try {
      const cliente = await clientesApi.crear(form)
      toast('Cliente creado')
      onCreated(cliente)
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div style={{ marginTop: 16, padding: 16, background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, color: 'var(--gold-light)' }}>Nuevo cliente</div>
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Nombre *</label>
          <input className="form-input" placeholder="Nombre completo" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} autoFocus />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Teléfono</label>
          <input className="form-input" placeholder="Ej: 11-1234-5678" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label">Ubicación</label>
        <input className="form-input" placeholder="Ciudad / barrio" value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Crear cliente'}</button>
      </div>
    </div>
  )
}

function ModalVenta({ venta, clientes: initialClientes, sucursales, productos, onClose, onSaved }) {
  const toast = useToast()
  const [clientes, setClientes] = useState(initialClientes)
  const [clienteId, setClienteId] = useState(venta?.cliente_id || '')
  const [sucursalId, setSucursalId] = useState(venta?.sucursal_id || sucursales[0]?.id || '')
  const [metodo, setMetodo] = useState(venta?.metodo_pago || 'efectivo')
  const [estado, setEstado] = useState(venta?.estado || 'confirmada')
  const [notas, setNotas] = useState(venta?.notas || '')
  const [items, setItems] = useState(venta?.items?.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario })) || [])
  const [busqProd, setBusqProd] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)

  const variantesFlat = productos.flatMap(p => p.variantes?.filter(v => v.activa).map(v => ({
    ...v,
    label: `${p.nombre} — ${[v.sabor, v.tamanio].filter(Boolean).join(' · ')}`,
    marca: p.marca,
    nombre_producto: p.nombre,
  })) || [])

  const filtradas = variantesFlat.filter(v => v.label.toLowerCase().includes(busqProd.toLowerCase()))

  const addItem = (variante) => {
    setItems(prev => {
      const exists = prev.find(i => i.variante_id === variante.id)
      if (exists) return prev.map(i => i.variante_id === variante.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { variante_id: variante.id, cantidad: 1, precio_unitario: Number(variante.precio_venta) }]
    })
    setBusqProd('')
  }

  const setItemField = (i, k, v) => setItems(prev => prev.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const removeItem = (i) => setItems(prev => prev.filter((_, j) => j !== i))

  const total = items.reduce((s, i) => s + (Number(i.cantidad) * Number(i.precio_unitario)), 0)

  const save = async () => {
    if (!sucursalId) return toast('Seleccioná una sucursal', 'error')
    if (items.length === 0) return toast('Agregá al menos un producto', 'error')
    setSaving(true)
    try {
      const payload = {
        cliente_id: clienteId || null,
        sucursal_id: Number(sucursalId),
        metodo_pago: metodo,
        estado,
        notas: notas || null,
        items: items.map(i => ({ variante_id: Number(i.variante_id), cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario) }))
      }
      if (venta) await ventasApi.actualizar(venta.id, payload)
      else await ventasApi.crear(payload)
      toast(venta ? 'Venta actualizada' : 'Venta registrada')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{venta ? 'Editar venta' : 'Registrar venta'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cliente</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-select" value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => setShowNuevoCliente(v => !v)}
                  title="Crear cliente nuevo"
                >
                  {showNuevoCliente ? '✕' : '+ Nuevo'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Sucursal *</label>
              <select className="form-select" value={sucursalId} onChange={e => setSucursalId(e.target.value)}>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>

          {showNuevoCliente && (
            <ModalNuevoCliente
              onClose={() => setShowNuevoCliente(false)}
              onCreated={(cliente) => {
                setClientes(c => [...c, cliente])
                setClienteId(cliente.id)
                setShowNuevoCliente(false)
              }}
            />
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Método de pago</label>
              <select className="form-select" value={metodo} onChange={e => setMetodo(e.target.value)}>
                {METODOS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-select" value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="confirmada">Confirmada</option>
                <option value="abierta">Pedido abierto</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Agregar producto</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" placeholder="Buscar producto..." value={busqProd} onChange={e => setBusqProd(e.target.value)} />
              {busqProd && filtradas.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {filtradas.slice(0, 8).map(v => (
                    <div key={v.id}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                      onMouseDown={() => addItem(v)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{v.label}</span>
                      <span style={{ color: 'var(--gold-light)' }}>{fmt(v.precio_venta)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              {items.map((item, i) => {
                const v = variantesFlat.find(x => x.id === Number(item.variante_id))
                return (
                  <div className="carrito-item" key={i}>
                    <div className="carrito-nombre">
                      <span>{v?.nombre_producto || `Variante #${item.variante_id}`}</span>
                      {v?.marca && <span style={{ color: 'var(--text-muted)', marginLeft: 5 }}>· {v.marca}</span>}
                      {v && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{[v.sabor, v.tamanio].filter(Boolean).join(' · ')}</div>}
                    </div>
                    <input className="carrito-qty" type="number" min={1} value={item.cantidad} onChange={e => setItemField(i, 'cantidad', e.target.value)} />
                    <input className="carrito-precio" type="number" value={item.precio_unitario} onChange={e => setItemField(i, 'precio_unitario', e.target.value)} />
                    <div className="carrito-subtotal">{fmt(item.cantidad * item.precio_unitario)}</div>
                    <button className="carrito-remove" onClick={() => removeItem(i)}>✕</button>
                  </div>
                )
              })}
              <div style={{ textAlign: 'right', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--gold-light)' }}>
                Total: {fmt(total)}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar venta'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Ventas() {
  const toast = useToast()
  const { sucursalActual, sucursales } = useSucursal()
  const [ventas, setVentas] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [verPedidos, setVerPedidos] = useState(false)
  const [filtroSucursal, setFiltroSucursal] = useState('')

  const cargar = () => {
    setLoading(true)
    Promise.all([
      ventasApi.listar({ estado: 'confirmada' }),
      ventasApi.pedidosAbiertos(),
      clientesApi.listar(),
      productosApi.listar(),
    ]).then(([v, p, c, pr]) => {
      setVentas(v); setPedidos(p); setClientes(c); setProductos(pr)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  // Auto-set filtro when sucursal changes
  useEffect(() => {
    if (sucursalActual) setFiltroSucursal(String(sucursalActual.id))
  }, [sucursalActual?.id])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta venta?')) return
    try { await ventasApi.eliminar(id); toast('Venta eliminada'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const confirmar = async (id) => {
    try { await ventasApi.confirmar(id); toast('Pedido confirmado'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const base = verPedidos ? pedidos : ventas
  const lista = filtroSucursal
    ? base.filter(v => String(v.sucursal_id) === filtroSucursal)
    : base

  const getNombreSucursal = (id) => sucursales.find(s => s.id === id)?.nombre || `#${id}`
  const getNombreCliente = (id) => clientes.find(c => c.id === id)?.nombre || `#${id}`

  return (
    <>
      <div className="topbar">
        <div className="page-title">
          Ventas
          {sucursalActual && filtroSucursal && (
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>
              — {getNombreSucursal(Number(filtroSucursal))}
            </span>
          )}
        </div>
        <div className="topbar-actions">
          <select
            className="form-select"
            style={{ width: 'auto', padding: '9px 14px' }}
            value={filtroSucursal}
            onChange={e => setFiltroSucursal(e.target.value)}
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <button className={`btn ${verPedidos ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setVerPedidos(v => !v)}>
            Pedidos abiertos {pedidos.length > 0 && `(${pedidos.length})`}
          </button>
          <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Registrar venta</button>
        </div>
      </div>

      <div className="content page-enter">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{verPedidos ? 'Pedidos abiertos' : 'Ventas confirmadas'}</span>
          </div>
          {loading ? <div className="loading">Cargando...</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Cliente</th><th>Sucursal</th><th>Productos</th><th>Pago</th><th>Total</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {lista.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Sin registros</td></tr>}
                  {lista.map(v => (
                    <tr key={v.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(v.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{v.cliente_id ? getNombreCliente(v.cliente_id) : '—'}</td>
                      <td>{getNombreSucursal(v.sucursal_id)}</td>
                      <td>
                        {v.items?.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {v.items.slice(0, 2).map((item, idx) => {
                              const variante = productos.flatMap(p => p.variantes?.map(vv => ({ ...vv, marca: p.marca, nombre: p.nombre })) || []).find(vv => vv.id === item.variante_id)
                              return (
                                <div key={idx} style={{ fontSize: 12 }}>
                                  <span style={{ color: 'var(--text)' }}>{variante?.nombre || `#${item.variante_id}`}</span>
                                  {variante?.marca && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>· {variante.marca}</span>}
                                </div>
                              )
                            })}
                            {v.items.length > 2 && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>+{v.items.length - 2} más</div>}
                          </div>
                        ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </td>
                      <td><span className={`chip ${CHIP[v.metodo_pago]}`}>{v.metodo_pago}</span></td>
                      <td><strong>{fmt(v.total)}</strong></td>
                      <td><span className={`chip ${ESTADO_CHIP[v.estado]}`}>{v.estado}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {v.estado === 'abierta' && <button className="btn btn-ghost btn-sm" onClick={() => confirmar(v.id)}>Confirmar</button>}
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(v)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => eliminar(v.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <ModalVenta
          venta={modal === 'nuevo' ? null : modal}
          clientes={clientes}
          sucursales={sucursales}
          productos={productos}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
    </>
  )
}
