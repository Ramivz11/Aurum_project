import { useEffect, useRef, useState } from 'react'

/**
 * Tres chips —sucursal, marca, categoría— que muestran el valor elegido y
 * abren su lista al tocarlos.
 *
 * Antes eran categorías en scroll horizontal más una hoja con el resto: había
 * que abrir la hoja para saber si quedaba algún filtro puesto. Acá el estado se
 * lee sin tocar nada, que es lo que evita la confusión de "no aparece el
 * producto" cuando en realidad había un filtro viejo activo.
 */
export default function StockFilters({
  categorias, catFiltro, setCatFiltro,
  marcas, marcaFiltro, setMarcaFiltro,
  sucursales, sucFiltro, setSucFiltro,
}) {
  const [abierto, setAbierto] = useState(null)
  const ref = useRef(null)

  // Tocar fuera cierra la lista. Sin esto queda abierta tapando la primera fila
  // de productos y hay que volver al chip para sacarla del medio.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(null) }
    const esc = (e) => { if (e.key === 'Escape') setAbierto(null) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  const opcion = (valor, nombre) => ({ valor, nombre })

  const defs = [
    sucursales.length > 1 && {
      key: 'sucursal',
      label: 'Sucursal',
      valor: sucFiltro,
      set: setSucFiltro,
      nombre: sucursales.find(s => String(s.id) === String(sucFiltro))?.nombre || 'Todas',
      opciones: [opcion('', 'Todas'), ...sucursales.map(s => opcion(String(s.id), s.nombre))],
    },
    marcas.length > 0 && {
      key: 'marca',
      label: 'Marca',
      valor: marcaFiltro,
      set: setMarcaFiltro,
      nombre: marcaFiltro || 'Todas',
      opciones: [opcion('', 'Todas'), ...marcas.map(m => opcion(m, m))],
    },
    {
      key: 'categoria',
      label: 'Categoría',
      valor: catFiltro,
      set: setCatFiltro,
      nombre: catFiltro || 'Todas',
      opciones: [opcion('', 'Todas'), ...categorias.map(c => opcion(c.nombre, c.nombre))],
    },
  ].filter(Boolean)

  const activo = defs.find(d => d.key === abierto)

  return (
    <div className="stk-chips-wrap" ref={ref}>
      <div className="stk-chips">
        {defs.map(d => (
          <button
            key={d.key}
            type="button"
            className={[
              'stk-chip',
              d.valor ? 'is-set' : '',
              abierto === d.key ? 'is-open' : '',
            ].filter(Boolean).join(' ')}
            aria-expanded={abierto === d.key}
            onClick={() => setAbierto(a => (a === d.key ? null : d.key))}
          >
            <span className="stk-chip-text">
              <span className="stk-chip-label">{d.label}</span>
              <span className="stk-chip-value">{d.nombre}</span>
            </span>
            <span className="stk-chip-chev" aria-hidden="true">⌄</span>
          </button>
        ))}
      </div>

      {activo && (
        <div className="stk-drop" role="listbox" aria-label={activo.label}>
          {activo.opciones.map(o => {
            const seleccionada = String(activo.valor || '') === o.valor
            return (
              <button
                key={o.valor || '__todas'}
                type="button"
                role="option"
                aria-selected={seleccionada}
                className={`stk-drop-opt${seleccionada ? ' is-active' : ''}`}
                onClick={() => { activo.set(o.valor); setAbierto(null) }}
              >
                <span>{o.nombre}</span>
                {seleccionada && <span className="stk-drop-check" aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
