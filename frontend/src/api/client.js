// En dev, por defecto apuntamos al backend local para no pegarle a producción
// sin querer. En build de producción se usa VITE_API_URL (o el fallback remoto).
export const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:8000'
    : 'https://vivacious-truth-production-b827.up.railway.app')

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Error de red' }))
    // FastAPI devuelve detail como array en errores de validación (422)
    let mensaje = 'Error desconocido'
    if (typeof error.detail === 'string') {
      mensaje = error.detail
    } else if (Array.isArray(error.detail)) {
      mensaje = error.detail.map(e => e.msg || JSON.stringify(e)).join(', ')
    }
    throw new Error(mensaje)
  }
  if (res.status === 204) return null
  const data = await res.json()
  return { data }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm: async (path, formData) => {
    const r = await fetch(`${BASE_URL}${path}`, { method: 'POST', body: formData })
    const data = await r.json().catch(() => ({ detail: 'Error de red' }))
    if (!r.ok) {
      // FastAPI devuelve detail como array en errores de validación (422)
      let mensaje = `Error ${r.status}`
      if (typeof data.detail === 'string') {
        mensaje = data.detail
      } else if (Array.isArray(data.detail)) {
        mensaje = data.detail.map(e => e.msg || JSON.stringify(e)).join(', ')
      }
      throw new Error(mensaje)
    }
    // Misma forma que get/post/put: { data }
    return { data }
  },

}
