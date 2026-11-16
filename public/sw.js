const CACHE_NAME = 'kinostream-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/sports',
  '/live',
  '/movies',
  '/library',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache live stream proxies, HLS manifests/segments, or API endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.m4s')
  ) {
    return;
  }

  // Only handle same-origin shell & static assets
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for document navigations with offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const homeCached = await caches.match('/');
          if (homeCached) return homeCached;
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>KinoStream — Offline</title>
                <style>
                  body { margin: 0; background: #09090B; color: #FAFAFA; font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; text-align: center; padding: 24px; }
                  .card { max-width: 380px; padding: 32px; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; background: #121215; }
                  h1 { color: #D4AF37; font-size: 1.5rem; margin: 0 0 12px; letter-spacing: 0.08em; }
                  p { color: #A1A1AA; font-size: 0.95rem; line-height: 1.5; margin: 0 0 20px; }
                  button { background: #D4AF37; color: #09090B; border: 0; border-radius: 9999px; padding: 10px 24px; font-weight: 600; cursor: pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>KINOSTREAM</h1>
                  <p>You appear to be offline. Reconnect to resume live broadcasts and VOD streaming.</p>
                  <button onclick="window.location.reload()">Retry Connection</button>
                </div>
              </body>
            </html>`,
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // Stale-while-revalidate for static assets
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
