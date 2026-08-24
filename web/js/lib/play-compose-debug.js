/**
 * Chip de diagnóstico IA en play (solo debug + compose_failed).
 * @module play-compose-debug
 */

/**
 * @param {boolean} isDebugActive
 * @param {object | undefined | null} turn
 * @returns {boolean}
 */
export function shouldShowComposeDebugChip(isDebugActive, turn) {
  return Boolean(isDebugActive && turn?.meta?.compose_failed);
}

/**
 * @param {object | null | undefined} composeDebug
 * @returns {string}
 */
export function composeDebugChipLabel(composeDebug) {
  const purpose = typeof composeDebug?.purpose === "string" ? composeDebug.purpose : "";
  if (purpose === "path_composer") return "Ver diagnóstico del compose";
  return "Ver diagnóstico de la prueba";
}
