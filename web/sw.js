const CACHE = "kidepik-web-v1";
const PRECACHE = [
  "/",
  "/index.html",
  "/css/tokens.css",
  "/css/layout.css",
  "/css/components.css",
  "/js/main.js",
  "/js/config.js",
  "/js/config.sample.js",
  "/js/lib/router.js",
  "/js/lib/theme.js",
  "/js/data/catalog.js",
  "/js/components/ui.js",
  "/js/scenes/loader.js",
  "/js/scenes/gallery.js",
  "/js/scenes/world-picker.js",
  "/js/scenes/mockup.js",
  "/js/scenes/poc.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && url.pathname.match(/\.(css|js|webp|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return response;
      });
    }),
  );
});
