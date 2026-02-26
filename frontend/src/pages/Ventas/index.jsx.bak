import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ventasApi, clientesApi, productosApi, sucursalesApi } from '../../api/services'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS, formatDateTime, METODO_PAGO_COLOR, METODO_PAGO_LABEL } from '../../components/ui'

function ModalVenta({ onClose, onSaved }) {
  const [sucursales, setSucursales] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState({ cliente_id: '', sucursal_id: '', metodo_pago: 'efectivo', estado: 'confirmada', notas: '' })
  const [carrito, setCarrito] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState(null)
  const [formCliente, setFormCliente] = useState({ nombre: '', ubicacion: '', telefono: '' })

  useEffect(() => {
    Promise.all([sucursalesApi.listar(), clientesApi.listar(), productosApi.listar()])
      .then(([s, c, p]) => { setSucursales(s.data); setClientes(c.data); setProductos(p.data) })
  }, [])

  // Búsqueda por nombre Y por marca
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
        key,
        variante_id: vari.id,
        cantidad: 1,
        precio_unitario: Number(vari.precio_venta),
        // Incluye nombre del producto + marca + sabor/tamaño
        nombre: [prod.nombre, prod.marca].filter(Boolean).join(' · '),
        detalle: [vari.sabor, vari.tamanio].filter(Boolean).join(' / ')
      }])
    }
    setBusqueda('')
  }

  const crearCliente = async () => {
    if (!formCliente.nombre) return toast.error('El nombre es obligatorio')
    const { data } = await clientesApi.crear(formCliente)
    setClientes(c => [...c, data]); setForm(f => ({ ...f, cliente_id: data.id })); setNuevoCliente(null); toast.success('Cliente creado')
  }

  const total = carrito.reduce((a, i) => a + i.precio_unitario * i.cantidad, 0)

  const submit = async (estadoOverride) => {
    if (!form.sucursal_id) return toast.error('Seleccioná una sucursal')
    if (!carrito.length) return toast.error('El carrito está vacío')
    setLoading(true)
    const estadoFinal = estadoOverride || form.estado
    try {
      await ventasApi.crear({
        ...form,
        estado: estadoFinal,
        cliente_id: form.cliente_id || null,
        sucursal_id: Number(form.sucursal_id),
        items: carrito.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      })
      toast.success(estadoFinal === 'confirmada' ? 'Venta registrada' : 'Pedido guardado')
      onSaved(); onClose()
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') } finally { setLoading(false) }
  }

  return (
    <Modal title="Registrar venta" onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-ghost" onClick={() => submit('abierta')}>Guardar como pedido</button>
        <button className="btn btn-primary" onClick={() => submit()} disabled={loading}>{loading ? 'Registrando...' : `Confirmar ${formatARS(total)}`}</button>
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
                  {/* Nombre + marca misma línea, distintos estilos */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.nombre}</span>
                    {p.marca && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--gold-light)' }}>{p.marca}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[v.sabor, v.tamanio].filter(Boolean).join(' · ')}
                    {' — '}Stock: <strong style={{ color: v.stock_actual <= (v.stock_minimo || 0) ? 'var(--red)' : 'var(--text-muted)' }}>{v.stock_actual}</strong>
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
            <button className="btn btn-primary btn-sm" onClick={crearCliente}>Crear</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Ventas() {
  const [ventas, setVentas] = useState([])
  const [clientes, setClientes] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [filtro, setFiltro] = useState('')

  const cargar = () => {
    setLoading(true)
    Promise.all([
      ventasApi.listar({ estado: filtro || undefined }),
      clientesApi.listar(),
      sucursalesApi.listar()
    ]).then(([v, c, s]) => {
      setVentas(v.data)
      setClientes(c.data)
      setSucursales(s.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [filtro])

  // Mapear id → nombre de cliente
  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nombre]))
  // Mapear id → nombre de sucursal
  const sucursalMap = Object.fromEntries(sucursales.map(s => [s.id, s.nombre]))

  const eliminar = async (id) => { await ventasApi.eliminar(id); toast.success('Eliminada'); cargar() }
  const confirmar = async (id) => {
    try { await ventasApi.confirmar(id); toast.success('Confirmado'); cargar() }
    catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }

  return (<>
    <div className="topbar">
      <div className="page-title">Ventas</div>
      <div className="topbar-actions">
        {['', 'abierta', 'confirmada'].map(e => (
          <button key={e} className={`btn btn-sm ${filtro === e ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltro(e)}>
            {e === '' ? 'Todas' : e === 'abierta' ? '⬤ Abiertas' : '✓ Cerradas'}
          </button>
        ))}
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar venta</button>
      </div>
    </div>
    <div className="page-content">
      {loading ? <Loading /> : ventas.length === 0 ? <EmptyState icon="↑" text="Sin ventas." /> : (
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Sucursal</th><th>Pago</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>{ventas.map(v => (
            <tr key={v.id}>
              <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(v.fecha)}</td>
              {/* Nombre real del cliente en lugar de #ID */}
              <td><strong>{v.cliente_id ? (clienteMap[v.cliente_id] || `Cliente #${v.cliente_id}`) : '—'}</strong></td>
              <td style={{ color: 'var(--text-muted)' }}>{sucursalMap[v.sucursal_id] || `#${v.sucursal_id}`}</td>
              <td><Chip color={METODO_PAGO_COLOR[v.metodo_pago]}>{METODO_PAGO_LABEL[v.metodo_pago]}</Chip></td>
              <td><strong>{formatARS(v.total)}</strong></td>
              <td><Chip color={v.estado === 'confirmada' ? 'green' : v.estado === 'abierta' ? 'gold' : 'red'}>{v.estado}</Chip></td>
              <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {v.estado === 'abierta' && <button className="btn btn-ghost btn-xs" onClick={() => confirmar(v.id)}>Confirmar</button>}
                <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ msg: `¿Eliminar venta?`, fn: () => eliminar(v.id) })}>✕</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
    </div>
    {modal && <ModalVenta onClose={() => setModal(false)} onSaved={cargar} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
  </>)
}