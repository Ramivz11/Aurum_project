import { useState, useEffect } from 'react'
import { comprasApi, sucursalesApi, productosApi } from '../api'
import { useToast } from '../components/Toast'
import { useSucursal } from '../context/SucursalContext'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const METODOS = ['efectivo', 'transferencia', 'tarjeta']
const CHIP = { efectivo: 'chip-green', transferencia: 'chip-blue', tarjeta: 'chip-gray' }

// ─── DISTRIBUIDOR POR SUCURSAL ────────────────────────────────────────────────
function Distribuidor({ item, sucursales, onChange }) {
  const total = parseInt(item.cantidad) || 0
  const distribucion = item.distribucion || []
  const distribuido = distribucion.reduce((s, d) => s + (parseInt(d.cantidad) || 0), 0)
  const aCentral = Math.max(0, total - distribuido)

  const setCant = (sucursalId, cant) => {
    const val = parseInt(cant) || 0
    const nueva = sucursales.map(s => ({
      sucursal_id: s.id,
      cantidad: s.id === sucursalId ? val : (distribucion.find(d => d.sucursal_id === s.id)?.cantidad || 0)
    })).filter(d => d.cantidad > 0)
    onChange(nueva)
  }

  if (total === 0) return null

  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface3)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Distribución ({total} u.)
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-dim)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>Central</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: aCentral > 0 ? 'var(--text)' : 'var(--text-dim)' }}>{aCentral}</span>
        </div>
        {sucursales.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.nombre}</span>
            <input
              type="number"
              min="0"
              max={total}
              value={distribucion.find(d => d.sucursal_id === s.id)?.cantidad || ''}
              onChange={e => setCant(s.id, e.target.value)}
              placeholder="0"
              style={{ width: 50, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '3px 6px', fontSize: 12, textAlign: 'center' }}
            />
          </div>
        ))}
      </div>
      {distribuido > total && (
        <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>⚠ La distribución ({distribuido}) supera la cantidad ({total})</div>
      )}
    </div>
  )
}

