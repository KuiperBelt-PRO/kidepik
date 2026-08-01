/**
 * Modo debug IA (solo local / APP_DEBUG_AI).
 * @module debug-ai
 */

const STORAGE_KEY = "kidepik.debug.ai";

/** @type {boolean | null} */
let serverAllowed = null;

/**
 * Persiste ?debugAi=1 en sessionStorage.
 */
export function initDebugAiFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debugAi") === "1") {
      sessionStorage.setItem(STORAGE_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

export function isDebugAiClientActive() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * @param {boolean} active
 */
export function setDebugAiClientActive(active) {
  try {
    if (active) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {boolean} allowed
 */
export function setDebugAiServerAllowed(allowed) {
  serverAllowed = allowed;
}

export function isDebugAiAllowed() {
  return serverAllowed === true && isDebugAiClientActive();
}

/**
 * @returns {Record<string, string>}
 */
export function debugAiRequestHeaders() {
  if (!isDebugAiClientActive()) return {};

  return { "X-Kidepik-Debug-Ai": "1" };
}
