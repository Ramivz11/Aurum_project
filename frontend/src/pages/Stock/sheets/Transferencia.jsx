import { useState } from 'react'
import { Modal } from '../../../components/ui'
import { toast } from '../../../components/Toast'
import { stockApi } from '../../../api'
import { cantidadEn, etiquetaVariante, variantesActivas, fmtN } from '../stockUtils'

/**
 * Transferencia de stock entre sucursales.
 *
 * Origen y destino se eligen tocando la sucursal, con su stock disponible a la
 * vista, en vez de un <select> nativo que obligaba a abrir la lista para saber
 * de dónde se podía sacar. Antes la acción sólo aparecía para productos de una
 * sola variante; ahora, si hay varias, se elige cuál.
 */
export default function Transferencia({ producto, sucursales, sucursalActualId, onClose, onSaved }) {
  const variantes = variantesActivas(producto)
  const [varianteId, setVarianteId] = useState(variantes[0]?.id ?? null)
  const variante = variantes.find(v => v.id === varianteId) || variantes[0]

  const [origenId, setOrigenId] = useState(
    sucursalActualId && cantidadEn(variante, sucursalActualId) > 0 ? sucursalActualId : null
  )
  const [destinoId, setDestinoId] = useState(null)
  const [cantidad, setCantidad] = useState('1')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const disponible = origenId ? cantidadEn(variante, origenId) : 0
  const n = parseInt(cantidad, 10)
  const cantidadOk = !isNaN(n) && n >= 1 && n <= disponible
  const listo = origenId && destinoId && cantidadOk && !guardando

  const nombreSuc = id => sucursales.find(s => s.id === id)?.nombre ?? ''

  // Cambiar de variante invalida el origen elegido: el stock disponible es otro.
  const elegirVariante = (id) => {
    setVarianteId(id)
    setOrigenId(null)
    setDestinoId(null)
    setCantidad('1')
  }

  const elegirOrigen = (id) => {
    setOrigenId(id)
    if (destinoId === id) setDestinoId(null)
    setCantidad('1')
  }

  const confirmar = async () => {
    if (!listo) return
    setGuardando(true)
    try {
      await stockApi.transferir({
        variante_id: variante.id,
        sucursal_origen_id: origenId,
        sucursal_destino_id: destinoId,
        cantidad: n,
        notas: notas.trim() || null,
      })
      toast.success(`${fmtN(n)} unidades a ${nombreSuc(destinoId)}`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.message || 'No se pudo transferir')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      title="Transferir entre sucursales"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmar} disabled={!listo}>
            {guardando ? 'Transfiriendo…' : 'Transferir'}
          </button>
        </>
      }
    >
      <div className="stk-sheet-ctx">
        <div className="stk-sheet-ctx-title">{producto.nombre}</div>
        <div className="stk-sheet-ctx-sub">
          {sucursales.map(s => `${s.nombre}: ${fmtN(cantidadEn(variante, s.id))}`).join(' · ')}
        </div>
      </div>

      {variantes.length > 1 && (
        <div className="stk-field">
          <label className="stk-label" htmlFor="stk-transf-var">Variante</label>
          <select
            id="stk-transf-var"
            className="stk-input"
            value={varianteId ?? ''}
            onChange={e => elegirVariante(Number(e.target.value))}
          >
            {variantes.map(v => (
              <option key={v.id} value={v.id}>{etiquetaVariante(v)}</option>
            ))}
          </select>
        </div>
      )}

      <div className="stk-field">
        <span className="stk-label">Sacar de</span>
        <div className="stk-suc-picker">
          {sucursales.map(s => {
            const q = cantidadEn(variante, s.id)
            return (
              <button
                key={s.id}
                className={`stk-suc-opt${origenId === s.id ? ' is-active' : ''}`}
                onClick={() => elegirOrigen(s.id)}
                disabled={q <= 0}
              >
                <div className="stk-suc-opt-name">{s.nombre}</div>
                <div className="stk-suc-opt-qty">{q > 0 ? `${fmtN(q)} disponibles` : 'Sin stock'}</div>
              </button>
            )
          })}
        </div>
      </div>

      {origenId && (
        <div className="stk-field">
          <span className="stk-label">Enviar a</span>
          <div className="stk-suc-picker">
            {sucursales.filter(s => s.id !== origenId).map(s => (
              <button
                key={s.id}
                className={`stk-suc-opt${destinoId === s.id ? ' is-active' : ''}`}
                onClick={() => setDestinoId(s.id)}
              >
                <div className="stk-suc-opt-name">{s.nombre}</div>
                <div className="stk-suc-opt-qty">{fmtN(cantidadEn(variante, s.id))} ahora</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {origenId && (
        <div className="stk-field">
          <span className="stk-label">Cantidad</span>
          <div className="stk-stepper">
            <button
              className="stk-step-btn"
              onClick={() => setCantidad(v => String(Math.max(1, (parseInt(v, 10) || 1) - 1)))}
              disabled={n <= 1}
              aria-label="Restar uno"
            >−</button>
            <input
              className="stk-step-input"
              type="number"
              inputMode="numeric"
              min="1"
              max={disponible}
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              onFocus={e => e.target.select()}
              aria-label="Cantidad a transferir"
            />
            <button
              className="stk-step-btn"
              onClick={() => setCantidad(v => String(Math.min(disponible, (parseInt(v, 10) || 0) + 1)))}
              disabled={n >= disponible}
              aria-label="Sumar uno"
            >+</button>
            <button className="stk-step-max" onClick={() => setCantidad(String(disponible))}>
              Todo
            </button>
          </div>
          {!cantidadOk && (
            <p className="stk-help is-out">
              Elegí entre 1 y {fmtN(disponible)} unidades.
            </p>
          )}
        </div>
      )}

      {listo && (
        <div className="stk-preview">
          <div className="stk-preview-row">
            <span className="stk-preview-strong">{nombreSuc(origenId)}</span>
            <span>
              <span className="stk-preview-old">{fmtN(disponible)}</span>
              <span className="stk-preview-arrow"> → </span>
              <span className="stk-preview-gold">{fmtN(disponible - n)}</span>
            </span>
          </div>
          <div className="stk-preview-row">
            <span className="stk-preview-strong">{nombreSuc(destinoId)}</span>
            <span>
              <span className="stk-preview-old">{fmtN(cantidadEn(variante, destinoId))}</span>
              <span className="stk-preview-arrow"> → </span>
              <span className="stk-preview-gold">{fmtN(cantidadEn(variante, destinoId) + n)}</span>
            </span>
          </div>
        </div>
      )}

      <div className="stk-field" style={{ marginTop: 18 }}>
        <label className="stk-label" htmlFor="stk-transf-notas">Nota (opcional)</label>
        <input
          id="stk-transf-notas"
          className="stk-input"
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Ej: reposición semanal"
        />
      </div>
    </Modal>
  )
}
