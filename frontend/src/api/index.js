import { api } from './client'

// ── PRODUCTOS ──
export const productosApi = {
  listar: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/productos${q ? '?' + q : ''}`)
  },
  obtener: (id) => api.get(`/productos/${id}`),
  crear: (data) => api.post('/productos', data),
  actualizar: (id, data) => api.put(`/productos/${id}`, data),
  eliminar: (id) => api.delete(`/productos/${id}`),
  ajustarPrecioLote: (data) => api.post('/productos/lote/precio', data),
  crearVariante: (productoId, data) => api.post(`/productos/${productoId}/variantes`, data),
  actualizarVariante: (varianteId, data) => api.put(`/productos/variantes/${varianteId}`, data),
  eliminarVariante: (varianteId) => api.delete(`/productos/variantes/${varianteId}`),
  ajustarStock: (varianteId, stockActual) => api.put(`/productos/variantes/${varianteId}/stock`, { stock_actual: stockActual }),
}

// ── VENTAS ──
export const ventasApi = {
  listar: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/ventas${q ? '?' + q : ''}`)
  },
  pedidosAbiertos: () => api.get('/ventas/pedidos-abiertos'),
  obtener: (id) => api.get(`/ventas/${id}`),
  crear: (data) => api.post('/ventas', data),
  actualizar: (id, data) => api.put(`/ventas/${id}`, data),
  confirmar: (id) => api.post(`/ventas/${id}/confirmar`, {}),
  eliminar: (id) => api.delete(`/ventas/${id}`),
}

// ── COMPRAS ──
export const comprasApi = {
  listar: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/compras${q ? '?' + q : ''}`)
  },
  crear: (data) => api.post('/compras', data),
  actualizar: (id, data) => api.put(`/compras/${id}`, data),
  eliminar: (id) => api.delete(`/compras/${id}`),
  analizarFactura: (formData) => api.postForm('/compras/factura/ia', formData),
}

// ── CLIENTES ──
export const clientesApi = {
  listar: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/clientes${q ? '?' + q : ''}`)
  },
  topMes: () => api.get('/clientes/top-mes'),
  obtener: (id) => api.get(`/clientes/${id}`),
  crear: (data) => api.post('/clientes', data),
  actualizar: (id, data) => api.put(`/clientes/${id}`, data),
  eliminar: (id) => api.delete(`/clientes/${id}`),
}

// ── FINANZAS ──
export const finanzasApi = {
  liquidez: () => api.get('/finanzas/liquidez'),
  ajustarSaldo: (data) => api.post('/finanzas/ajuste-saldo', data),
  analisisMes: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/finanzas/analisis-mes${q ? '?' + q : ''}`)
  },
  productosTop: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/finanzas/productos-top${q ? '?' + q : ''}`)
  },
  listarGastos: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/finanzas/gastos${q ? '?' + q : ''}`)
  },
  crearGasto: (data) => api.post('/finanzas/gastos', data),
  categoriasGasto: () => api.get('/finanzas/categorias-gasto'),
  crearCategoria: (nombre) => api.post(`/finanzas/categorias-gasto?nombre=${encodeURIComponent(nombre)}`),
}

// ── MOVIMIENTOS ──
export const movimientosApi = {
  resumen: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/movimientos/resumen${q ? '?' + q : ''}`)
  },
  ventas: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/movimientos/ventas${q ? '?' + q : ''}`)
  },
  compras: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/movimientos/compras${q ? '?' + q : ''}`)
  },
}

// ── SUCURSALES ──
export const sucursalesApi = {
  listar: () => api.get('/sucursales'),
  crear: (data) => api.post('/sucursales', data),
  actualizar: (id, data) => api.put(`/sucursales/${id}`, data),
  eliminar: (id) => api.delete(`/sucursales/${id}`),
  comparacion: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/sucursales/comparacion${q ? '?' + q : ''}`)
  },
}

// ── DEUDAS ──
export const deudasApi = {
  listar: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/deudas${q ? '?' + q : ''}`)
  },
  resumen: () => api.get('/deudas/resumen'),
  crear: (data) => api.post('/deudas', data),
  actualizar: (id, data) => api.put(`/deudas/${id}`, data),
  saldar: (id) => api.post(`/deudas/${id}/saldar`, {}),
  eliminar: (id) => api.delete(`/deudas/${id}`),
}
