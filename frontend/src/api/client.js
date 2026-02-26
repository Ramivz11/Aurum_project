const BASE_URL = import.meta.env.VITE_API_URL || '/api'
function buildUrl(path, params) {
  if (!params || Object.keys(params).length === 0) return `${BASE_URL}${path}`
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
  const qs = new URLSearchParams(filtered).toString()
  return `${BASE_URL}${path}${qs ? '?' + qs : ''}`
}

async function request(path, options = {}) {
  const { params, ...fetchOptions } = options
  const url = buildUrl(path, params)
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
    ...fetchOptions,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Error de red' }))
    throw new Error(error.detail || 'Error desconocido')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm: async (path, formData) => {
    const r = await fetch(`${BASE_URL}${path}`, { method: 'POST', body: formData })
    const data = await r.json().catch(() => ({ detail: 'Error de red' }))
    if (!r.ok) throw new Error(data.detail || `Error ${r.status}`)
    return data
  },
}