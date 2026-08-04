import { useState } from 'react'
import { Modal } from '../../../components/ui'
import { toast } from '../../../components/Toast'
import { stockApi } from '../../../api'
import { cantidadEn, etiquetaVariante, fmtN } from '../stockUtils'

/**
 * Ajuste de stock de una variante en una sucursal.
 *
 * Reemplaza la edición inline anterior, que se activaba tocando el número del
 * chip sin que nada lo indicara: en el celular la acción más frecuente de la
 * pantalla era literalmente invisible. Acá el contexto está escrito (qué
 * producto, qué variante, qué sucursal), el stepper es grande y hay un botón
 * de guardar explícito.
 */
export default function AjusteStock({ producto, variante, sucursal, onClose, onSaved }) {
  const actual = cantidadEn(variante, sucursal.id)
  const [valor, setValor] = useState(String(actual))
  const [guardando, setGuardando] = useState(false)

  const n = parseInt(valor, 10)
  const valido = !isNaN(n)
  const diferencia = valido ? n - actual : 0

  const cambiar = (delta) => setValor(v => {
    const base = parseInt(v, 10)
    return String(Math.max(0, (isNaN(base) ? actual : base) + delta))
  })

  const guardar = async () => {
    if (!valido) return toast.error('Ingresá una cantidad válida')
    if (diferencia === 0) return onClose()
    setGuardando(true)
    try {
      await stockApi.ajustarManual(variante.id, { cantidad: n, sucursal_id: sucursal.id })
      toast.success(`${sucursal.nombre}: ${fmtN(n)} unidades`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar el ajuste')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      title="Ajustar stock"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando || !valido}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="stk-sheet-ctx">
        <div className="stk-sheet-ctx-title">{producto.nombre}</div>
        <div className="stk-sheet-ctx-sub">
          {etiquetaVariante(variante)} · {sucursal.nombre}
        </div>
      </div>

      <div className="stk-field">
        <span className="stk-label">Cantidad en {sucursal.nombre}</span>
        <div className="stk-stepper">
          <button
            className="stk-step-btn"
            onClick={() => cambiar(-1)}
            disabled={valido && n <= 0}
            aria-label="Restar uno"
          >−</button>
          <input
            className="stk-step-input"
            type="number"
            inputMode="numeric"
            min="0"
            value={valor}
            onChange={e => setValor(e.target.value)}
            onFocus={e => e.target.select()}
            aria-label="Cantidad"
          />
          <button className="stk-step-btn" onClick={() => cambiar(1)} aria-label="Sumar uno">+</button>
        </div>
        <p className="stk-help">
          {!valido
            ? 'Ingresá un número.'
            : diferencia === 0
              ? `Sin cambios. Hoy hay ${fmtN(actual)} unidades.`
              : `De ${fmtN(actual)} a ${fmtN(n)} unidades (${diferencia > 0 ? '+' : ''}${fmtN(diferencia)}).`}
        </p>
      </div>
    </Modal>
  )
}
