import { useState, useEffect, useRef } from 'react'
import { comprasApi, productosApi, categoriasProductoApi } from '../api'
import { useToast } from '../components/Toast'
import { useSucursal } from '../context/SucursalContext'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`
const METODOS = ['efectivo', 'transferencia', 'tarjeta']
const CHIP = { efectivo: 'chip-green', transferencia: 'chip-blue', tarjeta: 'chip-gray' }

// ─── DISTRIBUIDOR ─────────────────────────────────────────────────────────────
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
            <input type="number" min="0" max={total}
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

// ─── MODAL IA — CONFIRMACIÓN ──────────────────────────────────────────────────
function ModalIAConfirmacion({ resultado, productos, sucursales, onConfirm, onClose }) {
  const toast = useToast()
  const variantesFlat = productos.flatMap(p =>
    (p.variantes || []).filter(v => v.activa).map(v => ({
      ...v,
      label: `${p.nombre}${v.sabor ? ' · ' + v.sabor : ''}${v.tamanio ? ' · ' + v.tamanio : ''}`,
      marca: p.marca,
      nombre_producto: p.nombre,
    }))
  )

  // ─── MATCHING MEJORADO ────────────────────────────────────────────────────
  // Tabla de alias: términos del proveedor → términos normalizados en tu sistema
  const ALIAS = {
    // Marcas
    'star': 'star nutrition', 'gold': 'gold nutrition', 'gold nutrtion': 'gold nutrition',
    // Productos
    'crea mono': 'creatina monohidrato', 'creatina mono': 'creatina monohidrato',
    'collagen plus': 'colageno plus', 'collagen sport': 'colageno sport',
    'whey pr': 'whey protein', 'plat whey': 'whey protein', 'protein bar': 'barra de proteina',
    'pr bar': 'barra de proteina', 'truemade': '',
    // Sabores
    'ch': 'chocolate', 'va': 'vainilla', 'c&c': 'cookies and cream',
    'fr': 'frutilla', 'lim': 'limon', 'nar': 'naranja',
    // Tamaños
    '2lb': '2lb', '2 l': '2lb', '2lb': '2lb',
    '300 gr': '300gr', '300gr': '300gr', '360gr': '360gr', '360 gr': '360gr',
    // Neutro
    ' s ': ' neutro ', ' s$': ' neutro',
    // Ignorar
    'dpk': '', 'br': '', 'u ct': '', 'plus': 'plus',
  }

  const normalizar = (texto) => {
    if (!texto) return ''
    let t = texto.toLowerCase()
    // Aplicar alias de mayor a menor longitud (para evitar reemplazos parciales incorrectos)
    const aliasOrdenados = Object.entries(ALIAS).sort((a, b) => b[0].length - a[0].length)
    for (const [desde, hasta] of aliasOrdenados) {
      t = t.replace(new RegExp(desde, 'gi'), hasta)
    }
    // Limpiar espacios múltiples y caracteres no alfanuméricos
    return t.replace(/\s+/g, ' ').trim()
  }

  const hacerMatch = (descripcion, descripcionOriginal) => {
    // Intentamos con la descripción normalizada por Gemini primero, luego con la original
    const textos = [descripcion, descripcionOriginal].filter(Boolean)
    let mejor = null, mejorScore = 0

    for (const texto of textos) {
      const desc = normalizar(texto)
      for (const v of variantesFlat) {
        const etiqueta = normalizar(v.label + ' ' + v.marca + ' ' + (v.nombre_producto || ''))
        const palabrasDesc = desc.split(/\s+/).filter(p => p.length > 2)
        const palabrasLabel = etiqueta.split(/\s+/).filter(p => p.length > 2)

        // Score: cuántas palabras de la descripción aparecen en la etiqueta de la variante
        const coincidencias = palabrasDesc.filter(p => etiqueta.includes(p)).length
        // Bonus si la marca coincide exactamente
        const bonusMarca = palabrasDesc.some(p => etiqueta.startsWith(p)) ? 1 : 0
        const score = coincidencias + bonusMarca

        if (score > mejorScore) { mejorScore = score; mejor = v }
      }
    }
    // Requerir al menos 2 palabras coincidentes para evitar falsos positivos
    return mejorScore >= 2 ? mejor : null
  }

  const [items, setItems] = useState(() =>
    resultado.items_detectados.map(item => {
      const match = hacerMatch(item.descripcion || '', item.descripcion_original || '')
      return {
        descripcion_ia: item.descripcion_original || item.descripcion,
        descripcion_norm: item.descripcion,
        variante_id: match?.id || '',
        cantidad: item.cantidad,
        costo_unitario: Number(item.costo_unitario),
        distribucion: [],
        match_auto: !!match,
      }
    })
  )

  const [proveedor, setProveedor] = useState(resultado.proveedor_detectado || '')
  const [paso, setPaso] = useState(1)

  const setField = (i, k, v) => setItems(prev => prev.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const setDistribucion = (i, dist) => setItems(prev => prev.map((x, j) => j === i ? { ...x, distribucion: dist } : x))
  const removeItem = (i) => setItems(prev => prev.filter((_, j) => j !== i))
  const addItem = () => setItems(prev => [...prev, { descripcion_ia: '', variante_id: '', cantidad: 1, costo_unitario: 0, distribucion: [], match_auto: false }])

  const validar = () => {
    for (const item of items) {
      if (!item.variante_id) return false
      if (!item.cantidad || item.cantidad <= 0) return false
    }
    return items.length > 0
  }

  const confirmar = () => {
    if (!validar()) return toast('Todos los ítems deben tener variante y cantidad válida', 'error')
    onConfirm({
      proveedor,
      items: items.map(i => ({
        variante_id: Number(i.variante_id),
        cantidad: Number(i.cantidad),
        costo_unitario: Number(i.costo_unitario),
        distribucion: i.distribucion || [],
      }))
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">✨ Revisión de factura IA</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Confianza: {Math.round((resultado.confianza || 0) * 100)}%
              {resultado.total_detectado && ` · Total detectado: ${fmt(resultado.total_detectado)}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {[1, 2].map(n => (
              <div key={n} style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: paso === n ? 'var(--gold)' : paso > n ? 'var(--green)' : 'var(--surface3)',
                color: paso === n || paso > n ? '#000' : 'var(--text-muted)',
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
              <div className="form-group">
                <label className="form-label">Proveedor</label>
                <input className="form-input" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej: Nutri Argentina" />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                La IA detectó <strong style={{ color: 'var(--text)' }}>{items.length} ítems</strong>. Revisá cada uno y corregí si es necesario.
              </div>

              {items.map((item, i) => {
                const varianteSel = variantesFlat.find(v => v.id === Number(item.variante_id))
                return (
                  <div key={i} style={{
                    background: 'var(--surface2)', borderRadius: 10, padding: 14, marginBottom: 10,
                    border: `1px solid ${item.variante_id ? 'var(--border)' : 'rgba(224,85,85,0.3)'}`,
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Detectado por IA
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--gold-light)', fontStyle: 'italic' }}>
                          "{item.descripcion_ia || 'Sin descripción'}"
                        </div>
                        {item.descripcion_norm && item.descripcion_norm !== item.descripcion_ia && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            → {item.descripcion_norm}
                          </div>
                        )}
                        {item.match_auto && item.variante_id && (
                          <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
                            ✓ Match automático encontrado
                          </div>
                        )}
                        {!item.match_auto && (
                          <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
                            ⚠ No se encontró match — seleccioná la variante manualmente
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeItem(i)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0 }}>✕</button>
                    </div>

                    <div className="form-row">
                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label className="form-label">Variante del sistema *</label>
                        <select
                          className="form-select"
                          value={item.variante_id}
                          onChange={e => setField(i, 'variante_id', e.target.value)}
                          style={{ borderColor: item.variante_id ? 'var(--border)' : 'var(--red)' }}
                        >
                          <option value="">— Seleccioná la variante —</option>
                          {variantesFlat.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row" style={{ marginTop: 10 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Cantidad</label>
                        <input className="form-input" type="number" min="1"
                          value={item.cantidad}
                          onChange={e => setField(i, 'cantidad', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Costo unitario ($)</label>
                        <input className="form-input" type="number" min="0"
                          value={item.costo_unitario}
                          onChange={e => setField(i, 'costo_unitario', e.target.value)} />
                      </div>
                    </div>

                    {item.variante_id && (
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        Subtotal: <strong style={{ color: 'var(--text)' }}>{fmt(item.cantidad * item.costo_unitario)}</strong>
                      </div>
                    )}
                  </div>
                )
              })}

              <button className="btn btn-ghost btn-sm" onClick={addItem} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                + Agregar ítem manualmente
              </button>

              <div style={{ textAlign: 'right', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--gold-light)' }}>
                Total: {fmt(items.reduce((s, i) => s + (Number(i.cantidad) * Number(i.costo_unitario)), 0))}
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                Distribuí el stock entre las sucursales. Lo que no distribuyas queda en el <strong style={{ color: 'var(--text)' }}>depósito central</strong>.
              </div>
              {items.map((item, i) => {
                const v = variantesFlat.find(x => x.id === Number(item.variante_id))
                return (
                  <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      {v?.label || `Variante #${item.variante_id}`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {item.cantidad} unidades · {fmt(item.cantidad * item.costo_unitario)}
                    </div>
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
              <button className="btn btn-ghost" onClick={() => confirmar()}>Guardar (todo a central)</button>
              <button className="btn btn-primary" onClick={() => { if (!validar()) return toast('Completá todos los campos', 'error'); setPaso(2) }}>
                Distribuir por sucursal →
              </button>
            </>
          )}
          {paso === 2 && (
            <>
              <button className="btn btn-ghost" onClick={() => setPaso(1)}>← Volver</button>
              <button className="btn btn-primary" onClick={confirmar}>Confirmar compra ✓</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MODAL IA — UPLOAD ────────────────────────────────────────────────────────
function ModalIA({ sucursales, productos, metodo, sucursalId, onClose, onSaved }) {
  const toast = useToast()
  const [archivo, setArchivo] = useState(null)
  const [analizando, setAnalizando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const fileRef = useRef()

  const analizar = async () => {
    if (!archivo) return toast('Seleccioná un archivo', 'error')
    setAnalizando(true)
    try {
      const form = new FormData()
      form.append('archivo', archivo)
      const res = await comprasApi.analizarFactura(form)
      setResultado(res)
    } catch (e) { toast(e.message || 'Error al analizar', 'error') }
    finally { setAnalizando(false) }
  }

  const confirmarCompra = async ({ proveedor, items }) => {
    setGuardando(true)
    try {
      await comprasApi.crear({
        proveedor: proveedor || null,
        sucursal_id: Number(sucursalId),
        metodo_pago: metodo,
        items: items.map(i => ({
          variante_id: i.variante_id,
          cantidad: i.cantidad,
          costo_unitario: i.costo_unitario,
          distribucion: (i.distribucion || []).filter(d => d.cantidad > 0),
        }))
      })
      toast('Compra registrada exitosamente')
      onSaved()
    } catch (e) { toast(e.message, 'error') }
    finally { setGuardando(false) }
  }

  if (resultado) {
    return (
      <ModalIAConfirmacion
        resultado={resultado}
        productos={productos}
        sucursales={sucursales}
        onConfirm={confirmarCompra}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">✨ Cargar factura con IA</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="ia-banner">
            <div className="ia-banner-icon">🧾</div>
            <div className="ia-banner-text">
              <div className="ia-banner-title">Gemini analiza tu factura</div>
              <div className="ia-banner-desc">Subí una foto o PDF de tu recibo y la IA detectará automáticamente los productos, cantidades y precios.</div>
            </div>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed var(--border)', borderRadius: 12, padding: 32,
              textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s',
              background: archivo ? 'var(--surface2)' : 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{archivo ? '📄' : '📁'}</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              {archivo ? archivo.name : 'Hacer clic para seleccionar'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              JPG, PNG o PDF · máx. 10MB
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
              onChange={e => setArchivo(e.target.files[0] || null)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={analizar} disabled={!archivo || analizando}>
            {analizando ? '⏳ Analizando...' : '✨ Analizar con IA'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL COMPRA MANUAL ──────────────────────────────────────────────────────
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
  const [paso, setPaso] = useState(1)

  const variantesFlat = productos.flatMap(p => p.variantes?.filter(v => v.activa).map(v => ({
    ...v,
    label: `${p.nombre}${p.marca ? ' · ' + p.marca : ''} — ${[v.sabor, v.tamanio].filter(Boolean).join(' · ')}`,
    nombre_producto: p.nombre,
    marca: p.marca,
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

  const save = async () => {
    if (!sucursalId) return toast('Seleccioná una sucursal', 'error')
    if (items.length === 0) return toast('Agregá al menos un producto', 'error')
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
                        <div className="carrito-nombre">
                          <span>{v?.nombre_producto || `Variante #${item.variante_id}`}</span>
                          {v?.marca && <span style={{ color: 'var(--text-muted)', marginLeft: 5 }}>· {v.marca}</span>}
                        </div>
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

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────
export default function Compras() {
  const toast = useToast()
  const { sucursales, sucursalActual } = useSucursal()
  const [compras, setCompras] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)       // null | 'nuevo' | compra
  const [modalIA, setModalIA] = useState(false)
  const [metodoIA, setMetodoIA] = useState('efectivo')
  const [sucursalIA, setSucursalIA] = useState('')

  useEffect(() => {
    if (sucursalActual) { setSucursalIA(String(sucursalActual.id)) }
  }, [sucursalActual?.id])

  const cargar = () => {
    setLoading(true)
    Promise.all([
      comprasApi.listar({}),
      productosApi.listar(),
    ]).then(([c, p]) => { setCompras(c); setProductos(p) }).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta compra? El stock se revertirá.')) return
    try { await comprasApi.eliminar(id); toast('Compra eliminada'); cargar() }
    catch (e) { toast(e.message, 'error') }
  }

  const getNombreSucursal = (id) => sucursales.find(s => s.id === id)?.nombre || `#${id}`

  return (
    <>
      <div className="topbar">
        <div className="page-title">Compras</div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={() => setModalIA(true)} style={{ gap: 6 }}>
            ✨ Cargar con IA
          </button>
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

      {modalIA && (
        <ModalIA
          sucursales={sucursales}
          productos={productos}
          metodo={metodoIA}
          sucursalId={sucursalIA || sucursales[0]?.id}
          onClose={() => setModalIA(false)}
          onSaved={() => { setModalIA(false); cargar() }}
        />
      )}
    </>
  )
}
