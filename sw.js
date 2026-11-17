const CACHE_VERSION = 'v11'; // <-- CADA VEZ que subas a Vercel, cambiá este número a v6, v7, etc.
const CACHE_NAME = `crud-cache-${CACHE_VERSION}`;

// Archivos a guardar
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './style.css',
  './app.js',
  './auth.js'
];

self.addEventListener('install', event => {
  // Forzar que el nuevo SW tome control al instante
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  // Borrar TODOS los caches viejos automáticamente
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando cache vieja:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Para html y css siempre ir a la red primero, no usar cache vieja
  if (event.request.url.includes('.html') || event.request.url.includes('.css')) {
    event.respondWith(
      fetch(event.request)
      .then(response => {
        return response;
      })
      .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});