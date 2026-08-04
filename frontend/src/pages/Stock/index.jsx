import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from '../../components/Toast'
import { productosApi, categoriasProductoApi, stockApi, finanzasApi } from '../../api'
import { useSucursal } from '../../context/SucursalContext'
import { Loading, EmptyState, ConfirmDialog, FAB } from '../../components/ui'
import { loadPdf } from '../../utils/pdf'
import StockFilters from './StockFilters'
import StockSummary from './StockSummary'
import ProductCard from './ProductCard'
import AjusteStock from './sheets/AjusteStock'
import Transferencia from './sheets/Transferencia'
import ProductoSheet from './sheets/Producto'
import PrecioLote from './sheets/PrecioLote'
import CategoriasSheet from './sheets/Categorias'
import {
  fmtN, totalProducto, variantesActivas, productoAgotado,
} from './stockUtils'
import { formatARS } from '../../components/ui'
import '../../styles/stock.css'

export default function Stock() {
  // Las sucursales salen del contexto compartido: así la que se elige en el
  // menú lateral es la misma que queda marcada acá. Antes Stock traía su
  // propia lista e ignoraba esa selección.
  const { sucursales, sucursalActual } = useSucursal()

  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [marcas, setMarcas] = useState([])
  const [resumenDia, setResumenDia] = useState(null)
  const [cargandoResumen, setCargandoResumen] = useState(true)
  const [primeraCarga, setPrimeraCarga] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState('')
  const [sucFiltro, setSucFiltro] = useState('')

  const [hojaProducto, setHojaProducto] = useState(null)
  const [hojaPrecios, setHojaPrecios] = useState(null)
  const [hojaTransferencia, setHojaTransferencia] = useState(null)
  const [hojaCategorias, setHojaCategorias] = useState(false)
  const [hojaAjuste, setHojaAjuste] = useState(null)
  const [confirmar, setConfirmar] = useState(null)

  useEffect(() => {
    categoriasProductoApi.listar().then(r => setCategorias(r.data)).catch(() => {})
    stockApi.marcas().then(r => setMarcas(r.data)).catch(() => {})
    finanzasApi.resumenDia()
      .then(r => setResumenDia(r.data))
      .catch(() => {})
      .finally(() => setCargandoResumen(false))
  }, [])

  // Escribir en el buscador no puede disparar una consulta por tecla: en el
  // celular son varias llamadas por palabra y la lista parpadea mientras se
  // tipea.
  useEffect(() => {
    const id = setTimeout(() => setBusquedaDebounced(busqueda), 300)
    return () => clearTimeout(id)
  }, [busqueda])

  const cargar = useCallback(() => {
    const params = {}
    if (busquedaDebounced) params.busqueda = busquedaDebounced
    if (catFiltro) params.categoria = catFiltro
    if (marcaFiltro) params.marca = marcaFiltro
    if (sucFiltro) params.sucursal_id = sucFiltro
    return stockApi.listar(params)
      .then(r => setProductos(r.data))
      .catch(() => toast.error('No se pudo cargar el inventario'))
      .finally(() => setPrimeraCarga(false))
  }, [busquedaDebounced, catFiltro, marcaFiltro, sucFiltro])

  useEffect(() => { cargar() }, [cargar])

  // Stock corre a pantalla completa: se esconde la barra de navegación de abajo
  // mientras esta pantalla está montada. Son 64px más de lista en cada scroll,
  // y el acceso al resto de las secciones sigue estando en el ☰ de arriba.
  useEffect(() => {
    document.body.classList.add('stk-full')
    return () => document.body.classList.remove('stk-full')
  }, [])

  // Los agotados van al final. Arriba no se les puede vender a nadie y le
  // corren el lugar a lo que sí hay; abajo siguen alcanzables para reponer.
  // El orden dentro de cada grupo es el que manda el backend: sort() es
  // estable, así que ordenar por una clave de 0/1 no lo altera.
  const sucursalFiltrada = useMemo(
    () => sucursales.find(s => String(s.id) === String(sucFiltro)) || null,
    [sucursales, sucFiltro]
  )

  const ordenados = useMemo(() => {
    const agotado = p => (productoAgotado(p, sucursalFiltrada?.id ?? null) ? 1 : 0)
    return [...productos].sort((a, b) => agotado(a) - agotado(b))
  }, [productos, sucursalFiltrada])

  const eliminarProducto = async (id) => {
    try {
      await productosApi.eliminar(id)
      toast.success('Producto eliminado')
      cargar()
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar el producto')
    }
  }

  const exportarPdf = async () => {
    if (productos.length === 0) return toast.error('No hay productos para exportar')
    try {
      const { jsPDF, autoTable } = await loadPdf()
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Reporte de stock', 14, 20)

      const filtros = []
      if (catFiltro) filtros.push(`Categoría: ${catFiltro}`)
      if (marcaFiltro) filtros.push(`Marca: ${marcaFiltro}`)
      if (sucFiltro) {
        const suc = sucursales.find(s => String(s.id) === String(sucFiltro))
        if (suc) filtros.push(`Sucursal: ${suc.nombre}`)
      }

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${filtros.length ? filtros.join(' | ') : 'Todos los productos'} | ${new Date().toLocaleDateString('es-AR')}`,
        14, 28
      )

      // El PDF sale en el mismo orden que la pantalla: con los agotados al pie,
      // que es donde se los busca cuando se arma la lista de reposición.
      const cuerpo = ordenados.map(p => {
        const vs = variantesActivas(p)
        const precioDesde = vs.length ? Math.min(...vs.map(v => Number(v.precio_venta || 0))) : 0
        return [
          p.nombre,
          p.marca || '—',
          p.categoria || '—',
          `${vs.length}`,
          fmtN(totalProducto(p)),
          formatARS(precioDesde),
        ]
      })

      const config = {
        startY: 35,
        head: [['Producto', 'Marca', 'Categoría', 'Variantes', 'Stock', 'Precio desde']],
        body: cuerpo,
        theme: 'grid',
        headStyles: { fillColor: [41, 41, 41] },
        styles: { fontSize: 9 },
      }
      if (typeof autoTable === 'function') autoTable(doc, config)
      else doc.autoTable(config)

      doc.save(`Stock_${Date.now()}.pdf`)
    } catch (e) {
      toast.error('No se pudo generar el PDF: ' + e.message)
    }
  }

  return (
    <div className="stk">
      {/* Búsqueda y filtros quedan fuera del área que scrollea: son las dos
          herramientas de la tarea principal —buscar y acotar— y tienen que estar
          siempre bajo el pulgar, no a un scroll hasta arriba de distancia.

          Sin título ni bajada: "Stock" ya lo dice el menú por el que se entró y
          el ☰ de arriba, y acá costaba dos renglones fijos en cada visita. */}
      <header className="stk-head">
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
      </header>

      <StockFilters
        categorias={categorias} catFiltro={catFiltro} setCatFiltro={setCatFiltro}
        marcas={marcas} marcaFiltro={marcaFiltro} setMarcaFiltro={setMarcaFiltro}
        sucursales={sucursales} sucFiltro={sucFiltro} setSucFiltro={setSucFiltro}
      />

      <div className="stk-scroll">
        <StockSummary
          productos={productos}
          sucursales={sucursales}
          resumenDia={resumenDia}
          loadingResumen={cargandoResumen}
        />

        <div className="stk-list">
          {primeraCarga ? (
            <Loading />
          ) : productos.length === 0 ? (
            <EmptyState
              icon="▣"
              text={busqueda || catFiltro || marcaFiltro || sucFiltro
                ? 'Ningún producto coincide con la búsqueda.'
                : 'Todavía no hay productos cargados.'}
              action={
                <button className="btn btn-primary" onClick={() => setHojaProducto({})}>
                  Agregar producto
                </button>
              }
            />
          ) : (
            <>
              <div className="stk-grid">
                {ordenados.map(p => (
                  <ProductCard
                    key={p.id}
                    producto={p}
                    sucursales={sucursales}
                    sucursalActualId={sucursalActual?.id}
                    sucursalFiltradaId={sucFiltro}
                    termino={busquedaDebounced}
                    onAjustar={(variante, sucursal) => setHojaAjuste({ producto: p, variante, sucursal })}
                    onEditar={() => setHojaProducto(p)}
                    onPrecios={() => setHojaPrecios(p)}
                    onTransferir={() => setHojaTransferencia(p)}
                    onEliminar={() => setConfirmar({
                      mensaje: `¿Eliminar "${p.nombre}" del inventario?`,
                      fn: () => eliminarProducto(p.id),
                    })}
                  />
                ))}
              </div>

              {/* Al pie y no al tope: la edición por toque hay que descubrirla una
                  vez, y arriba le robaba una línea a la lista en cada visita. */}
              <p className="stk-hint">Tocá una sucursal para ajustar su stock.</p>

              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={exportarPdf}>Exportar PDF</button>
                <button className="btn btn-ghost" onClick={() => setHojaCategorias(true)}>Categorías</button>
              </div>
            </>
          )}
        </div>
      </div>

      <FAB onClick={() => setHojaProducto({})} title="Agregar producto" />

      {hojaAjuste && (
        <AjusteStock
          producto={hojaAjuste.producto}
          variante={hojaAjuste.variante}
          sucursal={hojaAjuste.sucursal}
          onClose={() => setHojaAjuste(null)}
          onSaved={cargar}
        />
      )}

      {hojaTransferencia && (
        <Transferencia
          producto={hojaTransferencia}
          sucursales={sucursales}
          sucursalActualId={sucursalActual?.id}
          onClose={() => setHojaTransferencia(null)}
          onSaved={cargar}
        />
      )}

      {hojaProducto !== null && (
        <ProductoSheet
          producto={hojaProducto}
          categorias={categorias}
          onClose={() => setHojaProducto(null)}
          onSaved={cargar}
        />
      )}

      {hojaPrecios && (
        <PrecioLote
          producto={hojaPrecios}
          onClose={() => setHojaPrecios(null)}
          onSaved={cargar}
        />
      )}

      {hojaCategorias && (
        <CategoriasSheet
          onClose={() => {
            setHojaCategorias(false)
            categoriasProductoApi.listar().then(r => setCategorias(r.data)).catch(() => {})
          }}
        />
      )}

      {confirmar && (
        <ConfirmDialog
          message={confirmar.mensaje}
          onConfirm={() => { confirmar.fn(); setConfirmar(null) }}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </div>
  )
}
