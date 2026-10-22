// Generado durante el build. Solo guarda archivos públicos de la interfaz.
const VERSION = /* VERSION */
const FILES = /* PRECACHE */
const SCOPE = self.registration.scope
const CACHE_PREFIX = `ab-control:${new URL(SCOPE).pathname}:`
const CACHE_NAME = CACHE_PREFIX + VERSION
const ASSETS = FILES.map(path => new URL(path, SCOPE).href)
const SHELL = new URL('index.html', SCOPE).href

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))))
  // Las actualizaciones esperan al cierre de las ventanas de la versión anterior.
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  const scope = new URL(SCOPE)
  if (request.method !== 'GET' || url.origin !== scope.origin) return
  const navigation = request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL(SHELL).pathname)
  if (navigation) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' })
        if (response.ok) return response
      } catch { /* Recuperar la versión completa guardada durante la instalación. */ }
      const cache = await caches.open(CACHE_NAME)
      return await cache.match(SHELL) || Response.error()
    })())
  } else if (ASSETS.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      return await cache.match(request) || fetch(request)
    })())
  }
  // Firebase, autenticación y otras peticiones no se interceptan ni se guardan.
})
