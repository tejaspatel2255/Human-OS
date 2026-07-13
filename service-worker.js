const CACHE_VERSION = "humanos-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CONTENT_CACHE = `${CACHE_VERSION}-content`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/config.js",
  "/assets/css/app.css",
  "/assets/js/app.js",
  "/assets/js/ai.js",
  "/assets/js/search.js",
  "/assets/js/i18n.js",
  "/assets/js/db.js",
  "/assets/js/analytics.js",
  "/assets/js/stats-widget.js",
  "/assets/icons/logo.png",
  "https://cdnjs.cloudflare.com/ajax/libs/lunr.js/2.3.9/lunr.min.js"
];

const isOpenRouterRequest = (requestUrl) => requestUrl.hostname.includes("openrouter.ai");
const isAnalyticsRequest = (requestUrl) =>
  requestUrl.hostname.includes("umami") || requestUrl.hostname.includes("goatcounter");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

async function cacheFirstWithUpdate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cachedResponse || networkFetch;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);

  if (isOpenRouterRequest(requestUrl) || isAnalyticsRequest(requestUrl)) {
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 204 })));
    return;
  }

  if (requestUrl.pathname.includes("/content/")) {
    event.respondWith(cacheFirstWithUpdate(request, CONTENT_CACHE));
    return;
  }

  if (
    requestUrl.origin === self.location.origin ||
    requestUrl.hostname.includes("cdnjs.cloudflare.com")
  ) {
    event.respondWith(cacheFirstWithUpdate(request, STATIC_CACHE));
  }
});

self.addEventListener("message", (event) => {
  const { data } = event;
  if (!data || typeof data !== "object") return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => {
        if (event.source) {
          event.source.postMessage("CACHE_CLEARED");
        }
      })
    );
    return;
  }

  if (data.type === "DOWNLOAD_ALL" && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CONTENT_CACHE);
      let cached = 0;
      const total = data.urls.length;

      for (const url of data.urls) {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (response && response.ok) {
            await cache.put(url, response.clone());
          }
        } catch (error) {
          // Fail silently so downloads continue offline-friendly.
        }
        cached += 1;
        if (event.source) {
          event.source.postMessage({ cached, total });
        } else {
          const clients = await self.clients.matchAll({ type: "window" });
          clients.forEach(client => client.postMessage({ cached, total }));
        }
      }
    })());
  }
});
