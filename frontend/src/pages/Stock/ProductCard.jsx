import { useState } from 'react'
import { DropdownMenu, formatARS } from '../../components/ui'
import { useMarca } from '../../context/MarcaContext'
import SucursalGrid from './SucursalGrid'
import {
  variantesActivas, etiquetaVariante, margenPct, estadoMargen, productoAgotado,
} from './stockUtils'

const VARIANTES_VISIBLES = 3

// Resalta el tramo del texto que coincide con la búsqueda, para que el ojo
// salte directo al sabor que preguntó el cliente.
function Resaltado({ texto, termino }) {
  const t = (termino || '').trim()
  if (!t) return texto
  const i = texto.toLowerCase().indexOf(t.toLowerCase())
  if (i === -1) return texto
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + t.length)}</mark>
      {texto.slice(i + t.length)}
    </>
  )
}

function FilaVariante({ variante, sucursales, sucursalActualId, onAjustar, termino }) {
  const margen = margenPct(variante.costo, variante.precio_venta)

  return (
    <div className="stk-var">
      <div className="stk-var-head">
        <span className="stk-var-name">
          <Resaltado texto={etiquetaVariante(variante)} termino={termino} />
        </span>
        <span className="stk-var-price">
          {formatARS(variante.precio_venta)}
          {margen !== null && (
            <span className={`stk-var-margin is-${estadoMargen(margen)}`}>{margen}%</span>
          )}
        </span>
      </div>
      <SucursalGrid
        variante={variante}
        sucursales={sucursales}
        sucursalActualId={sucursalActualId}
        onAjustar={onAjustar}
      />
    </div>
  )
}

/**
 * Card de producto. Las variantes se muestran como filas propias en vez de
 * quedar escondidas tras un desplegable: cuando alguien pregunta por un sabor,
 * la respuesta tiene que estar a la vista, no a un toque de distancia.
 */
export default function ProductCard({
  producto, sucursales, sucursalActualId, termino,
  onAjustar, onEditar, onPrecios, onTransferir, onEliminar,
}) {
  const { getStyles } = useMarca()
  const variantes = variantesActivas(producto)
  const agotado = productoAgotado(producto)

  // El agotado arranca plegado: ocupa menos lugar en el scroll y sus filas de
  // ceros no aportan nada hasta que alguien va a reponer.
  const [expandido, setExpandido] = useState(false)
  const mostrarTodas = expandido || variantes.length <= VARIANTES_VISIBLES
  const visibles = agotado && !expandido
    ? []
    : mostrarTodas ? variantes : variantes.slice(0, VARIANTES_VISIBLES)
  const restantes = variantes.length - visibles.length

  const acciones = [
    { label: 'Transferir entre sucursales', onClick: onTransferir, hidden: sucursales.length < 2 },
    { label: 'Ajustar precios', onClick: onPrecios },
    { label: 'Editar producto', onClick: onEditar },
    { label: 'Eliminar producto', onClick: onEliminar, danger: true },
  ]

  const marca = producto.marca ? getStyles(producto.marca) : null

  return (
    <article className={`stk-card${agotado ? ' is-empty' : ''}`}>
      <div className="stk-card-head">
        <div className="stk-thumb">
          {producto.imagen_url
            ? <img src={producto.imagen_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
            : <span aria-hidden="true">▣</span>}
        </div>

        <div className="stk-card-info">
          <h3 className="stk-card-name">
            <Resaltado texto={producto.nombre} termino={termino} />
          </h3>
          <div className="stk-card-meta">
            {marca && (
              <span
                className="brand-badge"
                style={{ '--brand-color': marca.color, '--brand-bg': marca.background, '--brand-border': marca.border }}
              >{producto.marca}</span>
            )}
            {producto.categoria && <span>{producto.categoria}</span>}
            {variantes.length > 1 && <span>{variantes.length} variantes</span>}
          </div>
        </div>

        <DropdownMenu items={acciones} />
      </div>

      {agotado && !expandido && (
        <div className="stk-card-empty-note">Sin stock en ninguna sucursal</div>
      )}

      {visibles.map(v => (
        <FilaVariante
          key={v.id}
          variante={v}
          sucursales={sucursales}
          sucursalActualId={sucursalActualId}
          onAjustar={onAjustar}
          termino={termino}
        />
      ))}

      {restantes > 0 && (
        <button className="stk-var-more" onClick={() => setExpandido(true)}>
          {agotado
            ? `Ver ${restantes === 1 ? 'la variante' : `las ${restantes} variantes`}`
            : `Ver ${restantes === 1 ? 'la restante' : `las ${restantes} restantes`}`}
        </button>
      )}

      {expandido && variantes.length > VARIANTES_VISIBLES && (
        <button className="stk-var-more" onClick={() => setExpandido(false)}>Ver menos</button>
      )}
    </article>
  )
}
