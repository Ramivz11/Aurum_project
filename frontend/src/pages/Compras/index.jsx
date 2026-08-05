import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from '../../components/Toast'
import { comprasApi, productosApi } from '../../api'
import { useSucursal } from '../../context/SucursalContext'
import { Loading, EmptyState, ConfirmDialog, FAB, formatARS } from '../../components/ui'
import { loadPdf } from '../../utils/pdf'
import CompraRow from './CompraRow'
import CompraSheet from './CompraSheet'
import FacturaIA from './FacturaIA'
import ComprasResumen from './ComprasResumen'
import { agruparPorDia, textoBuscable, PAGO_CORTO, unidadesCompra } from './comprasUtils'
import '../../styles/compras.css'

export default function Compras() {
  const { sucursales } = useSucursal()

  const [compras, setCompras] = useState([])
  const [productos, setProductos] = useState([])
  const [primeraCarga, setPrimeraCarga] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [hoja, setHoja] = useState(null)     // { compra } para editar, {} para alta
  const [hojaIA, setHojaIA] = useState(false)
  const [confirmar, setConfirmar] = useState(null)

  // Pantalla completa, como Stock y Ventas: 64px más de lista en cada scroll.
  useEffect(() => {
    document.body.classList.add('cmp-full')
    return () => document.body.classList.remove('cmp-full')
  }, [])

  const cargar = useCallback(() => {
    return Promise.all([comprasApi.listar({}), productosApi.listar()])
      .then(([c, p]) => { setCompras(c.data || []); setProductos(p.data || []) })
      .catch(err => {
        toast.error('No se pudieron cargar las compras: ' + (err.message || 'sin conexión'))
        setCompras([])
      })
      .finally(() => setPrimeraCarga(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const sucursalMap = useMemo(
    () => Object.fromEntries(sucursales.map(s => [s.id, s.nombre])),
    [sucursales]
  )
  const nombreDeSucursal = useCallback(
    id => sucursalMap[id] || `Sucursal #${id}`,
    [sucursalMap]
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return compras
    return compras.filter(c => textoBuscable(c, nombreDeSucursal(c.sucursal_id)).includes(q))
  }, [compras, busqueda, nombreDeSucursal])

  const grupos = useMemo(() => agruparPorDia(visibles), [visibles])
  const totalListado = useMemo(
    () => visibles.reduce((s, c) => s + Number(c.total || 0), 0),
    [visibles]
  )

  const eliminar = async (id) => {
    try { await comprasApi.eliminar(id); toast.success('Compra eliminada'); cargar() }
    catch (e) { toast.error(e.message || 'No se pudo eliminar') }
  }

  const exportarPdf = async () => {
    if (!visibles.length) return toast.error('No hay compras para exportar')
    try {
      const { jsPDF, autoTable } = await loadPdf()
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Reporte de compras', 14, 20)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${busqueda ? `Filtro: "${busqueda}" | ` : ''}${new Date().toLocaleDateString('es-AR')}`,
        14, 28
      )

      const config = {
        startY: 35,
        head: [['Fecha', 'Proveedor', 'Sucursal', 'Unid.', 'Pago', 'Total']],
        body: visibles.map(c => [
          new Date(c.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
          c.proveedor || '—',
          nombreDeSucursal(c.sucursal_id),
          String(unidadesCompra(c)),
          PAGO_CORTO[c.metodo_pago] || c.metodo_pago,
          formatARS(c.total),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [41, 41, 41] },
        styles: { fontSize: 9 },
      }
      if (typeof autoTable === 'function') autoTable(doc, config)
      else doc.autoTable(config)

      doc.save(`Compras_${Date.now()}.pdf`)
    } catch (e) {
      toast.error('No se pudo generar el PDF: ' + e.message)
    }
  }

  return (
    <div className="cmp">
      <header className="cmp-head">
        <div className="cmp-head-row">
          <div className="cmp-search">
            <span className="cmp-search-icon" aria-hidden="true">⌕</span>
            <input
              className="cmp-search-input"
              type="search"
              inputMode="search"
              placeholder="Buscar proveedor, sucursal o producto"
              aria-label="Buscar proveedor, sucursal o producto"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="cmp-search-clear" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">✕</button>
            )}
          </div>
          <button className="cmp-action is-ia" onClick={() => setHojaIA(true)}>✨ Factura</button>
          <button className="cmp-new" onClick={() => setHoja({})}>+ Registrar compra</button>
        </div>

        {/* En el celular las dos formas de cargar van a la misma altura: sacarle
            una foto al remito es el camino corto y estaba escondido en la barra
            de acciones, con el mismo peso que "Exportar PDF". */}
        <div className="cmp-actions">
          <button className="cmp-action is-ia" onClick={() => setHojaIA(true)}>✨ Sacar foto al remito</button>
          <button className="cmp-action" onClick={() => setHoja({})}>Cargar a mano</button>
        </div>
      </header>

      <div className="cmp-scroll">
        <div className="cmp-panels">
          <ComprasResumen compras={visibles} sucursales={sucursales} totalListado={totalListado} />
        </div>

        <div className="cmp-list">
          {primeraCarga ? (
            <Loading />
          ) : visibles.length === 0 ? (
            <EmptyState
              icon="↓"
              text={busqueda ? 'Ninguna compra coincide con la búsqueda.' : 'Todavía no hay compras registradas.'}
              action={<button className="btn btn-primary" onClick={() => setHoja({})}>Registrar compra</button>}
            />
          ) : (
            <>
              {grupos.map(g => (
                <section className="cmp-group" key={g.clave}>
                  <header className="cmp-day">
                    <span>{g.etiqueta} · {g.compras.length} compra{g.compras.length === 1 ? '' : 's'}</span>
                    <span className="cmp-day-total">{formatARS(g.total)}</span>
                  </header>
                  {g.compras.map(c => (
                    <CompraRow
                      key={c.id}
                      compra={c}
                      sucursalNombre={nombreDeSucursal(c.sucursal_id)}
                      nombreDeSucursal={nombreDeSucursal}
                      onEditar={() => setHoja({ compra: c })}
                      onEliminar={() => setConfirmar({
                        mensaje: `¿Eliminar la compra a ${c.proveedor || 'sin proveedor'} por ${formatARS(c.total)}? Las unidades que sumó vuelven a salir del stock.`,
                        fn: () => eliminar(c.id),
                      })}
                    />
                  ))}
                </section>
              ))}

              <p className="cmp-hint">Tocá una compra para ver qué entró y a qué sucursal.</p>
              <div className="cmp-foot-actions">
                <button className="btn btn-ghost" onClick={exportarPdf}>Exportar PDF</button>
              </div>
            </>
          )}
        </div>
      </div>

      <FAB onClick={() => setHoja({})} title="Registrar compra" />

      {hoja && (
        <CompraSheet
          compra={hoja.compra || null}
          sucursales={sucursales}
          productos={productos}
          onClose={() => setHoja(null)}
          onSaved={cargar}
        />
      )}

      {hojaIA && (
        <FacturaIA
          sucursales={sucursales}
          productos={productos}
          onClose={() => setHojaIA(false)}
          onSaved={cargar}
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
