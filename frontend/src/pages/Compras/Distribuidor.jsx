/**
 * Reparto de un producto entre sucursales.
 *
 * Antes eran campos numéricos de 50px en una fila que se envolvía sola en el
 * celular: no se acertaban con el pulgar y no decían cuánto faltaba repartir
 * hasta que uno se pasaba. Ahora cada sucursal es una fila con stepper y el
 * resto se muestra arriba, junto al botón que lo reparte solo.
 *
 * La sucursal de la compra no tiene fila propia: es donde cae lo que no se
 * reparte, que es exactamente lo que hace el backend. Mostrarla como una fila
 * más obligaba a que dos números sumaran bien a mano.
 */
export default function Distribuidor({ nombre, detalle, cantidad, sucursales, sucursalBaseId, distribucion, onChange }) {
  const otras = sucursales.filter(s => String(s.id) !== String(sucursalBaseId))
  const base = sucursales.find(s => String(s.id) === String(sucursalBaseId))

  const cantidadDe = (sucursalId) => distribucion.find(d => d.sucursal_id === sucursalId)?.cantidad || 0
  const repartido = otras.reduce((s, suc) => s + cantidadDe(suc.id), 0)
  const resto = cantidad - repartido
  const excedido = resto < 0

  const setCantidad = (sucursalId, valor) => {
    const limpio = Math.max(0, Math.min(cantidad, Number(valor) || 0))
    const sin = distribucion.filter(d => d.sucursal_id !== sucursalId)
    onChange(limpio > 0 ? [...sin, { sucursal_id: sucursalId, cantidad: limpio }] : sin)
  }

  // Reparte en partes iguales entre todas las sucursales, incluida la de la
  // compra: es el caso más común cuando llega un pedido grande. Las unidades
  // que no dividen justo quedan en la sucursal de la compra, que ya es la que
  // recibe el resto: así no hay que decidir a quién darle la de más.
  const repartirParejo = () => {
    const porSucursal = Math.floor(cantidad / sucursales.length)
    onChange(otras.map(s => ({ sucursal_id: s.id, cantidad: porSucursal })).filter(d => d.cantidad > 0))
  }

  return (
    <div className="cmp-dist">
      <div className="cmp-dist-head">
        <div className="cmp-dist-name">{nombre}</div>
        <div className="cmp-dist-qty">{cantidad} u.</div>
      </div>
      {detalle && <div className="cmp-cart-sub">{detalle}</div>}

      <div className={`cmp-dist-rest${excedido ? ' is-over' : ''}`}>
        <span>
          {excedido
            ? <>Te pasaste por <b>{Math.abs(resto)}</b> u.</>
            : <>Quedan <b>{resto}</b> en {base?.nombre || 'la sucursal de la compra'}</>}
        </span>
        {sucursales.length > 1 && (
          <button className="cmp-dist-auto" onClick={repartirParejo}>Repartir parejo</button>
        )}
      </div>

      {otras.map(s => (
        <div className="cmp-dist-row" key={s.id}>
          <span className="cmp-dist-suc">{s.nombre}</span>
          <div className="cmp-step">
            <button
              className="cmp-step-btn"
              onClick={() => setCantidad(s.id, cantidadDe(s.id) - 1)}
              disabled={cantidadDe(s.id) <= 0}
              aria-label={`Quitar uno de ${s.nombre}`}
            >−</button>
            <input
              className="cmp-step-input"
              type="number"
              inputMode="numeric"
              min="0"
              max={cantidad}
              value={cantidadDe(s.id)}
              aria-label={`Unidades para ${s.nombre}`}
              onChange={e => setCantidad(s.id, e.target.value)}
            />
            <button
              className="cmp-step-btn"
              onClick={() => setCantidad(s.id, cantidadDe(s.id) + 1)}
              disabled={resto <= 0}
              aria-label={`Agregar uno a ${s.nombre}`}
            >+</button>
          </div>
        </div>
      ))}
    </div>
  )
}
