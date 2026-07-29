/** @typedef {(params: Record<string, string>) => void | Promise<void>} RouteHandler */

import { isWorldRouteHash } from "./world-session.js";
import { onShellPathChange, setShellNavNavigate } from "./shell-nav-stack.js";

/** @type {Map<string, RouteHandler>} */
const routes = new Map();

/**
 * @param {string} pattern e.g. legal/:slug
 * @param {RouteHandler} handler
 */
export function registerRoute(pattern, handler) {
  routes.set(pattern, handler);
}

/**
 * Ruta interna sin prefijo `#` ni query string (p. ej. `loader` desde `#/loader?foo=1`).
 * @param {string} [hash]
 * @returns {string}
 */
export function hashRoutePath(hash) {
  const raw =
    hash !== undefined
      ? hash
      : typeof window !== "undefined"
        ? window.location.hash
        : "#/loader";
  let path = (raw || "#/loader").replace(/^#\/?/, "") || "loader";
  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  return path || "loader";
}

function matchRoute(hash) {
  const path = hashRoutePath(hash);
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

setShellNavNavigate(navigate);

/** @typedef {{ worldHandoff?: boolean }} RouteTeardownOptions */

/** @type {(() => void) | ((options?: RouteTeardownOptions) => void) | null} */
let routeTeardown = null;

/** @type {string} */
let lastRoutePath =
  typeof window !== "undefined" ? hashRoutePath() : "loader";

export function startRouter() {
  const run = () => {
    const nextPath = hashRoutePath();
    const fromPath = lastRoutePath;
    const worldHandoff =
      isWorldRouteHash(`#/${fromPath}`) && isWorldRouteHash(`#/${nextPath}`);

    if (routeTeardown) {
      routeTeardown({ worldHandoff });
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

    lastRoutePath = nextPath;
    onShellPathChange(fromPath, nextPath);
  };
  window.addEventListener("hashchange", run);
  run();
}
