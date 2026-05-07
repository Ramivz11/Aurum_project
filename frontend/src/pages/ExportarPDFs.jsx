import { useState } from 'react'
import toast from 'react-hot-toast'
import { exportElementToPDF } from '../api/pdfExport'

export default function ExportarPDFs() {
  const [exportando, setExportando] = useState({})
  const [mostrarInfo, setMostrarInfo] = useState({})

  const seccionesExportacion = [
    {
      id: 'finanzas',
      nombre: 'Reporte de Finanzas',
      descripcion: 'Exporta tu reporte de finanzas incluyendo liquidez, análisis del mes y productos más rentables',
      ruta: '/finanzas',
      icono: '💰',
    },
    {
      id: 'stock',
      nombre: 'Reporte de Inventario',
      descripcion: 'Exporta el estado completo del inventario con cantidades por sucursal y niveles mínimos',
      ruta: '/stock',
      icono: '📦',
    },
    {
      id: 'ventas',
      nombre: 'Reporte de Ventas',
      descripcion: 'Exporta el listado de todas tus ventas con detalles de clientes, montos y métodos de pago',
      ruta: '/ventas',
      icono: '💹',
    },
  ]

  const handleExportar = async (seccion) => {
    try {
      setExportando(prev => ({ ...prev, [seccion.id]: true }))
      
      // Navegamos a la página y esperamos a que cargue
      window.open(seccion.ruta, '_blank')
      
      // Esperamos un poco para que el usuario sepa qué hacer
      setTimeout(() => {
        toast.success(`Abierto: ${seccion.nombre}. Haz clic en "Exportar PDF"`, {
          duration: 5000,
        })
      }, 1000)
    } catch (error) {
      toast.error(`Error: ${error.message}`)
    } finally {
      setExportando(prev => ({ ...prev, [seccion.id]: false }))
    }
  }

  const toggleInfo = (id) => {
    setMostrarInfo(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Exportar PDFs</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
          Descarga tus reportes en formato PDF
        </div>
      </div>

      <div className="content page-enter" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: 30 }}>
          <div style={{
            background: 'rgba(255,152,0,0.1)',
            border: '1px solid rgba(255,152,0,0.3)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 30,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#ff9800', marginBottom: 8 }}>
              💡 Cómo usar
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              Selecciona una sección para abrir su página completa. Una vez dentro, verás el botón{' '}
              <strong>"📄 Exportar PDF"</strong> en la barra superior. Haz clic para descargar el reporte.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {seccionesExportacion.map(seccion => (
            <div
              key={seccion.id}
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.1) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(255,152,0,0.3)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,152,0,0.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Header con icono */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.2) 100%)',
                padding: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ fontSize: 32 }}>{seccion.icono}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {seccion.nombre}
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div style={{ padding: 20 }}>
                <div style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}>
                  {seccion.descripcion}
                </div>

                {/* Botón info */}
                <button
                  onClick={() => toggleInfo(seccion.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff9800',
                    fontSize: 12,
                    cursor: 'pointer',
                    marginBottom: 12,
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  {mostrarInfo[seccion.id] ? '▼ Menos detalles' : '▶ Más detalles'}
                </button>

                {/* Detalles expandibles */}
                {mostrarInfo[seccion.id] && (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.6,
                  }}>
                    <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Incluye:</strong>
                    <ul style={{ margin: '8px 0 0 16px', paddingLeft: 0 }}>
                      {seccion.id === 'finanzas' && (
                        <>
                          <li>Liquidez actual (efectivo, transferencias, tarjeta)</li>
                          <li>Análisis del mes (ingresos, compras, gastos, neto)</li>
                          <li>Valor del stock (costo, venta, ganancia potencial)</li>
                          <li>Productos más rentables</li>
                        </>
                      )}
                      {seccion.id === 'stock' && (
                        <>
                          <li>Estado de inventario completo</li>
                          <li>Cantidades por sucursal</li>
                          <li>Niveles mínimos de stock</li>
                          <li>Información de marcas y categorías</li>
                        </>
                      )}
                      {seccion.id === 'ventas' && (
                        <>
                          <li>Listado de todas las ventas</li>
                          <li>Detalles de clientes</li>
                          <li>Montos y métodos de pago</li>
                          <li>Estado de cada venta (abierta/confirmada)</li>
                        </>
                      )}
                    </ul>
                  </div>
                )}

                {/* Botón principal */}
                <button
                  onClick={() => handleExportar(seccion)}
                  disabled={exportando[seccion.id]}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                    border: 'none',
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: exportando[seccion.id] ? 'not-allowed' : 'pointer',
                    opacity: exportando[seccion.id] ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (!exportando[seccion.id]) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(255,152,0,0.4)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {exportando[seccion.id] ? '⏳ Abriendo...' : `📄 Abrir ${seccion.nombre}`}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Nota importante */}
        <div style={{
          marginTop: 40,
          padding: 20,
          background: 'rgba(33,150,243,0.1)',
          border: '1px solid rgba(33,150,243,0.3)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            <strong style={{ color: '#2196f3' }}>📌 Nota:</strong> Los PDFs se generan con los datos actuales.
            Si deseas exportar datos específicos de una fecha, usa los filtros disponibles en cada sección antes de exportar.
          </div>
        </div>
      </div>
    </>
  )
}
