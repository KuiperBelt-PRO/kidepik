/** @typedef {(params: Record<string, string>) => void | Promise<void>} RouteHandler */

/** @type {Map<string, RouteHandler>} */
const routes = new Map();

/**
 * @param {string} pattern e.g. /mockup/:id
 * @param {RouteHandler} handler
 */
export function registerRoute(pattern, handler) {
  routes.set(pattern, handler);
}

function matchRoute(hash) {
  const path = hash.replace(/^#\/?/, "") || "loader";
  for (const [pattern, handler] of routes) {
    const patternParts = pattern.split("/");
    const pathParts = path.split("/");
    if (patternParts.length !== pathParts.length) continue;
    /** @type {Record<string, string>} */
    const params = {};
    let ok = true;
    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i];
      const pv = pathParts[i];
      if (pp.startsWith(":")) {
        params[pp.slice(1)] = decodeURIComponent(pv);
      } else if (pp !== pv) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler, params };
  }
  return null;
}

export function navigate(path) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}

/** @type {(() => void) | null} */
let routeTeardown = null;

export function startRouter() {
  const run = () => {
    if (routeTeardown) {
      routeTeardown();
      routeTeardown = null;
    }

    const hash = window.location.hash || "#/loader";
    const match = matchRoute(hash);
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = "";
    if (match) {
      const out = match.handler(match.params);
      if (out && typeof out.destroy === "function") {
        routeTeardown = out.destroy;
      }
    } else {
      navigate("/loader");
    }
  };
  window.addEventListener("hashchange", run);
  run();
}
