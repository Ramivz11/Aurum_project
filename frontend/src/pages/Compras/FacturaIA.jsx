import { useState, useRef, useMemo } from 'react'
import { toast } from '../../components/Toast'
import { comprasApi } from '../../api'
import { Modal, formatARS } from '../../components/ui'
import Distribuidor from './Distribuidor'
import { METODOS, PAGO_CORTO, variantesDelCatalogo } from './comprasUtils'

/**
 * Carga de una compra a partir de la foto o el PDF de la factura.
 *
 * Tres pantallas: subir, revisar lo que leyó la IA y repartir. La revisión es
 * la que importa: la IA acierta el texto de la factura pero no puede saber a
 * qué variante del sistema corresponde, así que ese es el único campo que
 * queda obligatorio y el que se marca en rojo mientras falte.
 */
export default function FacturaIA({ sucursales, productos, onClose, onSaved }) {
  const [archivo, setArchivo] = useState(null)
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)
  const fileRef = useRef()

  const analizar = async () => {
    if (!archivo) return toast.error('Elegí un archivo')
    setAnalizando(true)
    setError(null)
    try {
      const res = await comprasApi.analizarFactura((() => {
        const form = new FormData()
        form.append('archivo', archivo)
        return form
      })())
      setResultado(res.data)
    } catch (e) {
      const msg = e.message || 'No se pudo analizar la factura'
      setError(msg)
      toast.error(msg)
    } finally {
      setAnalizando(false)
    }
  }

  if (resultado) {
    return (
      <RevisionFactura
        resultado={resultado}
        productos={productos}
        sucursales={sucursales}
        onClose={onClose}
        onSaved={onSaved}
      />
    )
  }

  return (
    <Modal
      title="Cargar factura con IA"
      onClose={analizando ? () => {} : onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={analizando}>Cancelar</button>
        {!analizando && !error && (
          <button className="btn btn-primary" onClick={analizar} disabled={!archivo}>Analizar factura</button>
        )}
      </>}
    >
      {analizando ? (
        <div className="cmp-ia-state">
          <span className="cmp-ia-state-icon">⚙️</span>
          <div className="cmp-ia-state-title">Leyendo la factura…</div>
          <div className="cmp-ia-state-sub">Puede tardar unos segundos. No cierres la pantalla.</div>
        </div>
      ) : error ? (
        <>
          <div className="cmp-ia-error">
            <div className="cmp-ia-error-title">No se pudo leer la factura</div>
            <div className="cmp-ia-error-msg">{error}</div>
          </div>
          {error.toLowerCase().includes('anthropic') && (
            <div className="cmp-sheet-ctx">
              Falta configurar <code>ANTHROPIC_API_KEY</code> en el entorno del servidor.
              Mientras tanto, la compra se puede cargar a mano.
            </div>
          )}
          <button className="cmp-act" style={{ width: '100%' }} onClick={() => { setError(null); setArchivo(null) }}>
            Probar con otro archivo
          </button>
        </>
      ) : (
        <>
          <div className="cmp-sheet-ctx">
            Sacale una foto al remito y la IA carga los productos, las cantidades
            y los precios. Después revisás y confirmás.
          </div>
          <button className={`cmp-drop${archivo ? ' is-set' : ''}`} onClick={() => fileRef.current?.click()}>
            <span className="cmp-drop-icon" aria-hidden="true">{archivo ? '📄' : '📷'}</span>
            <span className="cmp-drop-text">{archivo ? archivo.name : 'Sacar foto o elegir archivo'}</span>
            <span className="cmp-drop-hint">JPG, PNG o PDF · hasta 10 MB</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => setArchivo(e.target.files[0] || null)}
          />
        </>
      )}
    </Modal>
  )
}

// ─── REVISIÓN ────────────────────────────────────────────────────────────────

/** Busca la variante del catálogo que más se parece a lo que dice la factura. */
function emparejar(descripcion, catalogo) {
  const texto = (descripcion || '').toLowerCase()
  let mejor = null
  let mejorPuntaje = 0
  for (const v of catalogo) {
    const palabras = v.busqueda.split(/[\s·,\-]+/)
    const puntaje = palabras.filter(p => p.length > 2 && texto.includes(p)).length
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = v }
  }
  return mejorPuntaje >= 1 ? mejor : null
}

