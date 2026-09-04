// Sideloading Central — Service Worker
// Strategy: cache-first for shell assets, network-only for repo JSON fetches.
// Bump CACHE_VERSION whenever you deploy updated shell files so stale caches
// are cleared automatically on the next visit.

const CACHE_VERSION = "v1";
const CACHE_NAME = `sideloading-central-${CACHE_VERSION}`;

// The shell assets we pre-cache on install. These are everything needed to
// render the page UI — repo data is always fetched live from the network.
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/sw.js",
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
];

// ---------------------------------------------------------------------------
// Install — pre-cache shell assets
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()), // activate immediately, don't wait for old SW to die
  );
});

// ---------------------------------------------------------------------------
// Activate — delete caches from old versions
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()), // take control of all open tabs immediately
  );
});

// ---------------------------------------------------------------------------
// Fetch — cache-first for same-origin shell, network-only for everything else
// (repo JSON, IPA downloads, external CDN resources).
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Network-only for cross-origin requests (repo JSON, IPA files, etc.)
  // We never want to cache third-party repo data — it must always be fresh.
  if (url.origin !== self.location.origin) return;

  // Network-only for browser-extension and non-http(s) schemes
  if (!url.protocol.startsWith("http")) return;

  // Cache-first for same-origin shell assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache the response
      return fetch(request)
        .then((response) => {
          // Only cache valid 200 responses for same-origin assets
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          const responseToCache = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, responseToCache));

          return response;
        })
        .catch(() => {
          // If offline and not cached, return the cached index.html as fallback
          // so the app shell still renders rather than showing a browser error.
          if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/index.html");
          }
        });
    }),
  );
});
