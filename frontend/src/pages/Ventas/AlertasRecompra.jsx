import { useState } from 'react'

/**
 * "Clientes para contactar", plegado. Antes era un panel abierto arriba de la
 * lista: con cinco alertas se comía la pantalla entera y había que scrollear
 * para ver la primera venta. Ahora avisa en una línea y se abre si se lo pide.
 *
 * Arranca cerrado incluso habiendo alertas: la pantalla es Ventas, no la
 * agenda de llamados.
 */
export default function AlertasRecompra({ alertas }) {
  const [abierto, setAbierto] = useState(false)
  if (!alertas.length) return null

  const vencidas = alertas.filter(a => a.dias_restantes <= 0).length

  return (
    <div>
      <button className="vta-bar is-alert" onClick={() => setAbierto(a => !a)} aria-expanded={abierto}>
        <span className="vta-bar-main">
          <span className="vta-bar-gold">{alertas.length} cliente{alertas.length === 1 ? '' : 's'} para contactar</span>
          {vencidas > 0 && <> · <span className="vta-bar-warn">{vencidas} ya vencido{vencidas === 1 ? '' : 's'}</span></>}
        </span>
        <span className="vta-bar-chevron" aria-hidden="true">⌄</span>
      </button>

      {abierto && (
        <div className="vta-alert-list">
          {alertas.map((a, i) => {
            const vencida = a.dias_restantes <= 0
            return (
              <div className="vta-alert" key={`${a.cliente_id}-${a.variante_id}-${i}`}>
                <div className="vta-alert-main">
                  <div className="vta-alert-name">{a.cliente_nombre}</div>
                  <div className="vta-alert-sub">
                    {[a.producto_nombre, a.sabor, a.tamanio].filter(Boolean).join(' · ')}
                  </div>
                  {/* El teléfono es un enlace: la alerta existe para llamar, y
                      copiar un número a mano en el celular no es un paso. */}
                  {a.cliente_telefono && (
                    <a className="vta-alert-tel" href={`tel:${a.cliente_telefono}`}>📞 {a.cliente_telefono}</a>
                  )}
                </div>
                <div className={`vta-alert-when${vencida ? ' is-due' : ''}`}>
                  {a.dias_restantes < 0
                    ? `Hace ${Math.abs(a.dias_restantes)}d`
                    : a.dias_restantes === 0 ? '¡Hoy!' : `En ${a.dias_restantes}d`}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
