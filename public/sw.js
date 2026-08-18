// Bump this version on any change you want to force out to all devices.
const CACHE_NAME = 'camkids-pwa-v3';

self.addEventListener('install', () => {
  // Activate the new service worker immediately, don't wait for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop any old caches from previous versions.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Page navigations (the HTML shell) must ALWAYS come fresh from the network so a
  // new deploy is picked up immediately — never a stale index.html that points at
  // old bundles. Fall back to cache only when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }
  // Everything else: network-first, cache as offline fallback.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