function RevisionFactura({ resultado, productos, sucursales, onClose, onSaved }) {
  const catalogo = useMemo(() => variantesDelCatalogo(productos), [productos])
  const porId = useMemo(() => Object.fromEntries(catalogo.map(v => [v.id, v])), [catalogo])

  const [proveedor, setProveedor] = useState(resultado.proveedor_detectado || '')
  const [sucursalId, setSucursalId] = useState(String(sucursales[0]?.id || ''))
  const [metodo, setMetodo] = useState('efectivo')
  const [paso, setPaso] = useState(1)
  const [guardando, setGuardando] = useState(false)

  const [items, setItems] = useState(() =>
    (resultado.items_detectados || []).map((item, i) => {
      const match = emparejar(item.descripcion, catalogo)
      return {
        clave: `ia${i}`,
        texto: item.descripcion || 'Sin descripción',
        variante_id: match ? String(match.id) : '',
        automatico: !!match,
        cantidad: item.cantidad,
        costo_unitario: Number(item.costo_unitario),
        distribucion: [],
      }
    })
  )

  const setCampo = (clave, campo, valor) =>
    setItems(prev => prev.map(i => i.clave === clave ? { ...i, [campo]: valor } : i))
  const quitar = (clave) => setItems(prev => prev.filter(i => i.clave !== clave))

  const total = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.costo_unitario), 0)
  const sinVariante = items.filter(i => !i.variante_id).length
  const variasSucursales = sucursales.length > 1

  const guardar = async () => {
    if (!items.length) return toast.error('No quedó ningún producto para cargar')
    if (sinVariante) { setPaso(1); return toast.error(`Faltan ${sinVariante} producto(s) por identificar`) }
    if (items.some(i => !(Number(i.cantidad) > 0) || !(Number(i.costo_unitario) > 0))) {
      return toast.error('Hay cantidades o costos en cero')
    }

    setGuardando(true)
    try {
      await comprasApi.crear({
        proveedor: proveedor.trim() || null,
        sucursal_id: Number(sucursalId),
        metodo_pago: metodo,
        items: items.map(i => ({
          variante_id: Number(i.variante_id),
          cantidad: Number(i.cantidad),
          costo_unitario: Number(i.costo_unitario),
          distribucion: (i.distribucion || []).filter(d => d.cantidad > 0),
        })),
      })
      toast.success('Compra registrada')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const confianza = Math.round((resultado.confianza || 0) * 100)

  return (
    <Modal
      title="Revisar factura"
      onClose={onClose}
      size="modal-lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={guardando}>Cancelar</button>
        {paso === 1 && variasSucursales && items.length > 0 && (
          <button className="btn btn-ghost" onClick={() => setPaso(2)} disabled={!!sinVariante}>
            Repartir por sucursal →
          </button>
        )}
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : `Registrar · ${formatARS(total)}`}
        </button>
      </>}
    >
      <div className={`cmp-sheet-ctx${sinVariante ? ' is-warn' : ''}`}>
        <div className="cmp-sheet-ctx-title">
          {items.length} producto{items.length === 1 ? '' : 's'} detectado{items.length === 1 ? '' : 's'} · confianza {confianza}%
        </div>
        {sinVariante > 0
          ? `Falta decir a qué producto del sistema corresponden ${sinVariante}.`
          : 'Revisá cantidades y costos antes de confirmar.'}
        {resultado.total_detectado != null && ` · Total en la factura: ${formatARS(resultado.total_detectado)}`}
      </div>

      {variasSucursales && (
        <div className="cmp-steps">
          <button className={`cmp-steps-item${paso === 1 ? ' is-active' : ''}`} onClick={() => setPaso(1)}>
            1 · Productos
          </button>
          <button className={`cmp-steps-item${paso === 2 ? ' is-active' : ''}`} onClick={() => setPaso(2)}
            disabled={items.length === 0 || !!sinVariante}>
            2 · Reparto
          </button>
        </div>
      )}

      {paso === 1 ? (
        <>
          {variasSucursales && (
            <div className="cmp-field">
              <label className="cmp-label">Sucursal que recibe *</label>
              <div className="cmp-picker">
                {sucursales.map(s => (
                  <button key={s.id} className={`cmp-opt${String(s.id) === sucursalId ? ' is-active' : ''}`}
                    onClick={() => setSucursalId(String(s.id))}>{s.nombre}</button>
                ))}
              </div>
            </div>
          )}

          <div className="cmp-field">
            <label className="cmp-label">Método de pago</label>
            <div className="cmp-picker">
              {METODOS.map(m => (
                <button key={m} className={`cmp-opt${metodo === m ? ' is-active' : ''}`}
                  onClick={() => setMetodo(m)}>{PAGO_CORTO[m]}</button>
              ))}
            </div>
          </div>

          <div className="cmp-field">
            <label className="cmp-label" htmlFor="cmp-ia-prov">Proveedor</label>
            <input id="cmp-ia-prov" className="cmp-input" value={proveedor}
              onChange={e => setProveedor(e.target.value)} placeholder="Opcional" />
          </div>

          {items.map(item => (
            <div className={`cmp-ia-item${item.variante_id ? '' : ' is-pending'}`} key={item.clave}>
              <div className="cmp-ia-item-head">
                <div className="cmp-ia-item-quote">
                  “{item.texto}”
                  {item.automatico && item.variante_id && (
                    <div className="cmp-ia-item-match">✓ Identificado automáticamente</div>
                  )}
                </div>
                <button className="cmp-cart-del" onClick={() => quitar(item.clave)} aria-label="Quitar producto">✕</button>
              </div>

              <select
                className="cmp-input"
                value={item.variante_id}
                onChange={e => setCampo(item.clave, 'variante_id', e.target.value)}
              >
                <option value="">— Elegí el producto del sistema —</option>
                {catalogo.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.producto}{v.marca ? ` · ${v.marca}` : ''}{v.detalle ? ` — ${v.detalle}` : ''}
                  </option>
                ))}
              </select>

              <div className="cmp-ia-pair">
                <div>
                  <label className="cmp-label" style={{ marginTop: 8 }}>Cantidad</label>
                  <input className="cmp-input" type="number" inputMode="numeric" min="1" value={item.cantidad}
                    onChange={e => setCampo(item.clave, 'cantidad', Number(e.target.value))} />
                </div>
                <div>
                  <label className="cmp-label" style={{ marginTop: 8 }}>Costo c/u</label>
                  <input className="cmp-input" type="number" inputMode="decimal" min="0" value={item.costo_unitario}
                    onChange={e => setCampo(item.clave, 'costo_unitario', Number(e.target.value))} />
                </div>
              </div>

              <div className="cmp-cart-delta" style={{ color: 'var(--s-text-2)' }}>
                Subtotal {formatARS(item.cantidad * item.costo_unitario)}
                {porId[item.variante_id]?.costo > 0 && (() => {
                  const anterior = porId[item.variante_id].costo
                  const delta = Math.round(((item.costo_unitario - anterior) / anterior) * 100)
                  if (!delta) return null
                  return <span className={delta > 0 ? 'is-up' : 'is-down'} style={{ marginLeft: 8, color: delta > 0 ? 'var(--s-out)' : 'var(--s-ok)' }}>
                    {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}% vs. último costo
                  </span>
                })()}
              </div>
            </div>
          ))}

          <div className="cmp-cart-total">
            <span className="cmp-cart-total-label">Total</span>
            <span className="cmp-cart-total-value">{formatARS(total)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="cmp-sheet-ctx">
            Lo que no repartas queda en <strong style={{ color: 'var(--s-text)' }}>
              {sucursales.find(s => String(s.id) === sucursalId)?.nombre}
            </strong>.
          </div>
          {items.map(item => {
            const v = porId[Number(item.variante_id)]
            return (
              <Distribuidor
                key={item.clave}
                nombre={v ? `${v.producto}${v.marca ? ` · ${v.marca}` : ''}` : item.texto}
                detalle={v?.detalle}
                cantidad={Number(item.cantidad)}
                sucursales={sucursales}
                sucursalBaseId={sucursalId}
                distribucion={item.distribucion}
                onChange={dist => setCampo(item.clave, 'distribucion', dist)}
              />
            )
          })}
        </>
      )}
    </Modal>
  )
}
