import { useState } from 'react'
import { formatARS } from '../../components/ui'
import { ESTADO_META, PAGO_CORTO, horaCorta } from './ventasUtils'

/**
 * Una venta en dos renglones de ~54px: quién y cuánto arriba, el contexto
 * abajo. Antes cada venta era una tarjeta de ~130px con sombra y 8px de aire;
 * en un celular entraban tres ventas por pantalla.
 *
 * El estado se codifica en el borde de color y además en palabra, para que no
 * dependa de distinguir ámbar de verde.
 */
export default function VentaRow({ venta, clienteNombre, sucursalNombre, onConfirmar, onEliminar, onEditar }) {
  const [abierto, setAbierto] = useState(false)

  const items = venta.items || []
  const meta = ESTADO_META[venta.estado] || ESTADO_META.abierta
  const esPedido = venta.estado === 'abierta'
  const cancelada = venta.estado === 'cancelada'

  return (
    <article className={`vta-row ${meta.clase}${abierto ? ' is-open' : ''}`}>
      <button
        className="vta-row-main"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        aria-label={`Venta de ${clienteNombre || 'sin cliente'} por ${formatARS(venta.total)}`}
      >
        <span className="vta-row-l">
          <span className={`vta-row-name${clienteNombre ? '' : ' is-anon'}`}>
            {clienteNombre || 'Sin cliente'}
          </span>
          <span className="vta-row-meta">
            {horaCorta(venta.fecha)}
            <span className="vta-row-sep">·</span>
            {sucursalNombre}
            <span className="vta-row-sep">·</span>
            {items.length} ít.
            {venta.estado !== 'confirmada' && (
              <span className={`vta-row-tag ${meta.clase}`}>{meta.etiqueta}</span>
            )}
          </span>
        </span>
        <span className="vta-row-r">
          <span className={`vta-row-total${cancelada ? ' is-cancelada' : ''}`}>{formatARS(venta.total)}</span>
          <span className="vta-row-pago">{PAGO_CORTO[venta.metodo_pago] || venta.metodo_pago}</span>
        </span>
        <span className="vta-row-chev" aria-hidden="true">⌄</span>
      </button>

      {abierto && (
        <div className="vta-items">
          {items.length === 0 && <div className="vta-note">Esta venta no tiene productos cargados.</div>}
          {items.map((item, i) => {
            const nombre = item.producto_nombre || item.variante?.producto?.nombre || `Variante #${item.variante_id}`
            const marca = item.producto_marca || item.variante?.producto?.marca
            const sabor = item.variante_sabor || item.variante?.sabor
            const tamanio = item.variante_tamanio || item.variante?.tamanio
            const detalle = [marca, sabor, tamanio].filter(Boolean).join(' · ')
            return (
              <div className="vta-item" key={item.id ?? i}>
                <span className="vta-item-qty">{item.cantidad}×</span>
                <span className="vta-item-main">
                  <span className="vta-item-name">{nombre}</span>
                  {detalle && <span className="vta-item-sub">{detalle}</span>}
                </span>
                <span className="vta-item-money">
                  <span className="vta-item-total">{formatARS(item.subtotal)}</span>
                  <span className="vta-item-unit">{formatARS(item.precio_unitario)} c/u</span>
                </span>
              </div>
            )
          })}

          {venta.notas && <div className="vta-note">📝 {venta.notas}</div>}

          {/* Editar es la acción principal de la sección: en el detalle va con
              nombre y objetivo grande, no escondida detrás del ⋮. */}
          <div className="vta-item-actions">
            <button className="vta-act is-primary" onClick={onEditar}>Editar venta</button>
            {esPedido && <button className="vta-act is-ok" onClick={onConfirmar}>Confirmar</button>}
            <button className="vta-act is-danger" onClick={onEliminar}>Eliminar</button>
          </div>
        </div>
      )}
    </article>
  )
}
