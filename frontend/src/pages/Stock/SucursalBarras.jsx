import { cantidadEn, estadoStock, MARCA_ESTADO, ETIQUETA_ESTADO, fmtN } from './stockUtils'

/**
 * El stock por sucursal como barras comparativas, dentro de la card desplegada.
 *
 * La barra se mide contra la sucursal que más tiene de esa variante, así que no
 * dice cuánto hay en absoluto — eso lo dice el número — sino dónde está parado
 * el stock. De un vistazo se ve si está repartido o si vive todo en el depósito,
 * que es la pregunta que dispara una transferencia.
 *
 * Cada fila es un botón: tocarla abre la hoja de ajuste de esa sucursal.
 */
export default function SucursalBarras({ variante, sucursales, sucursalActualId, onAjustar }) {
  const cantidades = sucursales.map(s => cantidadEn(variante, s.id))
  const max = Math.max(...cantidades, 1)

  return (
    <div className="stk-bars">
      {sucursales.map((suc, i) => {
        const qty = cantidades[i]
        const estado = estadoStock(qty, variante.stock_minimo ?? 0)
        // El negativo es un descuadre de inventario: no hay barra que dibujar,
        // el número en rojo es toda la señal.
        const pct = Math.max(0, Math.min(100, Math.round((qty / max) * 100)))

        return (
          <button
            key={suc.id}
            type="button"
            className={[
              'stk-bar',
              `is-${estado}`,
              suc.id === sucursalActualId ? 'is-current' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onAjustar(variante, suc)}
            aria-label={`${suc.nombre}: ${fmtN(qty)} unidades, ${ETIQUETA_ESTADO[estado]}. Tocar para ajustar.`}
          >
            {/* Tres letras y no el nombre entero: en una card de media pantalla
                el nombre completo se comía la barra y la dejaba en un muñón de
                40px, que ya no comparaba nada. El nombre va en el title y en el
                aria-label, que es donde hace falta cuando hay duda. */}
            <span className="stk-bar-name" title={suc.nombre}>{suc.nombre.slice(0, 3)}</span>
            <span className="stk-bar-track">
              <span className="stk-bar-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="stk-bar-qty">
              {fmtN(qty)}
              <span className="stk-bar-mark" aria-hidden="true">{MARCA_ESTADO[estado]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
