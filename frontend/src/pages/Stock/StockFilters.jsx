import { useState } from 'react'
import { Modal } from '../../components/ui'

/**
 * Búsqueda fija arriba + categorías en scroll horizontal + hoja de filtros.
 *
 * La búsqueda es la herramienta de la tarea principal, así que queda pegada al
 * borde superior y no se va al scrollear. Marca y sucursal salen de la fila
 * (eran dos <select> nativos sueltos, visualmente ajenos a las categorías) y
 * pasan a una hoja con un contador de filtros activos.
 */
export default function StockFilters({
  busqueda, setBusqueda,
  categorias, catFiltro, setCatFiltro,
  marcas, marcaFiltro, setMarcaFiltro,
  sucursales, sucFiltro, setSucFiltro,
}) {
  const [hoja, setHoja] = useState(false)

  const activos = [marcaFiltro, sucFiltro].filter(Boolean).length
  const limpiar = () => { setMarcaFiltro(''); setSucFiltro('') }

  return (
    <>
      <div className="stk-searchbar">
        <div className="stk-search">
          <span className="stk-search-icon" aria-hidden="true">⌕</span>
          <input
            className="stk-search-input"
            type="search"
            inputMode="search"
            placeholder="Buscar producto, marca o sabor"
            aria-label="Buscar producto, marca o sabor"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="stk-search-clear" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">✕</button>
          )}
        </div>

        <div className="stk-filters">
          <div className="stk-pills" role="group" aria-label="Filtrar por categoría">
            {[{ id: '__all', nombre: 'Todo' }, ...categorias].map(cat => {
              const esTodo = cat.id === '__all'
              const activo = esTodo ? !catFiltro : catFiltro === cat.nombre
              return (
                <button
                  key={cat.id}
                  className={`stk-pill${activo ? ' is-active' : ''}`}
                  aria-pressed={activo}
                  onClick={() => setCatFiltro(esTodo ? '' : cat.nombre)}
                >{cat.nombre}</button>
              )
            })}
          </div>

          {(marcas.length > 0 || sucursales.length > 1) && (
            <button
              className={`stk-filter-btn${activos ? ' is-active' : ''}`}
              onClick={() => setHoja(true)}
            >
              Filtros
              {activos > 0 && <span className="stk-filter-count">{activos}</span>}
            </button>
          )}
        </div>
      </div>

      {hoja && (
        <Modal
          title="Filtros"
          onClose={() => setHoja(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={limpiar} disabled={!activos}>Limpiar</button>
              <button className="btn btn-primary" onClick={() => setHoja(false)}>Ver resultados</button>
            </>
          }
        >
          {marcas.length > 0 && (
            <div className="stk-field">
              <label className="stk-label" htmlFor="stk-marca">Marca</label>
              <select
                id="stk-marca"
                className="stk-input"
                value={marcaFiltro}
                onChange={e => setMarcaFiltro(e.target.value)}
              >
                <option value="">Todas las marcas</option>
                {marcas.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {sucursales.length > 1 && (
            <div className="stk-field">
              <span className="stk-label">Sucursal</span>
              <div className="stk-suc-picker">
                <button
                  className={`stk-suc-opt${!sucFiltro ? ' is-active' : ''}`}
                  onClick={() => setSucFiltro('')}
                >
                  <div className="stk-suc-opt-name">Todas</div>
                </button>
                {sucursales.map(s => (
                  <button
                    key={s.id}
                    className={`stk-suc-opt${String(sucFiltro) === String(s.id) ? ' is-active' : ''}`}
                    onClick={() => setSucFiltro(String(s.id))}
                  >
                    <div className="stk-suc-opt-name">{s.nombre}</div>
                  </button>
                ))}
              </div>
              <p className="stk-help">Muestra sólo los productos con stock en esa sucursal.</p>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
