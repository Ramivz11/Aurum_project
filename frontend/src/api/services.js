import { api } from './client'

// Filtra undefined/null/'' antes de armar la query string
const buildQuery = (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  const q = new URLSearchParams(clean).toString()
  return q ? '?' + q : ''
}

// ── PRODUCTOS ──
export const productosApi = {
  listar: (params = {}) => {
    return api.get(`/productos${buildQuery(params)}`)
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
    return api.get(`/ventas${buildQuery(params)}`)
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
    return api.get(`/compras${buildQuery(params)}`)
  },
  crear: (data) => api.post('/compras', data),
  actualizar: (id, data) => api.put(`/compras/${id}`, data),
  eliminar: (id) => api.delete(`/compras/${id}`),
  analizarFactura: (formData) => api.postForm('/compras/factura/ia', formData),
}

// ── CLIENTES ──
export const clientesApi = {
  listar: (params = {}) => {
    return api.get(`/clientes${buildQuery(params)}`)
  },
  topMes: () => api.get('/clientes/top-mes'),
  topHistorico: () => api.get('/clientes/top-historico'),
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
    return api.get(`/finanzas/analisis-mes${buildQuery(params)}`)
  },
  productosTop: (params = {}) => {
    return api.get(`/finanzas/productos-top${buildQuery(params)}`)
  },
  listarGastos: (params = {}) => {
    return api.get(`/finanzas/gastos${buildQuery(params)}`)
  },
  crearGasto: (data) => api.post('/finanzas/gastos', data),
  categoriasGasto: () => api.get('/finanzas/categorias-gasto'),
  crearCategoria: (nombre) => api.post(`/finanzas/categorias-gasto?nombre=${encodeURIComponent(nombre)}`),
  resumenDia: () => api.get('/finanzas/resumen-dia'),
}

// ── MOVIMIENTOS ──
export const movimientosApi = {
  resumen: (params = {}) => {
    return api.get(`/movimientos/resumen${buildQuery(params)}`)
  },
  ventas: (params = {}) => {
    return api.get(`/movimientos/ventas${buildQuery(params)}`)
  },
  compras: (params = {}) => {
    return api.get(`/movimientos/compras${buildQuery(params)}`)
  },
}

// ── STOCK (con desglose por sucursal) ──
export const stockApi = {
  listar: (params = {}) => {
    return api.get(`/stock${buildQuery(params)}`)
  },
  marcas: () => api.get('/stock/marcas'),
  ajustarManual: (varianteId, data) => api.put(`/stock/variante/${varianteId}/ajuste`, data),
  transferir: (data) => api.post('/stock/transferencia', data),
  listarTransferencias: (params = {}) => {
    return api.get(`/stock/transferencias${buildQuery(params)}`)
  },
}
export const sucursalesApi = {
  listar: () => api.get('/sucursales'),
  crear: (data) => api.post('/sucursales', data),
  actualizar: (id, data) => api.put(`/sucursales/${id}`, data),
  eliminar: (id) => api.delete(`/sucursales/${id}`),
  comparacion: (params = {}) => {
    return api.get(`/sucursales/comparacion${buildQuery(params)}`)
  },
  dashboard: (id, params = {}) => {
    return api.get(`/sucursales/${id}/dashboard${buildQuery(params)}`)
  },
}

// ── DEUDAS ──
export const deudasApi = {
  listar: (params = {}) => {
    return api.get(`/deudas${buildQuery(params)}`)
  },
  resumen: () => api.get('/deudas/resumen'),
  crear: (data) => api.post('/deudas', data),
  actualizar: (id, data) => api.put(`/deudas/${id}`, data),
  saldar: (id) => api.post(`/deudas/${id}/saldar`, {}),
  eliminar: (id) => api.delete(`/deudas/${id}`),
}

// ── RECORDATORIOS ──
export const recordatoriosApi = {
  listar: (params = {}) => {
    return api.get(`/recordatorios${buildQuery(params)}`)
  },
  crear: (data) => api.post('/recordatorios', data),
  actualizar: (id, data) => api.put(`/recordatorios/${id}`, data),
  completar: (id) => api.post(`/recordatorios/${id}/completar`, {}),
  eliminar: (id) => api.delete(`/recordatorios/${id}`),
}

// ── CATEGORÍAS PRODUCTO ──
export const categoriasProductoApi = {
  listar: () => api.get('/categorias-producto'),
  crear: (data) => api.post('/categorias-producto', data),
  actualizar: (id, data) => api.put(`/categorias-producto/${id}`, data),
  eliminar: (id) => api.delete(`/categorias-producto/${id}`),
}
