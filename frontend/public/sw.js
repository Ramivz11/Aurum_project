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
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

/* Vite emite nombres con hash: cada deploy agrega archivos nuevos sin invalidar
   los viejos, así que el caché crecería indefinidamente en el teléfono.
   No se puede purgar comparando contra el index: ahí solo figuran el chunk de
   entrada y el CSS — los chunks de cada ruta se cargan por import() dinámico y
   se borrarían aun estando vigentes, rompiendo el offline de esas pantallas.
   En cambio se usa el hash del script de entrada como identificador de build:
   cuando cambia, todo lo cacheado pertenece al deploy anterior y se descarta
   de una vez. Tampoco sirve hacerlo en 'activate', que solo se dispara si
   cambia este mismo archivo. */
const BUILD_KEY = '/__build_id__'
let purgando = false

async function purgarSiCambioElBuild(html) {
  if (purgando) return
  purgando = true
  try {
    const entrada = (html.match(/\/assets\/index-[A-Za-z0-9._-]+\.js/) || [])[0]
    if (!entrada) return

    const c = await caches.open(CACHE)
    const previo = await c.match(BUILD_KEY)
    const idPrevio = previo ? await previo.text() : null
    if (idPrevio === entrada) return

    if (idPrevio) {
      for (const req of await c.keys()) {
        const { pathname, origin } = new URL(req.url)
        if (origin === self.location.origin && pathname.startsWith('/assets/')) await c.delete(req)
      }
    }
    await c.put(BUILD_KEY, new Response(entrada))
  } catch {
    // Un fallo de purga no debe afectar la navegación.
  } finally {
    purgando = false
  }
}

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
          const paraCache = res.clone()
          const paraPurga = res.clone()
          e.waitUntil((async () => {
            const c = await caches.open(CACHE)
            await c.put('/', paraCache)
            await purgarSiCambioElBuild(await paraPurga.text())
          })())
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
          e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copia)))
        }
        return res
      })
    })
  )
})
