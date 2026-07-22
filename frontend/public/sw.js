/* Service worker de Aurum: hace la app instalable con soporte offline.
   - Navegaciones: network-first con fallback al shell cacheado (la app
     abre igual sin conexión y muestra los datos que cada página pueda).
   - Assets estáticos (js/css/fuentes/imágenes): cache-first — los archivos
     de Vite van con hash en el nombre, así que nunca quedan viejos.
   - API (cualquier request no-GET u otro origen que no sea fuentes): se
     deja pasar directo a la red, nunca se cachea. */

const CACHE = 'aurum-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  const esMismoOrigen = url.origin === self.location.origin
  const esFuente = FONT_HOSTS.includes(url.hostname)
  if (!esMismoOrigen && !esFuente) return // API u otros orígenes: directo a red

  // Navegaciones: red primero, shell cacheado si no hay conexión
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copia))
          return res
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Assets estáticos y fuentes: cache-first
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req).then((res) => {
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copia))
        }
        return res
      })
    })
  )
})
