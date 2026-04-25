/* ══════════════════════════════════════════
   LeadRadar — Service Worker
   Versión: bump CACHE_NAME para forzar update
══════════════════════════════════════════ */
const CACHE_NAME = 'leadradar-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/favicon.png'
];

/* Install: precache de los assets básicos */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate: limpiar caches viejos + tomar control inmediato */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))
    ).then(() => self.clients.claim())
  );
});

/* Fetch:
   - HTML/index → NETWORK FIRST (siempre intenta traer la última versión)
     fallback a cache si no hay red
   - Resto (icons, fuentes externas) → CACHE FIRST con update en bg
*/
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // No interceptar peticiones a Firebase / APIs externas
  if (url.hostname.includes('firebaseio.com')
      || url.hostname.includes('googleapis.com')
      || url.hostname.includes('firestore.googleapis.com')
      || url.hostname.includes('identitytoolkit.googleapis.com')) {
    return; // dejar que pase de largo
  }

  // Network-first para HTML / navegación
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first para el resto
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
