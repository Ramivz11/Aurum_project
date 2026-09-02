import { useState } from 'react'
import { DropdownMenu, formatARS } from '../../components/ui'
import { useMarca } from '../../context/MarcaContext'
import SucursalBarras from './SucursalBarras'
import {
  variantesActivas, etiquetaVariante, productoAgotado, totalProducto,
  cantidadEn, estadoStock, fmtN,
} from './stockUtils'

const num = (v) => Number(v || 0)

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

// Dos letras del nombre: es lo que sostiene la franja cuando el producto no
// tiene foto cargada, que en un inventario real es la mayoría.
const iniciales = (nombre) =>
  (nombre || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()

/**
 * Un importe de la card. Con varias variantes que no valen lo mismo no hay un
 * número único que mostrar, así que se muestra el menor con un "desde": es la
 * cifra con la que arranca cualquier conversación de mostrador.
 */
function Importe({ label, valores, destacado }) {
  const nums = valores.filter(n => n > 0)
  const min = nums.length ? Math.min(...nums) : null
  const desde = nums.length > 1 && nums.some(n => n !== min)

  return (
    <div className="stk-money-item">
      <span className="stk-money-label">{label}</span>
      {/* El "desde" se dice con un "+" pegado a la cifra: en una columna de 69px
          ni "COSTO DESDE" ni "desde $1.400" entran sin cortarse. Para quien usa
          lector de pantalla va la palabra completa, que el "+" no se lee. */}
      <span className={`stk-money-value${destacado ? ' is-venta' : ''}`}>
        {desde && <span className="stk-sr">desde </span>}
        {min === null ? '—' : formatARS(min)}
        {desde && <span className="stk-money-mas" aria-hidden="true">+</span>}
      </span>
    </div>
  )
}

/**
 * Card de producto en la grilla de dos columnas.
 *
 * Arriba la franja con la foto, que es lo que hace reconocible al producto sin
 * leer; abajo nombre, marca, costo y venta. El stock por sucursal vive plegado:
 * son cuatro renglones por producto y mostrarlos siempre dejaba entrar un
 * producto y medio por pantalla. El total sí queda a la vista, sobre la franja.
 */
export default function ProductCard({
  producto, sucursales, sucursalActualId, sucursalFiltradaId, termino,
  onAjustar, onEditar, onPrecios, onTransferir, onEliminar,
}) {
  const { getStyles } = useMarca()
  const [abierto, setAbierto] = useState(false)

  const variantes = variantesActivas(producto)
  const marca = producto.marca ? getStyles(producto.marca) : null

  // Con una sucursal elegida en el filtro, el número grande pasa a ser el de
  // esa sucursal: es la pregunta que se está haciendo quien filtró.
  const filtrada = sucursalFiltradaId
    ? sucursales.find(s => String(s.id) === String(sucursalFiltradaId))
    : null

  // Se apaga contra la misma pregunta que ordena la lista, así la tarjeta
  // apagada es siempre una de las de abajo y no hay dos criterios en pantalla.
  const agotado = productoAgotado(producto, filtrada?.id ?? null)
  const unidades = filtrada
    ? variantes.reduce((a, v) => a + cantidadEn(v, filtrada.id), 0)
    : totalProducto(producto)
  const minimo = variantes.reduce((a, v) => a + num(v.stock_minimo), 0)
  const estado = filtrada ? estadoStock(unidades, minimo) : null

  // Con una sola variante y una sola sucursal en juego, desplegar la card para
  // tocar la barra son dos toques de trámite antes de la acción más frecuente
  // de la pantalla. Cuando el destino es inequívoco, va directo en el menú.
  const sucDestino = filtrada || (sucursales.length === 1 ? sucursales[0] : null)
  const ajusteDirecto = variantes.length === 1 && sucDestino

  const acciones = [
    {
      label: sucursales.length > 1 ? `Ajustar stock en ${sucDestino?.nombre}` : 'Ajustar stock',
      onClick: () => onAjustar(variantes[0], sucDestino),
      hidden: !ajusteDirecto,
    },
    { label: 'Transferir entre sucursales', onClick: onTransferir, hidden: sucursales.length < 2 },
    { label: 'Ajustar precios', onClick: onPrecios },
    { label: 'Editar producto', onClick: onEditar },
    { label: 'Eliminar producto', onClick: onEliminar, danger: true },
  ]

  // La franja toma el color de la marca cuando no hay foto, así el producto
  // sigue siendo reconocible por color en la grilla.
  const franja = marca
    ? { background: marca.background, color: marca.color }
    : undefined

  return (
    <article className={`stk-card${agotado ? ' is-empty' : ''}${abierto ? ' is-open' : ''}`}>
      <button
        type="button"
        className="stk-card-main"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
      >
        <div className="stk-strip" style={franja}>
          {producto.imagen_url
            ? <img src={producto.imagen_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
            : <span className="stk-strip-ini" aria-hidden="true">{iniciales(producto.nombre)}</span>}

          <span
            className={`stk-strip-qty${estado ? ` is-${estado}` : ''}`}
            aria-label={filtrada
              ? `${fmtN(unidades)} unidades en ${filtrada.nombre}`
              : `${fmtN(unidades)} unidades en total`}
          >
            {fmtN(unidades)}<span className="stk-strip-u" aria-hidden="true">u.</span>
          </span>
        </div>

        <div className="stk-card-body">
          <h3 className="stk-card-name">
            <Resaltado texto={producto.nombre} termino={termino} />
          </h3>

          {/* Sólo marca y categoría: el tercer chip saltaba a un segundo renglón
              y dejaba los importes de las dos cards de la fila a distinta altura.
              La cuenta de variantes se dice abajo, donde además anticipa qué se
              va a abrir. */}
          <div className="stk-tags">
            {marca && (
              <span
                className="brand-badge"
                style={{ '--brand-color': marca.color, '--brand-bg': marca.background, '--brand-border': marca.border }}
              >{producto.marca}</span>
            )}
            {producto.categoria && <span className="stk-tag">{producto.categoria}</span>}
          </div>

          <div className="stk-money">
            <Importe label="Costo" valores={variantes.map(v => num(v.costo))} />
            <Importe label="Venta" valores={variantes.map(v => num(v.precio_venta))} destacado />
          </div>

          <span className="stk-expand">
            {abierto
              ? 'Ocultar'
              : variantes.length > 1
                ? `Sucursales · ${variantes.length} var.`
                : 'Sucursales'}
            <span className="stk-expand-chev" aria-hidden="true">⌄</span>
          </span>
        </div>
      </button>

      {/* Fuera del botón que despliega: un botón no puede contener otro, y las
          acciones tienen que seguir alcanzables sin abrir la card. */}
      <div className="stk-card-menu">
        <DropdownMenu items={acciones} />
      </div>

      {abierto && (
        <div className="stk-branches">
          <div className="stk-branches-title">Por sucursal</div>
          {variantes.map(v => (
            <div className="stk-branch-group" key={v.id}>
              {(variantes.length > 1 || etiquetaVariante(v) !== 'Única') && (
                <div className="stk-branch-var">
                  <Resaltado texto={etiquetaVariante(v)} termino={termino} />
                </div>
              )}
              <SucursalBarras
                variante={v}
                sucursales={sucursales}
                sucursalActualId={sucursalActualId}
                onAjustar={onAjustar}
              />
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
