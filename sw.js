const CACHE_VERSION = 'v16';
const CACHE_NAME = `crud-cache-${CACHE_VERSION}`;
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './portal-cliente.html',
  './admin-junta.html',
  './padron.html',
  './auth.js',
  './main.js',
  './storage.js',
  './validaciones.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(n => Promise.all(n.map(x => {
    if (x !== CACHE_NAME) return caches.delete(x);
  }))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});