// ─── MODAL COMPRA ─────────────────────────────────────────────────────────────
function ModalCompra({ compra, sucursales, productos, onClose, onSaved }) {
  const toast = useToast()
  const [proveedor, setProveedor] = useState(compra?.proveedor || '')
  const [sucursalId, setSucursalId] = useState(compra?.sucursal_id || sucursales[0]?.id || '')
  const [metodo, setMetodo] = useState(compra?.metodo_pago || 'efectivo')
  const [notas, setNotas] = useState(compra?.notas || '')
  const [items, setItems] = useState(
    compra?.items?.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad, costo_unitario: i.costo_unitario, distribucion: [] })) || []
  )
  const [busqProd, setBusqProd] = useState('')
  const [saving, setSaving] = useState(false)
  const [paso, setPaso] = useState(1) // 1=compra, 2=distribución

  const variantesFlat = productos.flatMap(p => p.variantes?.filter(v => v.activa).map(v => ({
    ...v, label: `${p.nombre} — ${[v.sabor, v.tamanio].filter(Boolean).join(' · ')}`,
  })) || [])

  const filtradas = variantesFlat.filter(v => v.label.toLowerCase().includes(busqProd.toLowerCase()))

  const addItem = (variante) => {
    setItems(prev => {
      const exists = prev.find(i => i.variante_id === variante.id)
      if (exists) return prev.map(i => i.variante_id === variante.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { variante_id: variante.id, cantidad: 1, costo_unitario: Number(variante.costo), distribucion: [] }]
    })
    setBusqProd('')
  }

  const setField = (i, k, v) => setItems(prev => prev.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const setDistribucion = (i, dist) => setItems(prev => prev.map((x, j) => j === i ? { ...x, distribucion: dist } : x))
  const removeItem = (i) => setItems(prev => prev.filter((_, j) => j !== i))
  const total = items.reduce((s, i) => s + (Number(i.cantidad) * Number(i.costo_unitario)), 0)

  const validarDistribucion = () => {
    for (const item of items) {
      const dist = item.distribucion || []
      const distribuido = dist.reduce((s, d) => s + (parseInt(d.cantidad) || 0), 0)
      if (distribuido > parseInt(item.cantidad)) return false
    }
    return true
  }

  const save = async () => {
    if (!sucursalId) return toast('Seleccioná una sucursal', 'error')
    if (items.length === 0) return toast('Agregá al menos un producto', 'error')
    if (!validarDistribucion()) return toast('La distribución supera la cantidad en algún ítem', 'error')
    setSaving(true)
    try {
      const payload = {
        proveedor: proveedor || null,
        sucursal_id: Number(sucursalId),
        metodo_pago: metodo,
        notas: notas || null,
        items: items.map(i => ({
          variante_id: Number(i.variante_id),
          cantidad: Number(i.cantidad),
          costo_unitario: Number(i.costo_unitario),
          distribucion: (i.distribucion || []).map(d => ({ sucursal_id: d.sucursal_id, cantidad: parseInt(d.cantidad) || 0 })).filter(d => d.cantidad > 0)
        }))
      }
      if (compra) await comprasApi.actualizar(compra.id, payload)
      else await comprasApi.crear(payload)
      toast(compra ? 'Compra actualizada' : 'Compra registrada')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{compra ? 'Editar compra' : 'Registrar compra'}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Steps */}
            {[1, 2].map(n => (
              <div key={n} style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: paso === n ? 'var(--gold)' : paso > n ? 'var(--green)' : 'var(--surface3)',
                color: paso === n ? '#000' : paso > n ? '#000' : 'var(--text-muted)',
                cursor: paso > n ? 'pointer' : 'default',
              }} onClick={() => paso > n && setPaso(n)}>
                {paso > n ? '✓' : n}
              </div>
            ))}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          {paso === 1 && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Proveedor (opcional)</label>
                  <input className="form-input" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej: Nutri Argentina" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sucursal *</label>
                  <select className="form-select" value={sucursalId} onChange={e => setSucursalId(e.target.value)}>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Método de pago</label>
                <select className="form-select" value={metodo} onChange={e => setMetodo(e.target.value)}>
                  {METODOS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Agregar producto</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" placeholder="Buscar producto..." value={busqProd} onChange={e => setBusqProd(e.target.value)} />
                  {busqProd && filtradas.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                      {filtradas.slice(0, 8).map(v => (
                        <div key={v.id} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                          onMouseDown={() => addItem(v)}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <span>{v.label}</span>
                          <span style={{ color: 'var(--gold-light)' }}>{fmt(v.costo)}</span>
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
                        <div className="carrito-nombre">{v?.label || `Variante #${item.variante_id}`}</div>
                        <input className="carrito-qty" type="number" min={1} value={item.cantidad} onChange={e => setField(i, 'cantidad', e.target.value)} />
                        <input className="carrito-precio" type="number" value={item.costo_unitario} onChange={e => setField(i, 'costo_unitario', e.target.value)} />
                        <div className="carrito-subtotal">{fmt(item.cantidad * item.costo_unitario)}</div>
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
                <textarea className="form-textarea" value={notas} onChange={e => setNotas(e.target.value)} />
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                Distribuí el stock de cada producto entre las sucursales. Lo que no distribuyas queda en el <strong style={{ color: 'var(--text)' }}>depósito central</strong>.
              </div>
              {items.map((item, i) => {
                const v = variantesFlat.find(x => x.id === Number(item.variante_id))
                return (
                  <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{v?.label || `Variante #${item.variante_id}`}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{item.cantidad} unidades · {fmt(item.cantidad * item.costo_unitario)}</div>
                    <Distribuidor item={item} sucursales={sucursales} onChange={(dist) => setDistribucion(i, dist)} />
                  </div>
                )
              })}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          {paso === 1 && (
            <>
              <button className="btn btn-ghost" onClick={save} disabled={saving || items.length === 0}>
                {saving ? 'Guardando...' : 'Guardar (todo a central)'}
              </button>
              <button className="btn btn-primary" onClick={() => { if (items.length === 0) return toast('Agregá al menos un producto', 'error'); setPaso(2) }}>
                Distribuir por sucursal →
              </button>
            </>
          )}
          {paso === 2 && (
            <>
              <button className="btn btn-ghost" onClick={() => setPaso(1)}>← Volver</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Confirmar compra'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Compras() {
  const toast = useToast()
  const { sucursales, sucursalActual } = useSucursal()
  const [compras, setCompras] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filtroSucursal, setFiltroSucursal] = useState('')

  useEffect(() => {
    if (sucursalActual) setFiltroSucursal(String(sucursalActual.id))
  }, [sucursalActual?.id])

  const cargar = () => {
    setLoading(true)
    Promise.all([
      comprasApi.listar(filtroSucursal ? { sucursal_id: filtroSucursal } : {}),
      productosApi.listar(),
    ]).then(([c, p]) => { setCompras(c); setProductos(p) }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [filtroSucursal])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta compra? El stock se revertirá.')) return
    try { await comprasApi.eliminar(id); toast('Compra eliminada'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const getNombreSucursal = (id) => sucursales.find(s => s.id === id)?.nombre || `#${id}`

  return (
    <>
      <div className="topbar">
        <div className="page-title">
          Compras
          {filtroSucursal && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>— {getNombreSucursal(Number(filtroSucursal))}</span>}
        </div>
        <div className="topbar-actions">
          <select className="form-select" style={{ width: 'auto', padding: '9px 14px' }} value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Registrar compra</button>
        </div>
      </div>

      <div className="content page-enter">
        <div className="card">
          <div className="card-header"><span className="card-title">Historial de compras</span></div>
          {loading ? <div className="loading">Cargando...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Proveedor</th><th>Sucursal</th><th>Pago</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {compras.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Sin compras</td></tr>}
                  {compras.map(c => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(c.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{c.proveedor || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td>{getNombreSucursal(c.sucursal_id)}</td>
                      <td><span className={`chip ${CHIP[c.metodo_pago]}`}>{c.metodo_pago}</span></td>
                      <td><strong>{fmt(c.total)}</strong></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => eliminar(c.id)}>✕</button>
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
        <ModalCompra
          compra={modal === 'nuevo' ? null : modal}
          sucursales={sucursales}
          productos={productos}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
    </>
  )
}
