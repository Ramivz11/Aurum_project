import { useState } from 'react'
import { formatARS } from '../../components/ui'
import {
  PAGO_CORTO, horaCorta, nombreItem, detalleItem, repartoItem, estaRepartida, unidadesCompra,
} from './comprasUtils'

/**
 * Una compra en dos renglones de ~54px. Reemplaza la tabla de escritorio y las
 * DataCard de móvil, que mostraban lo mismo con la mitad de densidad y no
 * dejaban ver qué se compró sin abrir el editor.
 *
 * El detalle desplegado agrega lo que antes no estaba en ningún lado: a qué
 * sucursal fue a parar cada producto.
 */
export default function CompraRow({ compra, sucursalNombre, nombreDeSucursal, onEditar, onEliminar }) {
  const [abierto, setAbierto] = useState(false)

  const items = compra.items || []
  const repartida = estaRepartida(compra)

  return (
    <article className={`cmp-row${abierto ? ' is-open' : ''}`}>
      <button
        className="cmp-row-main"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        aria-label={`Compra a ${compra.proveedor || 'proveedor sin nombre'} por ${formatARS(compra.total)}`}
      >
        <span className="cmp-row-l">
          <span className={`cmp-row-name${compra.proveedor ? '' : ' is-anon'}`}>
            {compra.proveedor || 'Sin proveedor'}
          </span>
          <span className="cmp-row-meta">
            {horaCorta(compra.fecha)}
            <span className="cmp-row-sep">·</span>
            {sucursalNombre}
            <span className="cmp-row-sep">·</span>
            {unidadesCompra(compra)} u.
            {/* "Reparto" y no "Repartida": la palabra entera hacía saltar el
                renglón a 390px y la fila crecía sólo en algunas compras. */}
            {repartida && <span className="cmp-row-tag" title="Repartida entre sucursales">Reparto</span>}
          </span>
        </span>
        <span className="cmp-row-r">
          <span className="cmp-row-total">{formatARS(compra.total)}</span>
          <span className="cmp-row-pago">{PAGO_CORTO[compra.metodo_pago] || compra.metodo_pago}</span>
        </span>
        <span className="cmp-row-chev" aria-hidden="true">⌄</span>
      </button>

      {abierto && (
        <div className="cmp-items">
          {items.length === 0 && <div className="cmp-note">Esta compra no tiene productos cargados.</div>}
          {items.map((item, i) => {
            const reparto = repartoItem(item, compra.sucursal_id)
            const destinos = Object.entries(reparto).filter(([, cant]) => cant > 0)
            const detalle = detalleItem(item)
            return (
              <div className="cmp-item" key={item.id ?? i}>
                <span className="cmp-item-qty">{item.cantidad}</span>
                <span className="cmp-item-main">
                  <span className="cmp-item-name">{nombreItem(item)}</span>
                  {detalle && <span className="cmp-item-sub">{detalle}</span>}
                  {/* Con una sola sucursal el chip no agrega nada: ya está en la
                      fila de arriba. Se muestra sólo cuando hubo reparto. */}
                  {destinos.length > 1 && (
                    <span className="cmp-item-dest">
                      {destinos.map(([sucId, cant]) => (
                        <span className="cmp-dest-chip" key={sucId}>
                          {nombreDeSucursal(Number(sucId))} <b>{cant}</b>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="cmp-item-money">
                  <span className="cmp-item-total">{formatARS(item.subtotal)}</span>
                  <span className="cmp-item-unit">{formatARS(item.costo_unitario)} c/u</span>
                </span>
              </div>
            )
          })}

          {compra.notas && <div className="cmp-note">📝 {compra.notas}</div>}

          <div className="cmp-item-actions">
            <button className="cmp-act is-primary" onClick={onEditar}>Editar compra</button>
            <button className="cmp-act is-danger" onClick={onEliminar}>Eliminar</button>
          </div>
        </div>
      )}
    </article>
  )
}
