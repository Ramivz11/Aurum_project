import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from '../../components/Toast'
import { ventasApi, clientesApi, sucursalesApi, finanzasApi } from '../../api'
import { Loading, EmptyState, ConfirmDialog, FAB, formatARS, METODO_PAGO_LABEL } from '../../components/ui'
import { loadPdf } from '../../utils/pdf'
import VentaRow from './VentaRow'
import VentaSheet from './VentaSheet'
import VentasResumen from './VentasResumen'
import AlertasRecompra from './AlertasRecompra'
import { agruparPorDia, textoBuscable } from './ventasUtils'
import '../../styles/ventas.css'

const FILTROS = [
  { key: '', label: 'Todas' },
  { key: 'abierta', label: 'Pedidos' },
  { key: 'confirmada', label: 'Confirmadas' },
]

export default function Ventas() {
  const [ventas, setVentas] = useState([])
  const [clientes, setClientes] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [alertas, setAlertas] = useState([])
  const [resumenDia, setResumenDia] = useState(null)
  const [cargandoResumen, setCargandoResumen] = useState(true)
  const [primeraCarga, setPrimeraCarga] = useState(true)

  const [filtro, setFiltro] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [hoja, setHoja] = useState(null)      // { venta } para editar, {} para alta
  const [confirmar, setConfirmar] = useState(null)

  // Ventas corre a pantalla completa, igual que Stock: se esconde la barra de
  // navegación de abajo mientras está montada. Son 64px más de lista, y el
  // resto de las secciones sigue estando en el ☰ de arriba.
  useEffect(() => {
    document.body.classList.add('vta-full')
    return () => document.body.classList.remove('vta-full')
  }, [])

  useEffect(() => {
    finanzasApi.resumenDia()
      .then(r => setResumenDia(r.data))
      .catch(() => {})
      .finally(() => setCargandoResumen(false))
  }, [])

  const cargar = useCallback(() => {
    return Promise.all([
      ventasApi.listar(filtro ? { estado: filtro } : {}),
      clientesApi.listar(),
      sucursalesApi.listar(),
      clientesApi.alertasRecompra().catch(() => ({ data: [] })),
    ]).then(([v, c, s, a]) => {
      setVentas(v?.data || [])
      setClientes(c?.data || [])
      setSucursales(s?.data || [])
      setAlertas(a?.data || [])
    }).catch(err => {
      toast.error('No se pudieron cargar las ventas: ' + (err.message || 'sin conexión'))
      setVentas([])
    }).finally(() => setPrimeraCarga(false))
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  const clienteMap = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c.nombre])), [clientes])
  const sucursalMap = useMemo(() => Object.fromEntries(sucursales.map(s => [s.id, s.nombre])), [sucursales])

  const nombreCliente = useCallback(
    v => (v.cliente_id ? (v.cliente_nombre || clienteMap[v.cliente_id] || `Cliente #${v.cliente_id}`) : null),
    [clienteMap]
  )
  const nombreSucursal = useCallback(
    v => sucursalMap[v.sucursal_id] || `Sucursal #${v.sucursal_id}`,
    [sucursalMap]
  )

  // La búsqueda filtra en el cliente: la lista ya está entera en memoria y así
  // responde a cada tecla sin ida y vuelta al servidor.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return ventas
    return ventas.filter(v => textoBuscable(v, nombreCliente(v), nombreSucursal(v)).includes(q))
  }, [ventas, busqueda, nombreCliente, nombreSucursal])

  const grupos = useMemo(() => agruparPorDia(visibles), [visibles])
  const pendientes = useMemo(() => ventas.filter(v => v.estado === 'abierta').length, [ventas])
  const totalListado = useMemo(
    () => visibles.reduce((a, v) => a + (v.estado === 'cancelada' ? 0 : Number(v.total || 0)), 0),
    [visibles]
  )

  const eliminar = async (id) => {
    try { await ventasApi.eliminar(id); toast.success('Venta eliminada'); cargar() }
    catch (e) { toast.error(e.message || 'No se pudo eliminar') }
  }

  const confirmarVenta = async (id) => {
    try { await ventasApi.confirmar(id); toast.success('Venta confirmada'); cargar() }
    catch (e) { toast.error(e.message || 'No se pudo confirmar') }
  }

  const exportarPdf = async () => {
    if (!visibles.length) return toast.error('No hay ventas para exportar')
    try {
      const { jsPDF, autoTable } = await loadPdf()
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Reporte de ventas', 14, 20)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const etiqueta = FILTROS.find(f => f.key === filtro)?.label || 'Todas'
      doc.text(
        `${etiqueta}${busqueda ? ` · "${busqueda}"` : ''} | ${new Date().toLocaleDateString('es-AR')}`,
        14, 28
      )

      const config = {
        startY: 35,
        head: [['Cliente', 'Sucursal', 'Fecha', 'Pago', 'Total', 'Estado']],
        body: visibles.map(v => [
          nombreCliente(v) || 'Sin cliente',
          nombreSucursal(v),
          new Date(v.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
          METODO_PAGO_LABEL[v.metodo_pago] || v.metodo_pago,
          formatARS(v.total),
          v.estado.toUpperCase(),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [41, 41, 41] },
        styles: { fontSize: 9 },
      }
      if (typeof autoTable === 'function') autoTable(doc, config)
      else doc.autoTable(config)

      doc.save(`Ventas_${filtro || 'todas'}_${Date.now()}.pdf`)
    } catch (e) {
      toast.error('No se pudo generar el PDF: ' + e.message)
    }
  }

  return (
    <div className="vta">
      {/* Buscador y filtro fuera del área que scrollea: son las herramientas de
          la tarea principal —encontrar una venta— y tienen que estar siempre
          bajo el pulgar. Sin título de pantalla: lo dice el menú por el que se
          entró y acá costaba dos renglones fijos en cada visita. */}
      <header className="vta-head">
        <div className="vta-head-row">
          <div className="vta-search">
            <span className="vta-search-icon" aria-hidden="true">⌕</span>
            <input
              className="vta-search-input"
              type="search"
              inputMode="search"
              placeholder="Buscar cliente, sucursal o producto"
              aria-label="Buscar cliente, sucursal o producto"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="vta-search-clear" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">✕</button>
            )}
          </div>
          <button className="vta-new" onClick={() => setHoja({})}>+ Registrar venta</button>
        </div>

        <div className="vta-tabs" role="tablist">
          {FILTROS.map(f => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filtro === f.key}
              className={`vta-tab${filtro === f.key ? ' is-active' : ''}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
              {f.key === 'abierta' && pendientes > 0 && <span className="vta-tab-count">{pendientes}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className="vta-scroll">
        <div className="vta-panels">
          <VentasResumen
            cantidad={visibles.length}
            totalListado={totalListado}
            pendientes={pendientes}
            resumenDia={resumenDia}
            cargando={cargandoResumen}
          />
          <AlertasRecompra alertas={alertas} />
        </div>

        <div className="vta-list">
          {primeraCarga ? (
            <Loading />
          ) : visibles.length === 0 ? (
            <EmptyState
              icon="↑"
              text={busqueda || filtro
                ? 'Ninguna venta coincide con el filtro.'
                : 'Todavía no hay ventas registradas.'}
              action={<button className="btn btn-primary" onClick={() => setHoja({})}>Registrar venta</button>}
            />
          ) : (
            <>
              {grupos.map(g => (
                <section className="vta-group" key={g.clave}>
                  <header className="vta-day">
                    <span>{g.etiqueta} · {g.ventas.length} venta{g.ventas.length === 1 ? '' : 's'}</span>
                    <span className="vta-day-total">{formatARS(g.total)}</span>
                  </header>
                  {g.ventas.map(v => (
                    <VentaRow
                      key={v.id}
                      venta={v}
                      clienteNombre={nombreCliente(v)}
                      sucursalNombre={nombreSucursal(v)}
                      onEditar={() => setHoja({ venta: v })}
                      onConfirmar={() => confirmarVenta(v.id)}
                      onEliminar={() => setConfirmar({
                        mensaje: `¿Eliminar la venta de ${nombreCliente(v) || 'sin cliente'} por ${formatARS(v.total)}? Si estaba confirmada, el stock vuelve al inventario.`,
                        fn: () => eliminar(v.id),
                      })}
                    />
                  ))}
                </section>
              ))}

              <p className="vta-hint">Tocá una venta para ver el detalle y editarla.</p>
              <div className="vta-foot-actions">
                <button className="btn btn-ghost" onClick={exportarPdf}>Exportar PDF</button>
              </div>
            </>
          )}
        </div>
      </div>

      <FAB onClick={() => setHoja({})} title="Registrar venta" />

      {hoja && (
        <VentaSheet
          ventaEditar={hoja.venta || null}
          sucursales={sucursales}
          onClose={() => setHoja(null)}
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
