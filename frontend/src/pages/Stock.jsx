import { useState, useEffect } from 'react'
import { productosApi } from '../api'
import { useToast } from '../components/Toast'
import { useSucursal } from '../context/SucursalContext'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`

const EMOJI = { proteina: '🥛', creatina: '⚡', 'pre-workout': '🔥', bcaa: '💊', otro: '📦' }
const getEmoji = (cat) => EMOJI[cat?.toLowerCase()] || '📦'

function ModalProducto({ prod, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(prod || { nombre: '', marca: '', categoria: 'proteina', imagen_url: '' })
  const [variantes, setVariantes] = useState(
    prod?.variantes?.length > 0
      ? prod.variantes.filter(v => v.activa)
      : [{ sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0, stock_actual: 0 }]
  )
  const [saving, setSaving] = useState(false)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setV = (i, k, v) => setVariantes(vs => vs.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const addVariante = () => setVariantes(vs => [...vs, { sabor: '', tamanio: '', costo: '', precio_venta: '', stock_minimo: 0, stock_actual: 0 }])
  const removeVariante = (i) => setVariantes(vs => vs.filter((_, j) => j !== i))

  const save = async () => {
    if (!form.nombre) return toast('El nombre es obligatorio', 'error')
    setSaving(true)
    try {
      if (prod) {
        // Update product info
        await productosApi.actualizar(prod.id, {
          nombre: form.nombre, marca: form.marca, categoria: form.categoria, imagen_url: form.imagen_url
        })
        // Update or create variantes
        for (const v of variantes) {
          const payload = {
            sabor: v.sabor, tamanio: v.tamanio, sku: v.sku,
            costo: parseFloat(v.costo) || 0,
            precio_venta: parseFloat(v.precio_venta) || 0,
            stock_minimo: parseInt(v.stock_minimo) || 0,
          }
          if (v.id) {
            await productosApi.actualizarVariante(v.id, payload)
            // If stock changed, update it
            if (v.stock_actual !== undefined) {
              await productosApi.ajustarStock(v.id, parseInt(v.stock_actual) || 0)
            }
          } else {
            // New variant
            const created = await productosApi.crearVariante(prod.id, payload)
            // Set stock if non-zero
            if (parseInt(v.stock_actual) > 0) {
              await productosApi.ajustarStock(created.id, parseInt(v.stock_actual) || 0)
            }
          }
        }
      } else {
        const payload = {
          ...form,
          variantes: variantes.map(v => ({
            sabor: v.sabor, tamanio: v.tamanio, sku: v.sku,
            costo: parseFloat(v.costo) || 0,
            precio_venta: parseFloat(v.precio_venta) || 0,
            stock_minimo: parseInt(v.stock_minimo) || 0,
          }))
        }
        const created = await productosApi.crear(payload)
        // Set initial stocks
        for (let i = 0; i < variantes.length; i++) {
          if (parseInt(variantes[i].stock_actual) > 0 && created.variantes?.[i]?.id) {
            await productosApi.ajustarStock(created.variantes[i].id, parseInt(variantes[i].stock_actual) || 0)
          }
        }
      }
      toast(prod ? 'Producto actualizado' : 'Producto creado')
      onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{prod ? 'Editar producto' : 'Nuevo producto'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Ej: Whey Gold Standard" />
            </div>
            <div className="form-group">
              <label className="form-label">Marca</label>
              <input className="form-input" value={form.marca || ''} onChange={e => setF('marca', e.target.value)} placeholder="Ej: Optimum Nutrition" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.categoria || ''} onChange={e => setF('categoria', e.target.value)}>
                <option value="proteina">Proteína</option>
                <option value="creatina">Creatina</option>
                <option value="pre-workout">Pre-Workout</option>
                <option value="bcaa">BCAA</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">URL de imagen</label>
              <input className="form-input" value={form.imagen_url || ''} onChange={e => setF('imagen_url', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="form-label" style={{ margin: 0 }}>Variantes</div>
              <button className="btn btn-ghost btn-sm" onClick={addVariante}>+ Agregar variante</button>
            </div>
            {variantes.map((v, i) => (
              <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, marginBottom: 10, position: 'relative' }}>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Sabor</label>
                    <input className="form-input" value={v.sabor || ''} onChange={e => setV(i, 'sabor', e.target.value)} placeholder="Chocolate" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tamaño</label>
                    <input className="form-input" value={v.tamanio || ''} onChange={e => setV(i, 'tamanio', e.target.value)} placeholder="1kg" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU</label>
                    <input className="form-input" value={v.sku || ''} onChange={e => setV(i, 'sku', e.target.value)} placeholder="WHY-CHOC-1K" />
                  </div>
                </div>
                <div className="form-row-3">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Costo ($)</label>
                    <input className="form-input" type="number" value={v.costo || ''} onChange={e => setV(i, 'costo', e.target.value)} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Precio venta ($)</label>
                    <input className="form-input" type="number" value={v.precio_venta || ''} onChange={e => setV(i, 'precio_venta', e.target.value)} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Stock mínimo</label>
                    <input className="form-input" type="number" value={v.stock_minimo || ''} onChange={e => setV(i, 'stock_minimo', e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div className="form-group" style={{ margin: '10px 0 0' }}>
                  <label className="form-label">Stock actual (unidades)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={v.stock_actual ?? ''}
                    onChange={e => setV(i, 'stock_actual', e.target.value)}
                    placeholder="0"
                    style={{ maxWidth: 140 }}
                  />
                </div>
                {variantes.length > 1 && (
                  <button onClick={() => removeVariante(i)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                )}
              </div>
            ))}
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

function ModalLote({ producto, onClose, onSaved }) {
  const toast = useToast()
  const [modo, setModo] = useState('porcentaje')
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!valor) return toast('Ingresá un valor', 'error')
    setSaving(true)
    try {
      await productosApi.ajustarPrecioLote({ producto_id: producto.id, modo, valor: parseFloat(valor) })
      toast('Precios actualizados')
      onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const modos = [
    { id: 'porcentaje', label: '+/- Porcentaje', hint: 'Ej: 10 sube 10%, -5 baja 5%' },
    { id: 'margen_deseado', label: 'Margen deseado', hint: 'Ej: 40 = 40% sobre el costo' },
    { id: 'precio_fijo', label: 'Precio fijo', hint: 'Sobreescribe con un valor fijo en ARS' },
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Ajuste de precios — {producto.nombre}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {modos.map(m => (
              <button key={m.id} className={`btn ${modo === m.id ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setModo(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">{modos.find(m => m.id === modo)?.hint}</label>
            <input className="form-input" type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder={modo === 'precio_fijo' ? '15000' : '10'} />
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
            Se aplicará a <strong style={{ color: 'var(--text)' }}>{producto.variantes?.filter(v => v.activa)?.length || 0} variantes</strong> del producto
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Aplicando...' : 'Aplicar'}</button>
        </div>
      </div>
    </div>
  )
}

