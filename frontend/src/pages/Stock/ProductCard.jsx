import { useState } from 'react'
import { DropdownMenu, formatARS } from '../../components/ui'
import { useMarca } from '../../context/MarcaContext'
import SucursalGrid from './SucursalGrid'
import { variantesActivas, etiquetaVariante, productoAgotado } from './stockUtils'

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

const num = (v) => Number(v || 0)

// El costo va escrito con su palabra al lado. Dos importes pelados uno junto al
// otro se confunden entre sí, y confundir costo con precio de venta es el peor
// error posible en esta pantalla.
function Costo({ valor }) {
  if (num(valor) <= 0) return null
  return (
    <span className="stk-costo">
      costo <span className="stk-costo-val">{formatARS(valor)}</span>
    </span>
  )
}

/**
 * Una variante ocupa una línea de rótulo más su grilla de sucursales. Cuando no
 * hay nada que rotular — producto de una sola variante sin sabor ni tamaño, y
 * con el precio ya resuelto en la cabecera — la línea directamente no se dibuja:
 * era un renglón en blanco por producto en la mitad del inventario.
 */
function FilaVariante({ variante, sucursales, sucursalActualId, onAjustar, termino, mostrarNombre, mostrarImportes }) {
  return (
    <div className={`stk-var${!mostrarNombre && !mostrarImportes ? ' is-solo' : ''}`}>
      {(mostrarNombre || mostrarImportes) && (
        <div className="stk-var-label">
          {mostrarNombre && (
            <span className="stk-var-name">
              <Resaltado texto={etiquetaVariante(variante)} termino={termino} />
            </span>
          )}
          {mostrarImportes && (
            <span className="stk-importes">
              <Costo valor={variante.costo} />
              <span className="stk-var-price">{formatARS(variante.precio_venta)}</span>
            </span>
          )}
        </div>
      )}
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

  // Casi todos los productos valen lo mismo en todas sus variantes. Cuando pasa,
  // costo y precio viven una sola vez arriba y cada variante se queda con lo
  // suyo: el stock. Repetir el mismo importe en cada fila era la mitad del alto
  // de la tarjeta gastada en decir tres veces lo mismo.
  const base = variantes[0]
  const uniforme = variantes.length > 0 && variantes.every(v =>
    num(v.precio_venta) === num(base.precio_venta) && num(v.costo) === num(base.costo)
  )

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
        {/* Sin imagen no se dibuja un recuadro vacío: el marcador de posición no
            decía nada y le comía ancho al nombre en cada producto. */}
        {producto.imagen_url && (
          <div className="stk-thumb">
            <img src={producto.imagen_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
          </div>
        )}

        <div className="stk-card-info">
          <h3 className="stk-card-name">
            <Resaltado texto={producto.nombre} termino={termino} />
          </h3>
          {/* Marca, categoría y costo comparten renglón: son los tres datos de
              apoyo del producto y ninguno merece una línea propia. */}
          <div className="stk-card-meta">
            {marca && (
              <span
                className="brand-badge"
                style={{ '--brand-color': marca.color, '--brand-bg': marca.background, '--brand-border': marca.border }}
              >{producto.marca}</span>
            )}
            {producto.categoria && <span>{producto.categoria}</span>}
            {uniforme && <Costo valor={base.costo} />}
            {variantes.length > 1 && <span>{variantes.length} variantes</span>}
          </div>
        </div>

        {uniforme && <span className="stk-card-price">{formatARS(base.precio_venta)}</span>}

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
          mostrarNombre={variantes.length > 1 || etiquetaVariante(v) !== 'Única'}
          mostrarImportes={!uniforme}
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
