import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { comprasApi, productosApi, sucursalesApi } from '../../api/services'
import { Modal, Loading, EmptyState, Chip, ConfirmDialog, formatARS, formatDate, METODO_PAGO_COLOR, METODO_PAGO_LABEL } from '../../components/ui'

// ─── Modal: Cargar factura con IA ─────────────────────────────────────────────

function ModalIAFactura({ onClose, onFacturaCargada }) {
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analizando, setAnalizando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setArchivo(file)
    setResultado(null)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  const analizar = async () => {
    if (!archivo) return toast.error('Seleccioná un archivo primero')
    setAnalizando(true)
    try {
      const r = await comprasApi.analizarFactura(archivo)
      setResultado(r.data)
      toast.success(`✓ ${r.data.items_detectados?.length || 0} productos detectados`)
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Error al analizar'
      toast.error(msg)
    } finally { setAnalizando(false) }
  }

  return (
    <Modal title="🤖 Cargar factura con IA" onClose={onClose} size="modal-lg"
      footer={
        resultado
          ? <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => { onFacturaCargada(resultado); onClose() }}>
                Usar estos datos
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

          {/* Drop zone */}
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Formatos: JPG, PNG, PDF
                </div>
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
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {((resultado.confianza || 0) * 100).toFixed(0)}% confianza
              </span>
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

          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => { setResultado(null); setArchivo(null); setPreview(null) }}>
            ← Cargar otra factura
          </button>
        </div>
      )}
    </Modal>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Compras() {
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [modalIA, setModalIA] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const cargar = () => { setLoading(true); comprasApi.listar().then(r => setCompras(r.data)).finally(() => setLoading(false)) }
  useEffect(() => { cargar() }, [])

  const eliminar = async (id) => { await comprasApi.eliminar(id); toast.success('Eliminada, stock revertido'); cargar() }

  const handleFacturaCargada = (resultado) => {
    toast.success('Datos cargados. Revisá y confirmá la compra.')
    // Aquí se podría pre-llenar el modal de nueva compra con los datos
  }

  return (<>
    <div className="topbar">
      <div className="page-title">Compras</div>
      <div className="topbar-actions">
        <button className="btn btn-ghost" onClick={() => setModalIA(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🤖</span> Cargar con IA
        </button>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar compra</button>
      </div>
    </div>

    <div className="page-content">
      {/* Banner IA */}
      <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px' }}>
          <div style={{ fontSize: 32 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Carga inteligente de facturas</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Subí una foto o PDF de tu factura y la IA detecta automáticamente los productos, cantidades y precios.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setModalIA(true)}>Subir factura</button>
        </div>
      </div>

      {loading ? <Loading /> : compras.length === 0 ? <EmptyState icon="↓" text="Sin compras registradas." /> : (
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Proveedor</th><th>Sucursal</th><th>Pago</th><th>Total</th><th></th></tr></thead>
          <tbody>{compras.map(c => (
            <tr key={c.id}>
              <td style={{ color: 'var(--text-muted)' }}>{formatDate(c.fecha)}</td>
              <td><strong>{c.proveedor || '—'}</strong></td>
              <td style={{ color: 'var(--text-muted)' }}>#{c.sucursal_id}</td>
              <td><Chip color={METODO_PAGO_COLOR[c.metodo_pago]}>{METODO_PAGO_LABEL[c.metodo_pago]}</Chip></td>
              <td><strong>{formatARS(c.total)}</strong></td>
              <td><button className="btn btn-danger btn-xs" onClick={() => setConfirm({ msg: `¿Eliminar compra? Se revertirá el stock.`, fn: () => eliminar(c.id) })}>✕</button></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
    </div>

    {modalIA && <ModalIAFactura onClose={() => setModalIA(false)} onFacturaCargada={handleFacturaCargada} />}
    {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { confirm.fn(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
  </>)
}
