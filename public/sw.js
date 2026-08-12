const CACHE = 'felix-v3'
const PRECACHE = ['/offline.html']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Skip external requests and requests to other ports (e.g. Supabase on :8000)
  if (url.hostname !== self.location.hostname || url.port !== self.location.port) return

  // Static assets: cache-first
  if (url.pathname.match(/\.(png|jpg|svg|ico|woff2?|css|js)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached ?? fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      }))
    )
    return
  }

  // HTML pages: network-first, fallback to offline
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request) ?? caches.match('/offline.html'))
  )
})
