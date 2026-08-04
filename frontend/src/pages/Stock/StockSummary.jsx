import { useState } from 'react'
import { formatARS } from '../../components/ui'
import { fmtN, totalProducto, productoBajoMinimo } from './stockUtils'

/**
 * Resumen del inventario en una sola línea, desplegable.
 *
 * Antes eran cinco tarjetas que ocupaban tres filas en el celular y empujaban
 * la lista de productos fuera de la primera pantalla. Los números siguen
 * estando, pero dejan de competir con la tarea principal.
 */
export default function StockSummary({ productos, sucursales, resumenDia, loadingResumen }) {
  const [abierto, setAbierto] = useState(false)

  const unidades = productos.reduce((a, p) => a + totalProducto(p), 0)
  const bajos = productos.filter(p => productoBajoMinimo(p, sucursales)).length

  const ingresos = resumenDia?.ingresos_hoy ?? 0
  const delta = resumenDia?.delta_hoy ?? null
  const margen = resumenDia?.margen_promedio ?? 0

  const detalle = [
    { label: 'Productos', value: fmtN(productos.length) },
    {
      label: 'Unidades',
      value: fmtN(unidades),
      sub: `en ${sucursales.length} sucursal${sucursales.length === 1 ? '' : 'es'}`,
    },
    {
      label: 'Bajo mínimo',
      value: fmtN(bajos),
      estado: bajos > 0 ? 'low' : 'ok',
      sub: bajos > 0 ? 'Conviene reponer' : 'Todo cubierto',
    },
    {
      label: 'Ingresos hoy',
      value: loadingResumen ? '—' : formatARS(ingresos),
      sub: delta !== null ? `${delta >= 0 ? '+' : ''}${delta}% vs. ayer` : undefined,
      estado: delta === null ? undefined : delta >= 0 ? 'ok' : 'out',
    },
    {
      label: 'Margen promedio',
      value: loadingResumen ? '—' : `${margen}%`,
      estado: margen >= 25 ? 'ok' : margen >= 15 ? 'low' : 'out',
    },
  ]

  return (
    <div className="stk-summary">
      <button
        className="stk-summary-bar"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
      >
        <span className="stk-summary-main">
          <span className="stk-summary-strong">{fmtN(productos.length)}</span>
          {productos.length === 1 ? ' producto' : ' productos'}
          {' · '}
          <span className="stk-summary-strong">{fmtN(unidades)}</span>
          {unidades === 1 ? ' unidad' : ' unidades'}
          {bajos > 0 && <> {' · '}<span className="stk-summary-warn">{fmtN(bajos)} bajo mínimo</span></>}
        </span>
        <span className="stk-summary-chevron" aria-hidden="true">⌄</span>
      </button>

      {abierto && (
        <div className="stk-summary-detail">
          {detalle.map(d => (
            <div key={d.label} className="stk-summary-item">
              <div className="stk-summary-label">{d.label}</div>
              <div className={`stk-summary-value${d.estado ? ` is-${d.estado}` : ''}`}>{d.value}</div>
              {d.sub && <div className="stk-summary-sub">{d.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
