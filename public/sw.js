/*
 * Service worker.
 *
 * Two jobs:
 *   1. Make the app installable, so a child can keep it on her home screen and
 *      open it like any other app on the iPad.
 *   2. Make it open with no network. The project itself already lives in
 *      IndexedDB, so once the shell is cached a dropped connection means she
 *      carries on working and syncs when it comes back.
 *
 * Strategy:
 *   - Navigations: network first, falling back to the cached shell. A lesson
 *     should always prefer fresh HTML, but must never show a browser error.
 *   - Built assets (/_next/static, icons): cache first. They are content
 *     hashed, so a cached copy is never stale.
 *   - Everything else, including the sync socket: straight to the network.
 */

const VERSION = 'mathblocks-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

/** Enough to boot the join screen with no connection at all. */
const PRECACHE = [
  '/',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        // One bad URL must not fail the whole install, so they are added
        // individually and failures are tolerated.
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never touch other origins, and never touch the realtime channel.
  if (url.origin !== self.location.origin) return;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // The lesson route is dynamic, so a first-ever offline visit to a
          // room will not be cached. Fall back to the shell, which can still
          // open the project from IndexedDB.
          return (
            (await caches.match('/')) ||
            (await caches.match('/offline')) ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          );
        }),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
