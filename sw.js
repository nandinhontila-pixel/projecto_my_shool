/**
 * ═══════════════════════════════════════════════════════
 *  NTILA ESTUDOS — Service Worker v2.0
 *  PWA: cache offline, actualizações em background
 * ═══════════════════════════════════════════════════════
 */

const CACHE_NAME    = 'ntila-v2';
const OFFLINE_PAGE  = '/index.html';

// Recursos para pre-cache no install
const PRECACHE = [
  '/index.html',
  '/admin_painel.html',
  '/db.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// ── Install: pre-cachear recursos essenciais ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE.map(url => new Request(url, { mode: 'no-cors' })))
        .catch(err => console.warn('[SW] Pre-cache parcial:', err));
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: limpar caches antigas ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
  console.log('[SW] Activado. Cache:', CACHE_NAME);
});

// ── Fetch: estratégia Network First para HTML/API, Cache First para assets ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar requests Firebase, APIs externas e extensões de browser
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('ipify.org') ||
    url.protocol === 'chrome-extension:' ||
    event.request.method !== 'GET'
  ) return;

  // HTML → Network First (conteúdo sempre fresco)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match(OFFLINE_PAGE)))
    );
    return;
  }

  // Fontes e imagens → Cache First (rápido, longa duração)
  if (
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    /\.(png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Tudo o resto → Stale While Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          cache.put(event.request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});

// ── Push Notifications (preparado para o futuro) ──
self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'Ntila Estudos', body: 'Nova actualização disponível!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});

console.log('[SW] Ntila Service Worker carregado.');
