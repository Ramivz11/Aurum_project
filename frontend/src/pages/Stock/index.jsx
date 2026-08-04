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
  fmtN, totalProducto, variantesActivas, productoBajoMinimo,
} from './stockUtils'
import { formatARS } from '../../components/ui'
import '../../styles/stock.css'

// Aviso de reposición. Es información, no una acción: se puede cerrar y no
// vuelve a molestar hasta que se recarga la pantalla.
function AvisoReposicion({ productos, sucursales }) {
  const [cerrado, setCerrado] = useState(false)
  const bajos = productos.filter(p => productoBajoMinimo(p, sucursales))
  if (cerrado || bajos.length === 0) return null

  const nombres = bajos.slice(0, 3).map(p => p.nombre).join(', ')
  const resto = bajos.length - 3

  return (
    <div className="stk-alert" role="status">
      <span aria-hidden="true">⚠</span>
      <div className="stk-alert-body">
        <div className="stk-alert-title">
          {bajos.length} producto{bajos.length === 1 ? '' : 's'} para reponer
        </div>
        <div className="stk-alert-names">
          {nombres}{resto > 0 && ` y ${resto} más`}
        </div>
      </div>
      <button className="stk-alert-close" onClick={() => setCerrado(true)} aria-label="Cerrar aviso">✕</button>
    </div>
  )
}

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

      const cuerpo = productos.map(p => {
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

  // La grilla se dimensiona con la cantidad real de sucursales, para que las
  // columnas queden alineadas entre todas las filas de la lista.
  const estilo = useMemo(
    () => ({ '--cols': Math.max(1, sucursales.length) }),
    [sucursales.length]
  )

  return (
    <div className="stk" style={estilo}>
      <div className="stk-scroll">
        <header className="stk-head">
          <h1 className="stk-head-title">Inventario</h1>
          <span className="stk-head-count">
            {fmtN(productos.length)} producto{productos.length === 1 ? '' : 's'}
          </span>
        </header>

        <StockFilters
          busqueda={busqueda} setBusqueda={setBusqueda}
          categorias={categorias} catFiltro={catFiltro} setCatFiltro={setCatFiltro}
          marcas={marcas} marcaFiltro={marcaFiltro} setMarcaFiltro={setMarcaFiltro}
          sucursales={sucursales} sucFiltro={sucFiltro} setSucFiltro={setSucFiltro}
        />

        <StockSummary
          productos={productos}
          sucursales={sucursales}
          resumenDia={resumenDia}
          loadingResumen={cargandoResumen}
        />

        <AvisoReposicion productos={productos} sucursales={sucursales} />

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
              <p className="stk-hint">Tocá una cantidad para ajustarla.</p>
              {productos.map(p => (
                <ProductCard
                  key={p.id}
                  producto={p}
                  sucursales={sucursales}
                  sucursalActualId={sucursalActual?.id}
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
