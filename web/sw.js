const CACHE = "kidepik-web-v81";
const PRECACHE = [
  "/",
  "/index.html",
  "/css/tokens.css",
  "/css/layout.css",
  "/css/components.css",
  "/css/scenes/loader.css",
  "/js/main.js",
  "/js/config.js",
  "/js/config.sample.js",
  "/js/lib/router.js",
  "/js/lib/theme.js",
  "/js/lib/assets.manifest.js",
  "/js/components/loader-chrome.js",
  "/js/components/loader-fantasy-terrain.js",
  "/js/components/loader-meteor-shower.js",
  "/js/components/loader-space-orbit.js",
  "/js/components/loader-space-ships.js",
  "/js/components/loader-ship-procedural.js",
  "/js/components/loader-ship-rng.js",
  "/js/scenes/loader.js",
  "/assets/shared/screens/loader-bg-plain.png",
  "/assets/shared/logo/wordmark-ambigram-light.png",
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

  const isJs = url.pathname.startsWith("/js/");
  const isAssetImage =
    url.pathname.startsWith("/assets/") && url.pathname.match(/\.(png|webp|jpg|jpeg|svg)$/i);

  if (isJs || url.pathname.startsWith("/css/scenes/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  if (isAssetImage) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && url.pathname.match(/\.(css|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return response;
      });
    }),
  );
});
