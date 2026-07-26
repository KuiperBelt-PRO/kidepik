const CACHE = "kidepik-web-v175";
const PRECACHE = [
  "/",
  "/index.html",
  "/css/tokens.css",
  "/css/layout.css",
  "/css/components.css",
  "/css/components/app-shell.css",
  "/css/scenes/loader.css",
  "/css/scenes/auth.css",
  "/css/scenes/legal.css",
  "/js/main.js",
  "/js/config.js",
  "/js/config.sample.js",
  "/js/lib/router.js",
  "/js/lib/theme.js",
  "/js/lib/shell-theme.js",
  "/js/lib/shell-frame.js",
  "/js/lib/markdown.js",
  "/js/lib/world-session.js",
  "/js/lib/world-transition.js",
  "/js/lib/assets.manifest.js",
  "/js/lib/supabase.js",
  "/js/components/loader-chrome.js",
  "/js/components/loader-world-utils.js",
  "/js/components/world-layers.js",
  "/js/components/loader-space-layout.js",
  "/js/components/loader-gate.js",
  "/js/components/loader-gate-constants.js",
  "/js/components/loader-auth-morph.js",
  "/js/components/auth-panel.js",
  "/js/components/app-shell.js",
  "/js/components/shell-ui-icons.js",
  "/js/components/home-welcome-panel.js",
  "/js/scenes/loader.js",
  "/js/components/loader-world-arrows.js",
  "/js/scenes/legal.js",
  "/js/scenes/auth-callback.js",
  "/js/scenes/home.js",
  "/js/scenes/account.js",
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

  // API: siempre red (evita latencia/fallos del handler genérico del SW).
  if (url.pathname.startsWith("/api/")) return;

  const isJs = url.pathname.startsWith("/js/");
  const isCss = url.pathname.startsWith("/css/");
  const isHtml =
    url.pathname === "/" ||
    url.pathname.endsWith(".html") ||
    (request.headers.get("accept") || "").includes("text/html");
  const isAssetImage =
    url.pathname.startsWith("/assets/") && url.pathname.match(/\.(png|webp|jpg|jpeg|svg)$/i);

  if (isHtml || isJs || isCss) {
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
