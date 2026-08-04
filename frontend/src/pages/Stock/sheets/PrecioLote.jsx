import { useState } from 'react'
import { Modal, formatARS } from '../../../components/ui'
import { toast } from '../../../components/Toast'
import { productosApi } from '../../../api'
import { variantesActivas, etiquetaVariante } from '../stockUtils'

const MODOS = [
  { key: 'porcentaje', label: 'Subir o bajar %', ayuda: 'Aplica el porcentaje sobre el precio actual. Poné un número negativo para bajar.', placeholder: '15' },
  { key: 'margen_deseado', label: 'Fijar margen %', ayuda: 'Calcula el precio para que quede ese margen sobre el costo.', placeholder: '30' },
  { key: 'precio_fijo', label: 'Precio fijo', ayuda: 'Deja todas las variantes al mismo precio.', placeholder: '28000' },
]

// Réplica del cálculo del backend, sólo para previsualizar. Si no se puede
// calcular (falta el costo con margen deseado), se devuelve null y esa fila
// no se muestra en la vista previa.
function precioNuevo(variante, modo, valor) {
  const v = parseFloat(valor)
  if (isNaN(v)) return null
  const precio = Number(variante.precio_venta || 0)
  const costo = Number(variante.costo || 0)

  if (modo === 'precio_fijo') return v
  if (modo === 'porcentaje') return Math.round(precio * (1 + v / 100))
  if (modo === 'margen_deseado') {
    if (costo <= 0 || v >= 100) return null
    return Math.round(costo / (1 - v / 100))
  }
  return null
}

/**
 * Ajuste de precios de todas las variantes de un producto.
 *
 * Se agrega la vista previa: antes se aplicaba a ciegas sobre todas las
 * variantes y recién después se veía el resultado, lo que hace difícil animarse
 * a usarlo.
 */
export default function PrecioLote({ producto, onClose, onSaved }) {
  const [modo, setModo] = useState('porcentaje')
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)

  const variantes = variantesActivas(producto)
  const modoActual = MODOS.find(m => m.key === modo)

  const previa = variantes
    .map(v => ({ v, nuevo: precioNuevo(v, modo, valor) }))
    .filter(x => x.nuevo !== null && x.nuevo !== Number(x.v.precio_venta))

  const aplicar = async () => {
    const v = parseFloat(valor)
    if (isNaN(v)) return toast.error('Ingresá un valor')
    setGuardando(true)
    try {
      await productosApi.ajustarPrecioLote({ producto_id: producto.id, modo, valor: v })
      toast.success('Precios actualizados')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudieron actualizar los precios')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      title="Ajustar precios"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={aplicar} disabled={guardando || !valor}>
            {guardando ? 'Aplicando…' : `Aplicar a ${variantes.length} variante${variantes.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="stk-sheet-ctx">
        <div className="stk-sheet-ctx-title">{producto.nombre}</div>
        <div className="stk-sheet-ctx-sub">
          {variantes.length} variante{variantes.length === 1 ? '' : 's'} activa{variantes.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="stk-field">
        <span className="stk-label">Cómo calcular</span>
        <div className="stk-suc-picker">
          {MODOS.map(m => (
            <button
              key={m.key}
              className={`stk-suc-opt${modo === m.key ? ' is-active' : ''}`}
              onClick={() => setModo(m.key)}
            >
              <div className="stk-suc-opt-name">{m.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="stk-field">
        <label className="stk-label" htmlFor="stk-lote-valor">
          {modo === 'precio_fijo' ? 'Precio' : 'Porcentaje'}
        </label>
        <input
          id="stk-lote-valor"
          className="stk-input"
          type="number"
          inputMode="decimal"
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder={modoActual.placeholder}
          autoFocus
        />
        <p className="stk-help">{modoActual.ayuda}</p>
      </div>

      {previa.length > 0 && (
        <div className="stk-preview">
          {previa.map(({ v, nuevo }) => (
            <div key={v.id} className="stk-preview-row">
              <span className="stk-preview-strong">{etiquetaVariante(v)}</span>
              <span>
                <span className="stk-preview-old">{formatARS(v.precio_venta)}</span>
                <span className="stk-preview-arrow"> → </span>
                <span className="stk-preview-gold">{formatARS(nuevo)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {valor && previa.length === 0 && (
        <p className="stk-help">
          {modo === 'margen_deseado'
            ? 'Ninguna variante tiene cargado el costo, que hace falta para calcular el margen.'
            : 'Con ese valor no cambia ningún precio.'}
        </p>
      )}
    </Modal>
  )
}
