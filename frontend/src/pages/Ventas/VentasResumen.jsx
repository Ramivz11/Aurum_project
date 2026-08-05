import { useState } from 'react'
import { formatARS } from '../../components/ui'

/**
 * Reemplaza el panel de "ingresos del día" que vivía al pie de la lista y
 * ocupaba ~130px fijos. Acá es una línea que ya responde lo que se pregunta al
 * entrar (cuánto se vendió hoy, cuántos pedidos quedan sin confirmar) y se
 * abre sólo si se quiere el detalle.
 */
export default function VentasResumen({ cantidad, totalListado, pendientes, resumenDia, cargando }) {
  const [abierto, setAbierto] = useState(false)

  const ingresosHoy = resumenDia?.ingresos_hoy ?? 0
  const delta = resumenDia?.delta_hoy ?? null
  const margen = resumenDia?.margen_promedio ?? 0
  const tendencia = resumenDia?.tendencia_mensual ?? []

  // Sparkline de la tendencia del mes. Con menos de dos puntos no hay línea
  // que dibujar: antes se rellenaba con una serie inventada, que se leía como
  // si fueran ventas reales.
  const W = 220, H = 38
  const puntos = tendencia.length >= 2
    ? (() => {
        const max = Math.max(...tendencia, 1)
        const min = Math.min(...tendencia, 0)
        const rango = max - min || 1
        return tendencia.map((v, i) => {
          const x = (i / (tendencia.length - 1)) * W
          const y = H - ((v - min) / rango) * (H - 4) - 2
          return `${x},${y}`
        }).join(' ')
      })()
    : null

  return (
    <div>
      <button className="vta-bar" onClick={() => setAbierto(a => !a)} aria-expanded={abierto}>
        <span className="vta-bar-main">
          {cargando
            ? 'Cargando resumen…'
            : <>Hoy <span className="vta-bar-gold">{formatARS(ingresosHoy)}</span>
                {' · '}<span className="vta-bar-strong">{cantidad}</span> en pantalla
                {pendientes > 0 && <> · <span className="vta-bar-warn">{pendientes} sin confirmar</span></>}
              </>}
        </span>
        <span className="vta-bar-chevron" aria-hidden="true">⌄</span>
      </button>

      {abierto && (
        <div className="vta-detail">
          <div className="vta-detail-item">
            <div className="vta-detail-label">Ingresos hoy</div>
            <div className="vta-detail-value is-gold">{formatARS(ingresosHoy)}</div>
            {delta !== null && (
              <div className={`vta-detail-sub ${delta >= 0 ? 'is-up' : 'is-down'}`}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs ayer
              </div>
            )}
          </div>

          <div className="vta-detail-item">
            <div className="vta-detail-label">Margen promedio</div>
            <div className="vta-detail-value">{margen}%</div>
            <div className="vta-detail-sub">global · todas las variantes</div>
          </div>

          <div className="vta-detail-item">
            <div className="vta-detail-label">Total en pantalla</div>
            <div className="vta-detail-value">{formatARS(totalListado)}</div>
            <div className="vta-detail-sub">{cantidad} venta{cantidad === 1 ? '' : 's'} con el filtro actual</div>
          </div>

          <div className="vta-detail-item">
            <div className="vta-detail-label">Sin confirmar</div>
            <div className={`vta-detail-value${pendientes > 0 ? ' is-low' : ''}`}>{pendientes}</div>
            <div className="vta-detail-sub">pedidos que aún no descontaron stock</div>
          </div>

          {puntos && (
            <div className="vta-detail-item is-wide">
              <div className="vta-detail-label">Tendencia del mes</div>
              <svg className="vta-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
                aria-label={`Tendencia de ${tendencia.length} días`}>
                <polyline points={puntos} fill="none" stroke="var(--s-gold)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="vta-detail-sub">{tendencia.length} días registrados</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