// Inline editable stock number
function StockEditable({ variante, onSaved }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(variante.stock_actual)

  const save = async () => {
    try {
      await productosApi.ajustarStock(variante.id, parseInt(val) || 0)
      toast('Stock actualizado')
      setEditing(false)
      onSaved()
    } catch (e) { toast(e.message, 'error') }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          min="0"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus
          style={{ width: 60, background: 'var(--surface3)', border: '1px solid var(--gold)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 14, textAlign: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}
        />
        <button onClick={save} style={{ background: 'var(--gold)', border: 'none', borderRadius: 4, color: '#000', cursor: 'pointer', padding: '4px 8px', fontSize: 11 }}>✓</button>
        <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px', fontSize: 11 }}>✕</button>
      </div>
    )
  }

  const getStockColor = (actual, minimo) => {
    if (actual <= 0) return 'var(--red)'
    if (actual <= minimo) return 'var(--red)'
    if (actual <= minimo * 2) return 'var(--gold)'
    return 'var(--green)'
  }

  return (
    <div
      className="stock-qty"
      onClick={() => { setVal(variante.stock_actual); setEditing(true) }}
      style={{ cursor: 'pointer' }}
      title="Click para editar stock"
    >
      <div className="stock-qty-num" style={{ color: getStockColor(variante.stock_actual, variante.stock_minimo) }}>
        {variante.stock_actual}
      </div>
      <div className="stock-qty-label">unidades ✎</div>
    </div>
  )
}

export default function Stock() {
  const toast = useToast()
  const { sucursalActual } = useSucursal()
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [modal, setModal] = useState(null)
  const [modalLote, setModalLote] = useState(null)

  const cargar = () => {
    setLoading(true)
    const params = {}
    if (busqueda) params.busqueda = busqueda
    if (categoria) params.categoria = categoria
    productosApi.listar(params).then(setProductos).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [busqueda, categoria])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    try {
      await productosApi.eliminar(id)
      toast('Producto eliminado')
      cargar()
    } catch (e) { toast(e.message, 'error') }
  }

  const getStockColor = (actual, minimo) => {
    if (actual <= 0) return 'var(--red)'
    if (actual <= minimo) return 'var(--red)'
    if (actual <= minimo * 2) return 'var(--gold)'
    return 'var(--green)'
  }

  const getStockPct = (actual, minimo) => Math.min(100, Math.max(5, (actual / Math.max(minimo * 3, 10)) * 100))

  return (
    <>
      <div className="topbar">
        <div className="page-title">
          Stock
          {sucursalActual && (
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>
              — {sucursalActual.nombre}
            </span>
          )}
        </div>
        <div className="topbar-actions">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Buscar por nombre, marca..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 'auto', padding: '9px 14px' }} value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            <option value="proteina">Proteína</option>
            <option value="creatina">Creatina</option>
            <option value="pre-workout">Pre-Workout</option>
            <option value="bcaa">BCAA</option>
            <option value="otro">Otro</option>
          </select>
          <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Nuevo producto</button>
        </div>
      </div>

      <div className="content page-enter">
        {loading
          ? <div className="loading">Cargando...</div>
          : productos.length === 0
          ? <div className="empty">No hay productos. ¡Creá el primero!</div>
          : (
            <div className="grid-2">
              {productos.map(prod => (
                <div className="card" key={prod.id}>
                  <div className="card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{getEmoji(prod.categoria)}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{prod.nombre}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{prod.marca}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModalLote(prod)}>Precios</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(prod)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminar(prod.id)}>✕</button>
                    </div>
                  </div>
                  {prod.variantes?.filter(v => v.activa).length > 0
                    ? prod.variantes.filter(v => v.activa).map(v => (
                      <div className="stock-item" key={v.id}>
                        <div className="stock-info">
                          <div className="stock-name">{[v.sabor, v.tamanio].filter(Boolean).join(' · ') || 'Sin variante'}</div>
                          <div className="stock-variant">Costo: {fmt(v.costo)} · Precio: {fmt(v.precio_venta)}</div>
                        </div>
                        <div className="stock-bar-wrap">
                          <div className="stock-bar" style={{
                            width: `${getStockPct(v.stock_actual, v.stock_minimo)}%`,
                            background: getStockColor(v.stock_actual, v.stock_minimo)
                          }} />
                        </div>
                        <StockEditable variante={v} onSaved={cargar} />
                      </div>
                    ))
                    : <div className="empty">Sin variantes</div>
                  }
                </div>
              ))}
            </div>
          )
        }
      </div>

      {modal && (
        <ModalProducto
          prod={modal === 'nuevo' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}
      {modalLote && (
        <ModalLote
          producto={modalLote}
          onClose={() => setModalLote(null)}
          onSaved={() => { setModalLote(null); cargar() }}
        />
      )}
    </>
  )
}
