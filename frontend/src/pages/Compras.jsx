import { useState, useEffect } from 'react'
import { comprasApi, sucursalesApi, productosApi } from '../api'
import { useToast } from '../components/Toast'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const METODOS = ['efectivo', 'transferencia', 'tarjeta']
const CHIP = { efectivo: 'chip-green', transferencia: 'chip-blue', tarjeta: 'chip-gray' }

function ModalCompra({ compra, sucursales, productos, onClose, onSaved }) {
  const toast = useToast()
  const [proveedor, setProveedor] = useState(compra?.proveedor || '')
  const [sucursalId, setSucursalId] = useState(compra?.sucursal_id || sucursales[0]?.id || '')
  const [metodo, setMetodo] = useState(compra?.metodo_pago || 'efectivo')
  const [notas, setNotas] = useState(compra?.notas || '')
  const [items, setItems] = useState(compra?.items?.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad, costo_unitario: i.costo_unitario })) || [])
  const [busqProd, setBusqProd] = useState('')
  const [saving, setSaving] = useState(false)

  const variantesFlat = productos.flatMap(p => p.variantes?.filter(v => v.activa).map(v => ({
    ...v, label: `${p.nombre} — ${[v.sabor, v.tamanio].filter(Boolean).join(' · ')}`,
  })) || [])

  const filtradas = variantesFlat.filter(v => v.label.toLowerCase().includes(busqProd.toLowerCase()))

  const addItem = (variante) => {
    setItems(prev => {
      const exists = prev.find(i => i.variante_id === variante.id)
      if (exists) return prev.map(i => i.variante_id === variante.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { variante_id: variante.id, cantidad: 1, costo_unitario: Number(variante.costo) }]
    })
    setBusqProd('')
  }

  const setField = (i, k, v) => setItems(prev => prev.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const removeItem = (i) => setItems(prev => prev.filter((_, j) => j !== i))
  const total = items.reduce((s, i) => s + (Number(i.cantidad) * Number(i.costo_unitario)), 0)

  const save = async () => {
    if (!sucursalId) return toast('Seleccioná una sucursal', 'error')
    if (items.length === 0) return toast('Agregá al menos un producto', 'error')
    setSaving(true)
    try {
      const payload = {
        proveedor: proveedor || null, sucursal_id: Number(sucursalId), metodo_pago: metodo, notas: notas || null,
        items: items.map(i => ({ variante_id: Number(i.variante_id), cantidad: Number(i.cantidad), costo_unitario: Number(i.costo_unitario) }))
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
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
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
                    <div key={v.id} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                      onMouseDown={() => addItem(v)}>
                      {v.label} — Costo actual: <span style={{ color: 'var(--gold-light)' }}>{fmt(v.costo)}</span>
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
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function ModalIA({ productos, sucursales, onClose, onSaved }) {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [analizando, setAnalizando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [items, setItems] = useState([])
  const [sucursalId, setSucursalId] = useState(sucursales[0]?.id || '')
  const [metodo, setMetodo] = useState('transferencia')
  const [proveedor, setProveedor] = useState('')
  const [saving, setSaving] = useState(false)

  const variantesFlat = productos.flatMap(p => p.variantes?.filter(v => v.activa).map(v => ({
    ...v, label: `${p.nombre} — ${[v.sabor, v.tamanio].filter(Boolean).join(' · ')}`,
  })) || [])

  const analizar = async () => {
    if (!file) return toast('Seleccioná una imagen o PDF', 'error')
    setAnalizando(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const r = await comprasApi.analizarFactura(fd)
      setResultado(r)
      setProveedor(r.proveedor_detectado || '')
      setItems(r.items_detectados.map(i => ({ ...i, variante_id: '' })))
      toast(`IA detectó ${r.items_detectados.length} productos (confianza: ${Math.round(r.confianza * 100)}%)`)
    } catch (e) { toast(e.message, 'error') } finally { setAnalizando(false) }
  }

  const setField = (i, k, v) => setItems(prev => prev.map((x, j) => j === i ? { ...x, [k]: v } : x))

  const confirmar = async () => {
    const validos = items.filter(i => i.variante_id)
    if (validos.length === 0) return toast('Asigná al menos un producto', 'error')
    setSaving(true)
    try {
      await comprasApi.crear({
        proveedor: proveedor || null, sucursal_id: Number(sucursalId), metodo_pago: metodo, notas: 'Cargado con IA',
        items: validos.map(i => ({ variante_id: Number(i.variante_id), cantidad: Number(i.cantidad), costo_unitario: Number(i.costo_unitario) }))
      })
      toast('Compra confirmada y stock actualizado')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">🤖 Cargar factura con IA</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {!resultado ? (
            <>
              <div style={{ background: 'var(--surface2)', border: '2px dashed var(--border)', borderRadius: 12, padding: 32, textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Subí una foto o PDF de tu factura</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>JPG, PNG o PDF — la IA detecta productos, cantidades y precios</div>
                <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} id="file-input" />
                <label htmlFor="file-input" className="btn btn-ghost" style={{ cursor: 'pointer' }}>Seleccionar archivo</label>
                {file && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--green)' }}>✓ {file.name}</div>}
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={analizar} disabled={analizando || !file}>
                {analizando ? 'Analizando con IA...' : 'Analizar factura'}
              </button>
            </>
          ) : (
            <>
              <div style={{ background: 'rgba(76,175,122,0.08)', border: '1px solid rgba(76,175,122,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                ✓ IA detectó {items.length} productos · Confianza: {Math.round(resultado.confianza * 100)}% · Revisá y asigná cada producto antes de confirmar
              </div>
              <div className="form-row" style={{ marginBottom: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Proveedor</label>
                  <input className="form-input" value={proveedor} onChange={e => setProveedor(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Sucursal</label>
                  <select className="form-select" value={sucursalId} onChange={e => setSucursalId(e.target.value)}>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
              {items.map((item, i) => (
                <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Detectado: "{item.descripcion || 'Producto'}"</div>
                  <div className="form-row-3">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Producto en sistema</label>
                      <select className="form-select" value={item.variante_id} onChange={e => setField(i, 'variante_id', e.target.value)}>
                        <option value="">-- Asignar --</option>
                        {variantesFlat.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Cantidad</label>
                      <input className="form-input" type="number" value={item.cantidad} onChange={e => setField(i, 'cantidad', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Costo unitario ($)</label>
                      <input className="form-input" type="number" value={item.costo_unitario} onChange={e => setField(i, 'costo_unitario', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        {resultado && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={confirmar} disabled={saving}>{saving ? 'Confirmando...' : 'Confirmar y sumar al stock'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Compras() {
  const toast = useToast()
  const [compras, setCompras] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [modalIA, setModalIA] = useState(false)

  const cargar = () => {
    setLoading(true)
    Promise.all([comprasApi.listar(), sucursalesApi.listar(), productosApi.listar()])
      .then(([c, s, p]) => { setCompras(c); setSucursales(s); setProductos(p) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta compra? Revertirá el stock.')) return
    try { await comprasApi.eliminar(id); toast('Compra eliminada'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Compras</div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setModalIA(true)}>🤖 Cargar factura con IA</button>
          <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Registrar compra</button>
        </div>
      </div>
      <div className="content page-enter">
        <div className="ia-banner">
          <div className="ia-banner-icon">🤖</div>
          <div className="ia-banner-text">
            <div className="ia-banner-title">Carga inteligente de facturas</div>
            <div className="ia-banner-desc">Subí una foto o PDF y la IA detecta los productos, cantidades y precios. Confirmás vos antes de que sume al stock.</div>
          </div>
          <button className="btn btn-primary" onClick={() => setModalIA(true)}>Subir factura</button>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Historial de compras</span></div>
          {loading ? <div className="loading">Cargando...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Proveedor</th><th>Pago</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {compras.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Sin compras registradas</td></tr>}
                  {compras.map(c => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(c.fecha).toLocaleDateString('es-AR')}</td>
                      <td>{c.proveedor || '—'}</td>
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
      {modal && <ModalCompra compra={modal === 'nuevo' ? null : modal} sucursales={sucursales} productos={productos} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar() }} />}
      {modalIA && <ModalIA productos={productos} sucursales={sucursales} onClose={() => setModalIA(false)} onSaved={() => { setModalIA(false); cargar() }} />}
    </>
  )
}
