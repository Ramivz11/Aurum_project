import { useState, useEffect, useRef } from 'react'
import { comprasApi, productosApi, sucursalesApi } from '../../api'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS, formatDate, METODO_PAGO_COLOR, METODO_PAGO_LABEL } from '../../components/ui'
import { useToast } from '../../components/Toast'

// ─── Modal: Cargar factura con IA ─────────────────────────────────────────────

function ModalIAFactura({ onClose, onFacturaCargada }) {
  const toast = useToast()
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analizando, setAnalizando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [diagnosData, setDiagnosData] = useState(null)
  const [diagnosLoading, setDiagnosLoading] = useState(false)
  const inputRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setArchivo(file)
    setResultado(null)
    setError(null)
    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file))
    } else {
      setPreview(null)
    }
  }

  const analizar = async () => {
    if (!archivo) return toast('Seleccioná un archivo primero', 'error')
    setAnalizando(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const r = await comprasApi.analizarFactura(formData)
      setResultado(r)
      toast(`✓ ${r.items_detectados?.length || 0} productos detectados`)
    } catch (e) {
      setError(e.message || 'Error al analizar')
      toast('No se pudo analizar la factura', 'error')
    } finally { setAnalizando(false) }
  }

  const diagnostico = async () => {
    setDiagnosLoading(true)
    setDiagnosData(null)
    try {
      const r = await comprasApi.diagnosticoIA()
      setDiagnosData(r)
    } catch (e) {
      toast('Error al hacer diagnóstico: ' + e.message, 'error')
    } finally { setDiagnosLoading(false) }
  }

  return (
    <Modal title="🤖 Cargar factura con IA" onClose={onClose} size="modal-lg"
      footer={
        resultado
          ? <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => { onFacturaCargada(resultado); onClose() }}>
                Usar estos datos → abrir compra
              </button></>
          : <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={analizar} disabled={!archivo || analizando}>
                {analizando ? '⏳ Analizando...' : '🔍 Analizar factura'}
              </button></>
      }
    >
      {!resultado ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Subí una foto o PDF de tu factura y la IA detectará automáticamente los productos, cantidades y precios.
          </p>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
            style={{
              border: `2px dashed ${archivo ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: 12, padding: 32, textAlign: 'center',
              cursor: 'pointer', background: archivo ? 'var(--gold-dim)' : 'var(--surface2)',
              transition: 'all 0.2s', marginBottom: 16
            }}
          >
            {preview ? (
              <img src={preview} alt="Preview" style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{archivo ? '📄' : '📎'}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: archivo ? 'var(--gold-light)' : 'var(--text)' }}>
                  {archivo ? archivo.name : 'Hacé clic o arrastrá tu factura aquí'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Formatos: JPG, PNG, PDF</div>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])} />
          </div>

          {archivo && !preview && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              📄 {archivo.name} ({(archivo.size / 1024).toFixed(0)} KB)
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, padding: 14, background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6, fontSize: 13 }}>Error al procesar la factura</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{error}</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={diagnostico} disabled={diagnosLoading} style={{ marginTop: 12, fontSize: 12 }}>
                {diagnosLoading ? '⏳ Verificando...' : '🔧 Diagnosticar problema'}
              </button>
            </div>
          )}

          {diagnosData && (
            <div style={{ marginTop: 12, padding: 14, background: 'var(--surface2)', borderRadius: 10, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {diagnosData.estado === 'ok' ? '✅ Configuración OK' : '❌ Problema detectado'}
              </div>
              {diagnosData.problema && <div style={{ color: 'var(--red)', marginBottom: 6 }}>{diagnosData.problema}</div>}
              {diagnosData.solucion && <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>💡 {diagnosData.solucion}</div>}
              {diagnosData.api_key_preview && (
                <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                  🔑 API Key: <code style={{ color: 'var(--gold-light)' }}>{diagnosData.api_key_preview}</code>
                </div>
              )}
              {diagnosData.modelos?.map(m => (
                <div key={m.modelo} style={{ padding: '3px 0', color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text)' }}>{m.modelo}:</strong> {m.estado}
                </div>
              ))}
              {diagnosData.conclusion && (
                <div style={{ marginTop: 8, fontWeight: 600, color: diagnosData.estado === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                  {diagnosData.conclusion}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {resultado.proveedor_detectado && <span>Proveedor: <strong style={{ color: 'var(--text)' }}>{resultado.proveedor_detectado}</strong></span>}
              {resultado.total_detectado && <span style={{ marginLeft: 16 }}>Total: <strong style={{ color: 'var(--gold-light)' }}>{formatARS(resultado.total_detectado)}</strong></span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 60, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(resultado.confianza || 0) * 100}%`, height: '100%', background: 'var(--green)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{((resultado.confianza || 0) * 100).toFixed(0)}% confianza</span>
            </div>
          </div>

          <div style={{ background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PRODUCTO</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CANT.</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>P. UNIT.</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {resultado.items_detectados?.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>{item.descripcion}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>{item.cantidad}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatARS(item.costo_unitario)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--gold-light)' }}>
                      {formatARS(item.costo_unitario * item.cantidad)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
            onClick={() => { setResultado(null); setArchivo(null); setPreview(null) }}>
            ← Cargar otra factura
          </button>
        </div>
      )}
    </Modal>
  )
}

// ─── Modal: Registrar compra ──────────────────────────────────────────────────

function ModalCompra({ onClose, onSaved, datosIA }) {
  const toast = useToast()
  const [sucursales, setSucursales] = useState([])
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState({
    proveedor: datosIA?.proveedor_detectado || '',
    sucursal_id: '',
    metodo_pago: 'efectivo',
    notas: ''
  })
  const [items, setItems] = useState(
    datosIA?.items_detectados?.length
      ? datosIA.items_detectados.map(it => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          costo_unitario: Number(it.costo_unitario) || 0,
          variante_id: ''
        }))
      : [{ descripcion: '', cantidad: 1, costo_unitario: 0, variante_id: '' }]
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([sucursalesApi.listar(), productosApi.listar()])
      .then(([s, p]) => { setSucursales(s); setProductos(p) })
  }, [])

  const variantes = productos.flatMap(p =>
    (p.variantes || []).map(v => ({
      id: v.id,
      label: [p.nombre, p.marca, v.sabor, v.tamanio].filter(Boolean).join(' · ')
    }))
  )

  const addItem = () => setItems(v => [...v, { descripcion: '', cantidad: 1, costo_unitario: 0, variante_id: '' }])
  const rmItem = (i) => setItems(v => v.filter((_, idx) => idx !== i))
  const upItem = (i, f, val) => setItems(arr => arr.map((item, idx) => idx === i ? { ...item, [f]: val } : item))
  const total = items.reduce((a, i) => a + (Number(i.costo_unitario) || 0) * (Number(i.cantidad) || 0), 0)

  const submit = async () => {
    if (!form.sucursal_id) return toast('Seleccioná una sucursal', 'error')
    if (!items.length) return toast('Agregá al menos un ítem', 'error')
    const sinVariante = items.filter(i => !i.variante_id)
    if (sinVariante.length) return toast(`Asigná una variante a: ${sinVariante.map(i => i.descripcion || 'ítem').join(', ')}`, 'error')
    setLoading(true)
    try {
      await comprasApi.crear({
        ...form,
        sucursal_id: Number(form.sucursal_id),
        items: items.map(i => ({
          variante_id: Number(i.variante_id),
          cantidad: Number(i.cantidad),
          costo_unitario: Number(i.costo_unitario)
        }))
      })
      toast('Compra registrada y stock actualizado ✓')
      onSaved(); onClose()
    } catch (e) { toast(e.message || 'Error al registrar', 'error') } finally { setLoading(false) }
  }

  return (
    <Modal title={datosIA ? '🤖 Confirmar compra desde factura IA' : 'Registrar compra'} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading ? 'Registrando...' : `Confirmar compra — ${formatARS(total)}`}
        </button>
      </>}
    >
      {datosIA && (
        <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          🤖 Datos pre-cargados desde la factura. <strong>Asigná la variante</strong> correspondiente a cada ítem y confirmá.
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 0 }}>
        <div className="form-group">
          <label className="input-label">Proveedor</label>
          <input className="input" value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} placeholder="Nombre del proveedor..." />
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
            <button key={m} className={`btn btn-sm ${form.metodo_pago === m ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setForm(f => ({ ...f, metodo_pago: m }))}>{METODO_PAGO_LABEL[m]}</button>
          ))}
        </div>
      </div>

      <hr className="divider" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <label className="input-label" style={{ margin: 0 }}>Ítems de la compra</label>
        <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Agregar ítem</button>
      </div>

      {items.map((item, i) => (
        <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div className="grid-2" style={{ marginBottom: 8 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="input-label">Descripción</label>
              <input className="input" value={item.descripcion} onChange={e => upItem(i, 'descripcion', e.target.value)} placeholder="Nombre en la factura" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="input-label">
                Variante del sistema {!item.variante_id && <span style={{ color: 'var(--red)' }}>*</span>}
              </label>
              <select className="input" value={item.variante_id} onChange={e => upItem(i, 'variante_id', e.target.value)}
                style={{ borderColor: !item.variante_id ? 'rgba(220,60,60,0.5)' : '' }}>
                <option value="">— Seleccionar —</option>
                {variantes.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="input-label">Cantidad</label>
              <input className="input" type="number" min="1" value={item.cantidad} onChange={e => upItem(i, 'cantidad', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="input-label">Costo unitario $</label>
              <input className="input" type="number" min="0" value={item.costo_unitario} onChange={e => upItem(i, 'costo_unitario', e.target.value)} />
            </div>
            {items.length > 1 && <button className="btn btn-danger btn-sm" onClick={() => rmItem(i)}>✕</button>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Subtotal: <strong style={{ color: 'var(--gold-light)' }}>{formatARS(item.costo_unitario * item.cantidad)}</strong>
          </div>
        </div>
      ))}

      <div style={{ textAlign: 'right', marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--gold-light)' }}>
        Total: {formatARS(total)}
      </div>
    </Modal>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Compras() {
  const toast = useToast()
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalIA, setModalIA] = useState(false)
  const [datosIA, setDatosIA] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const cargar = () => {
    setLoading(true)
    comprasApi.listar().then(r => setCompras(r)).finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [])

  const eliminar = async (id) => {
    await comprasApi.eliminar(id)
    toast('Eliminada, stock revertido')
    cargar()
  }

  const handleFacturaCargada = (resultado) => {
    setDatosIA(resultado)
    setModal(true)
  }

  return (<>
    <div className="topbar">
      <div className="page-title">Compras</div>
      <div className="topbar-actions">
        <button className="btn btn-ghost" onClick={() => setModalIA(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🤖</span> Cargar con IA
        </button>
        <button className="btn btn-primary" onClick={() => { setDatosIA(null); setModal(true) }}>+ Registrar compra</button>
      </div>
    </div>

    <div className="page-content">
      <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px' }}>
          <div style={{ fontSize: 32 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Carga inteligente de facturas</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Subí una foto o PDF de tu factura — la IA detecta los productos y los carga automáticamente.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setModalIA(true)}>Subir factura</button>
        </div>
      </div>

      {loading ? <Loading /> : compras.length === 0 ? <EmptyState icon="🛒" text="Sin compras registradas." /> : (
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Proveedor</th><th>Sucursal</th><th>Pago</th><th>Total</th><th></th></tr></thead>
          <tbody>{compras.map(c => (
            <tr key={c.id}>
              <td style={{ color: 'var(--text-muted)' }}>{formatDate(c.fecha)}</td>
              <td><strong>{c.proveedor || '—'}</strong></td>
              <td style={{ color: 'var(--text-muted)' }}>#{c.sucursal_id}</td>
              <td><Chip color={METODO_PAGO_COLOR[c.metodo_pago]}>{METODO_PAGO_LABEL[c.metodo_pago]}</Chip></td>
              <td><strong>{formatARS(c.total)}</strong></td>
              <td><button className="btn btn-danger btn-xs"
                onClick={() => setConfirm({ msg: '¿Eliminar compra? Se revertirá el stock.', fn: () => eliminar(c.id) })}>✕</button></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
    </div>

    {modalIA && <ModalIAFactura onClose={() => setModalIA(false)} onFacturaCargada={handleFacturaCargada} />}
    {modal && <ModalCompra onClose={() => { setModal(false); setDatosIA(null) }} onSaved={cargar} datosIA={datosIA} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
  </>)
}
