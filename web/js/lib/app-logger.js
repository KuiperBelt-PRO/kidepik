/**
 * Cliente web → disco vía POST /api/v1/client/logs (canal `client` en web/logs/).
 * @module app-logger
 */

import { getValidSession } from "./supabase.js";
import { isDebugAiClientActive } from "./debug-ai.js";

/** @type {boolean} */
let enabled = false;

/** @type {string} */
let minLevel = "info";

/** @type {Array<{ level: string, message: string, context: Record<string, unknown>, client_ts: string }>} */
let queue = [];

/** @type {ReturnType<typeof setInterval> | null} */
let flushTimer = null;

const LEVEL_RANK = {
  debug: 10,
  info: 20,
  notice: 30,
  warning: 40,
  error: 50,
};

const SENSITIVE_KEYS = new Set([
  "authorization",
  "token",
  "access_token",
  "api_key",
  "password",
  "secret",
]);

/**
 * Inicializa desde architecture/config y engancha errores globales.
 */
export async function initAppLogger() {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/architecture/config`);
    if (res.ok) {
      const data = await res.json();
      enabled = data.client_logging === true;
      minLevel = normalizeLevel(data.client_log_level || "info");
    }
  } catch {
    enabled = false;
  }

  if (!enabled) return;

  window.addEventListener("error", (event) => {
    appLog("error", "window_error", {
      message: truncate(String(event.message || "error"), 300),
      source: event.filename || null,
      line: event.lineno || null,
      col: event.colno || null,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const detail =
      reason instanceof Error
        ? truncate(reason.message, 300)
        : truncate(String(reason), 300);
    appLog("error", "unhandled_rejection", { detail });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush(true);
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!shouldLog("debug")) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest("button, a, [role='button']");
      if (!el) return;
      appLog("debug", "ui_click", {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        name: el.getAttribute("data-action") || el.getAttribute("aria-label") || null,
        route: hashRoute(),
      });
    },
    true,
  );

  flushTimer = setInterval(() => flush(false), 2000);
}

/**
 * @param {string} level
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 */
export function appLog(level, message, context = {}) {
  if (!enabled) return;

  const normalized = normalizeLevel(level);
  if (!shouldLog(normalized)) return;

  queue.push({
    level: normalized,
    message: truncate(message, 200),
    context: sanitizeContext(context),
    client_ts: new Date().toISOString(),
  });

  if (queue.length >= 20) {
    flush(false);
  }
}

/**
 * @param {string} from
 * @param {string} to
 * @param {Record<string, unknown>} [extra]
 */
export function appLogRoute(from, to, extra = {}) {
  appLog("info", "route_change", { from, to, ...extra });
}

/**
 * @param {string} api
 * @param {number} status
 * @param {Record<string, unknown>} [extra]
 */
export function appLogApi(api, status, extra = {}) {
  const level = status >= 500 ? "error" : status >= 400 ? "warning" : "info";
  appLog(level, "api_call", { api, status, ...extra });
}

/**
 * @param {boolean} [useBeacon]
 */
export async function flush(useBeacon = false) {
  if (!enabled || queue.length === 0) return;

  const batch = queue.splice(0, 50);
  const body = JSON.stringify({ events: batch });

  try {
    const { config } = await import("../config.js");
    const url = `${config.apiUrl}/client/logs`;
    const session = await getValidSession();
    const headers = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    if (useBeacon && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) {
        return;
      }
    }

    await fetch(url, { method: "POST", headers, body, keepalive: useBeacon });
  } catch {
    queue.unshift(...batch);
    if (queue.length > 100) {
      queue = queue.slice(-100);
    }
  }
}

function shouldLog(level) {
  const min = isDebugAiClientActive() ? "debug" : minLevel;
  return (LEVEL_RANK[level] ?? 0) >= (LEVEL_RANK[min] ?? 20);
}

function normalizeLevel(level) {
  const l = String(level || "info").toLowerCase();
  return l in LEVEL_RANK ? l : "info";
}

function hashRoute() {
  const hash = window.location.hash || "#/loader";
  return hash.replace(/^#\/?/, "").split("?")[0] || "loader";
}

/**
 * @param {Record<string, unknown>} context
 * @returns {Record<string, unknown>}
 */
function sanitizeContext(context) {
  const out = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      out[key] = truncate(value, 500);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}
