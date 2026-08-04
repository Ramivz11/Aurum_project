import { cantidadEn, estadoStock, MARCA_ESTADO, ETIQUETA_ESTADO, fmtN } from './stockUtils'

/**
 * La grilla de sucursales: una celda por sucursal, siempre en el mismo orden y
 * la misma posición en todas las filas de la lista. Eso permite leer la pantalla
 * en columna — la segunda celda es siempre la misma sucursal, en todos los
 * productos — que es lo que hace posible responder "¿hay y dónde?" de un vistazo.
 *
 * Cada celda es un botón: tocarla abre la hoja de ajuste. El lápiz deja a la
 * vista que se puede editar, en lugar de esconderlo detrás de un número mudo.
 */
export default function SucursalGrid({ variante, sucursales, sucursalActualId, onAjustar }) {
  return (
    <div className="stk-grid">
      {sucursales.map(suc => {
        const qty = cantidadEn(variante, suc.id)
        const estado = estadoStock(qty, variante.stock_minimo ?? 0)

        return (
          <button
            key={suc.id}
            type="button"
            className={[
              'stk-cell',
              `is-${estado}`,
              suc.id === sucursalActualId ? 'is-current' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onAjustar(variante, suc)}
            aria-label={`${suc.nombre}: ${fmtN(qty)} unidades, ${ETIQUETA_ESTADO[estado]}. Tocar para ajustar.`}
          >
            <span className="stk-cell-edit" aria-hidden="true">✎</span>
            <span className="stk-cell-name">{suc.nombre}</span>
            <span className="stk-cell-qty">{fmtN(qty)}</span>
            <span className="stk-cell-mark" aria-hidden="true">{MARCA_ESTADO[estado]}</span>
          </button>
        )
      })}
    </div>
  )
}
