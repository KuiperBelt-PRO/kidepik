/**
 * Modo debug IA (setting de cuenta + operadores allowlist en servidor).
 * @module debug-ai
 */

/** @type {boolean} */
let operatorEligible = false;
/** @type {boolean} */
let debugEnabled = false;

/**
 * @typedef {object} DebugCapabilities
 * @property {boolean} [operator_eligible]
 * @property {boolean} [debug_enabled]
 * @property {boolean} [debug_allowed]
 */

/**
 * @param {DebugCapabilities | null | undefined} capabilities
 */
export function syncDebugAiCapabilities(capabilities) {
  if (!capabilities || typeof capabilities !== "object") return;
  if (typeof capabilities.operator_eligible === "boolean") {
    operatorEligible = capabilities.operator_eligible;
  }
  if (typeof capabilities.debug_enabled === "boolean") {
    debugEnabled = capabilities.debug_enabled;
  }
}

/**
 * @param {import('./parent-settings.js').ParentSettings | null | undefined} settings
 * @param {DebugCapabilities | null | undefined} [capabilities]
 */
export function syncDebugAiFromParentSettings(settings, capabilities) {
  if (capabilities) syncDebugAiCapabilities(capabilities);
  const diagnostics = settings?.diagnostics;
  if (diagnostics && typeof diagnostics.debug_ai_enabled === "boolean") {
    debugEnabled = operatorEligible && diagnostics.debug_ai_enabled;
  }
}

/**
 * @deprecated Conservado por compat; ya no usa sessionStorage.
 */
export function initDebugAiFromUrl() {
  /* noop: el modo debug vive en parent settings */
}

export function isDebugAiOperatorEligible() {
  return operatorEligible;
}

export function isDebugAiClientActive() {
  return operatorEligible && debugEnabled;
}

/**
 * Actualiza solo el estado en memoria; persistir vía PATCH settings.
 * @param {boolean} active
 */
export function setDebugAiClientActive(active) {
  debugEnabled = Boolean(active) && operatorEligible;
}

/**
 * @param {boolean} allowed
 * @deprecated Usar syncDebugAiCapabilities.
 */
export function setDebugAiServerAllowed(allowed) {
  operatorEligible = allowed === true;
}

export function isDebugAiAllowed() {
  return operatorEligible && debugEnabled;
}

/**
 * @returns {Record<string, string>}
 */
export function debugAiRequestHeaders() {
  if (!isDebugAiAllowed()) return {};

  return { "X-Kidepik-Debug-Ai": "1" };
}
