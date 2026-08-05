import { useState } from 'react'
import { formatARS } from '../../components/ui'

/**
 * Barra de una línea con lo que se gastó, expandible.
 *
 * Todo sale de la lista que ya está en memoria: no hay endpoint de resumen de
 * compras y no valía la pena inventar uno para cuatro números. El reparto por
 * sucursal es el único dato que la sección no mostraba en ningún lado y es el
 * que dispara la compra siguiente.
 */
export default function ComprasResumen({ compras, sucursales, totalListado }) {
  const [abierto, setAbierto] = useState(false)

  const ahora = new Date()
  const delMes = compras.filter(c => {
    const d = new Date(c.fecha)
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear()
  })
  const totalMes = delMes.reduce((s, c) => s + Number(c.total || 0), 0)
  const unidades = compras.reduce(
    (s, c) => s + (c.items || []).reduce((t, i) => t + i.cantidad, 0), 0
  )
  const ultima = compras[0]?.fecha ? new Date(compras[0].fecha) : null

  // Unidades que recibió cada sucursal, sumando el reparto de cada compra.
  const porSucursal = {}
  for (const c of compras) {
    for (const item of c.items || []) {
      const dist = item.distribucion || []
      if (dist.length) {
        for (const d of dist) porSucursal[d.sucursal_id] = (porSucursal[d.sucursal_id] || 0) + d.cantidad
      } else {
        porSucursal[c.sucursal_id] = (porSucursal[c.sucursal_id] || 0) + item.cantidad
      }
    }
  }
  const maximo = Math.max(1, ...Object.values(porSucursal))

  return (
    <div>
      <button className="cmp-bar" onClick={() => setAbierto(a => !a)} aria-expanded={abierto}>
        <span className="cmp-bar-main">
          Este mes <span className="cmp-bar-gold">{formatARS(totalMes)}</span>
          {' · '}<span className="cmp-bar-strong">{compras.length}</span> en pantalla
        </span>
        <span className="cmp-bar-chevron" aria-hidden="true">⌄</span>
      </button>

      {abierto && (
        <div className="cmp-detail">
          <div className="cmp-detail-item">
            <div className="cmp-detail-label">Gastado este mes</div>
            <div className="cmp-detail-value is-gold">{formatARS(totalMes)}</div>
            <div className="cmp-detail-sub">{delMes.length} compra{delMes.length === 1 ? '' : 's'}</div>
          </div>

          <div className="cmp-detail-item">
            <div className="cmp-detail-label">Total en pantalla</div>
            <div className="cmp-detail-value">{formatARS(totalListado)}</div>
            <div className="cmp-detail-sub">{unidades} unidades ingresadas</div>
          </div>

          <div className="cmp-detail-item">
            <div className="cmp-detail-label">Última compra</div>
            <div className="cmp-detail-value">
              {ultima ? ultima.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}
            </div>
            <div className="cmp-detail-sub">{compras[0]?.proveedor || 'sin proveedor'}</div>
          </div>

          <div className="cmp-detail-item">
            <div className="cmp-detail-label">Costo promedio</div>
            <div className="cmp-detail-value">{unidades ? formatARS(totalListado / unidades) : '—'}</div>
            <div className="cmp-detail-sub">por unidad ingresada</div>
          </div>

          {sucursales.length > 1 && Object.keys(porSucursal).length > 0 && (
            <div className="cmp-detail-item is-wide">
              <div className="cmp-detail-label">Adónde fue el stock</div>
              <div className="cmp-split">
                {sucursales.map(s => {
                  const cant = porSucursal[s.id] || 0
                  return (
                    <div className="cmp-split-row" key={s.id}>
                      <span className="cmp-split-name">{s.nombre}</span>
                      <span className="cmp-split-track">
                        <span className="cmp-split-fill" style={{ width: `${(cant / maximo) * 100}%` }} />
                      </span>
                      <span className="cmp-split-qty">{cant}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
