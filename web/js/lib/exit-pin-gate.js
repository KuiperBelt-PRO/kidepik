/**
 * Evita pedir PIN dos veces al pasar de Tripulación → play en la misma sesión.
 * @module exit-pin-gate
 */

const STORAGE_PREFIX = "crew-exit-pin-ok:";
const TTL_MS = 5 * 60 * 1000;

/**
 * @param {string} childId
 */
export function markExitPinVerified(childId) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${childId}`, String(Date.now()));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {string} childId
 * @returns {boolean}
 */
export function consumeExitPinVerified(childId) {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${childId}`);
    if (!raw) return false;
    sessionStorage.removeItem(`${STORAGE_PREFIX}${childId}`);
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < TTL_MS;
  } catch {
    return false;
  }
}
