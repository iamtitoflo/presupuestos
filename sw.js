// Bump this value on every release. A full versioned shell prevents an old
// HTML document from being paired with a stale ES module after deployment.
const CACHE_NAME = 'presupuestos-v6';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png',
  './icon-512.png', './icon-maskable-512.png', './vendor/jspdf.umd.min.js',
  './js/main.js', './js/actions.js', './js/state.js', './js/storage.js',
  './js/utils.js', './js/views.js', './js/pdf.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Network-first for the document and ES modules eliminates mixed releases.
  if (request.mode === 'navigate' || url.pathname.endsWith('.js')) {
    event.respondWith(fetch(request).then(response => {
      caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});
