/*
 * Keeps the app itself available offline. Supabase calls are not touched: the app queues changes in
 * localStorage and sends them when it can.
 *
 * - The page (navigations): network first so a new deploy shows up, the cached copy when offline.
 * - Everything else from this site (hashed JS/CSS, icons): cache first, since those files never change.
 */
const CACHE = 'baby-tracker-v1'
const PAGE = './'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([PAGE, './manifest.webmanifest', './favicon.svg'])))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/** The page that registered us lists the files it already loaded, so they're cached from the first visit. */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'cache' && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(event.data.urls)))
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(PAGE, copy))
          return response
        })
        .catch(() => caches.match(PAGE, { ignoreVary: true })),
    )
    return
  }

  // ignoreVary: module scripts are requested with an Origin header the cached copy was stored without.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
