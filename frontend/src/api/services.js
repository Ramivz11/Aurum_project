import api from './client'

export const productosApi = {
  listar: (params) => api.get('/productos', { params }),
  obtener: (id) => api.get(`/productos/${id}`),
  crear: (data) => api.post('/productos', data),
  actualizar: (id, data) => api.put(`/productos/${id}`, data),
  eliminar: (id) => api.delete(`/productos/${id}`),
  ajustarPrecioLote: (data) => api.post('/productos/lote/precio', data),
  listarVariantes: (productoId) => api.get(`/productos/${productoId}/variantes`),
  crearVariante: (productoId, data) => api.post(`/productos/${productoId}/variantes`, data),
  actualizarVariante: (id, data) => api.put(`/productos/variantes/${id}`, data),
  eliminarVariante: (id) => api.delete(`/productos/variantes/${id}`),
}
export const ventasApi = {
  listar: (params) => api.get('/ventas', { params }),
  pedidosAbiertos: () => api.get('/ventas/pedidos-abiertos'),
  obtener: (id) => api.get(`/ventas/${id}`),
  crear: (data) => api.post('/ventas', data),
  actualizar: (id, data) => api.put(`/ventas/${id}`, data),
  confirmar: (id) => api.post(`/ventas/${id}/confirmar`),
  eliminar: (id) => api.delete(`/ventas/${id}`),
}
export const comprasApi = {
  listar: (params) => api.get('/compras', { params }),
  obtener: (id) => api.get(`/compras/${id}`),
  crear: (data) => api.post('/compras', data),
  actualizar: (id, data) => api.put(`/compras/${id}`, data),
  eliminar: (id) => api.delete(`/compras/${id}`),
  analizarFactura: (file) => {
    const form = new FormData()
    form.append('archivo', file)
    return api.post('/compras/factura/ia', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}
export const clientesApi = {
  listar: (params) => api.get('/clientes', { params }),
  topMes: (params) => api.get('/clientes/top-mes', { params }),
  obtener: (id) => api.get(`/clientes/${id}`),
  crear: (data) => api.post('/clientes', data),
  actualizar: (id, data) => api.put(`/clientes/${id}`, data),
  eliminar: (id) => api.delete(`/clientes/${id}`),
}
export const finanzasApi = {
  liquidez: () => api.get('/finanzas/liquidez'),
  ajustarSaldo: (data) => api.post('/finanzas/ajuste-saldo', data),
  analisisMes: (params) => api.get('/finanzas/analisis-mes', { params }),
  productosTop: (params) => api.get('/finanzas/productos-top', { params }),
  listarGastos: (params) => api.get('/finanzas/gastos', { params }),
  crearGasto: (data) => api.post('/finanzas/gastos', data),
  categoriasGasto: () => api.get('/finanzas/categorias-gasto'),
}
export const movimientosApi = {
  resumen: (params) => api.get('/movimientos/resumen', { params }),
  ventas: (params) => api.get('/movimientos/ventas', { params }),
  compras: (params) => api.get('/movimientos/compras', { params }),
}
export const sucursalesApi = {
  listar: () => api.get('/sucursales'),
  crear: (data) => api.post('/sucursales', data),
  comparacion: (params) => api.get('/sucursales/comparacion', { params }),
}
export const deudasApi = {
  listar: (params) => api.get('/deudas', { params }),
  resumen: () => api.get('/deudas/resumen'),
  crear: (data) => api.post('/deudas', data),
  actualizar: (id, data) => api.put(`/deudas/${id}`, data),
  saldar: (id) => api.post(`/deudas/${id}/saldar`),
  eliminar: (id) => api.delete(`/deudas/${id}`),
}
