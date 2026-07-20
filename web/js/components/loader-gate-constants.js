/**
 * Constantes compartidas del gate loader → auth.
 * @module loader-gate-constants
 */

export const GATE_HINT_DELAY_MS = 5000;
export const GATE_HINT_DELAY_REDUCED_MS = 1000;
export const GATE_HINT_DELAY_DEMO_MS = 200;
export const GATE_MORPH_MS = 800;
export const GATE_MORPH_REDUCED_MS = 150;

export const GATE_COPY = {
  hintSci: "PULSA PARA COMENZAR",
  hintFantasy: "TU VIAJE ÉPICO",
  aria: "Pulsa para comenzar tu viaje épico",
  sloganLine1: "DOS MUNDOS.",
  sloganLine2: "UN VIAJE ÉPICO.",
};

/**
 * @param {boolean} [reducedMotion]
 * @param {{ demo?: boolean; overrideMs?: number }} [options]
 * @returns {number}
 */
export function resolveGateHintDelay(reducedMotion = false, options = {}) {
  if (options.overrideMs != null && Number.isFinite(options.overrideMs)) {
    return Math.max(0, options.overrideMs);
  }
  if (options.demo) return GATE_HINT_DELAY_DEMO_MS;
  return reducedMotion ? GATE_HINT_DELAY_REDUCED_MS : GATE_HINT_DELAY_MS;
}

/**
 * @param {boolean} [reducedMotion]
 * @returns {number}
 */
export function resolveGateMorphDuration(reducedMotion = false) {
  return reducedMotion ? GATE_MORPH_REDUCED_MS : GATE_MORPH_MS;
}

/**
 * @param {unknown} session
 * @returns {boolean}
 */
export function isSessionValid(session) {
  if (!session || typeof session !== "object") return false;
  const token = /** @type {{ access_token?: unknown }} */ (session).access_token;
  return typeof token === "string" && token.length > 0;
}
