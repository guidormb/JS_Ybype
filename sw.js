const CACHE_VERSION = 'v81';
const CACHE_NAME = `jsybype-cache-${CACHE_VERSION}`;

const urlsToCache = [
  './',
  './index.html',
  './portal-cliente.html',
  './admin-junta.html',
  './padron.html',
  './proveedores.html',
  './cierre.html',
  './main.js',
  './admin-config.js',
  './admin-utils.js',
  './admin-auth.js',
  './admin-socios.js',
  './admin-cobros.js',
  './admin-gastos.js',
  './admin-cuotas-reportes.js',
  './admin-proveedores.js',
  './admin-init.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo interceptar peticiones GET del mismo origen
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Sin conexión', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});