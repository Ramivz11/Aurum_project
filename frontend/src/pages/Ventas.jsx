import { useState, useEffect } from 'react'
import { ventasApi, clientesApi, sucursalesApi, productosApi } from '../api'
import { useToast } from '../components/Toast'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const METODOS = ['efectivo', 'transferencia', 'tarjeta']
const CHIP = { efectivo: 'chip-green', transferencia: 'chip-blue', tarjeta: 'chip-gray' }
const ESTADO_CHIP = { confirmada: 'chip-green', abierta: 'chip-gold', cancelada: 'chip-red' }

function ModalVenta({ venta, clientes, sucursales, productos, onClose, onSaved }) {
  const toast = useToast()
  const [clienteId, setClienteId] = useState(venta?.cliente_id || '')
  const [sucursalId, setSucursalId] = useState(venta?.sucursal_id || sucursales[0]?.id || '')
  const [metodo, setMetodo] = useState(venta?.metodo_pago || 'efectivo')
  const [estado, setEstado] = useState(venta?.estado || 'confirmada')
  const [notas, setNotas] = useState(venta?.notas || '')
  const [items, setItems] = useState(venta?.items?.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario, _label: '' })) || [])
  const [busqProd, setBusqProd] = useState('')
  const [saving, setSaving] = useState(false)

  const variantesFlat = productos.flatMap(p => p.variantes?.filter(v => v.activa).map(v => ({
    ...v,
    label: `${p.nombre} — ${[v.sabor, v.tamanio].filter(Boolean).join(' · ')}`,
    precio_venta: v.precio_venta,
  })) || [])

  const filtradas = variantesFlat.filter(v => v.label.toLowerCase().includes(busqProd.toLowerCase()))

  const addItem = (variante) => {
    setItems(prev => {
      const exists = prev.find(i => i.variante_id === variante.id)
      if (exists) return prev.map(i => i.variante_id === variante.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { variante_id: variante.id, cantidad: 1, precio_unitario: Number(variante.precio_venta), _label: variante.label }]
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
              <select className="form-select" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sucursal *</label>
              <select className="form-select" value={sucursalId} onChange={e => setSucursalId(e.target.value)}>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
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

          {/* Buscador de productos */}
          <div className="form-group">
            <label className="form-label">Agregar producto</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" placeholder="Buscar producto..." value={busqProd} onChange={e => setBusqProd(e.target.value)} />
              {busqProd && filtradas.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {filtradas.slice(0, 8).map(v => (
                    <div key={v.id} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                      onMouseDown={() => addItem(v)}
                      onMouseEnter={e => e.target.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.target.style.background = 'transparent'}
                    >
                      {v.label} — <span style={{ color: 'var(--gold-light)' }}>{fmt(v.precio_venta)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Carrito */}
          {items.length > 0 && (
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              {items.map((item, i) => {
                const v = variantesFlat.find(x => x.id === Number(item.variante_id))
                return (
                  <div className="carrito-item" key={i}>
                    <div className="carrito-nombre">{v?.label || `Variante #${item.variante_id}`}</div>
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
  const [ventas, setVentas] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [verPedidos, setVerPedidos] = useState(false)

  const cargar = () => {
    setLoading(true)
    Promise.all([
      ventasApi.listar({ estado: 'confirmada' }),
      ventasApi.pedidosAbiertos(),
      clientesApi.listar(),
      sucursalesApi.listar(),
      productosApi.listar(),
    ]).then(([v, p, c, s, pr]) => {
      setVentas(v); setPedidos(p); setClientes(c); setSucursales(s); setProductos(pr)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta venta?')) return
    try { await ventasApi.eliminar(id); toast('Venta eliminada'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const confirmar = async (id) => {
    try { await ventasApi.confirmar(id); toast('Pedido confirmado'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const lista = verPedidos ? pedidos : ventas

  return (
    <>
      <div className="topbar">
        <div className="page-title">Ventas</div>
        <div className="topbar-actions">
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
                  <tr><th>Fecha</th><th>Cliente</th><th>Sucursal</th><th>Pago</th><th>Total</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {lista.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Sin registros</td></tr>}
                  {lista.map(v => (
                    <tr key={v.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(v.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{v.cliente_id ? `Cliente #${v.cliente_id}` : '—'}</td>
                      <td>{v.sucursal_id}</td>
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
