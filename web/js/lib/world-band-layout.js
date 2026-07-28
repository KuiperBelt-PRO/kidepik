/**
 * Layout de bandas del mundo según ruta de gestión.
 * @module world-band-layout
 */

/**
 * @param {string} [path]
 * @returns {string}
 */
export function normalizeShellPath(path = "") {
  return String(path).replace(/^#\/?/, "").replace(/^\//, "").split("?")[0] || "";
}

/**
 * Home = expandido; resto de rutas shell de gestión = compacto.
 * @param {string} [path]
 * @returns {boolean}
 */
export function shouldCompressWorldBands(path = "") {
  const normalized = normalizeShellPath(path);
  if (normalized === "" || normalized === "home") return false;
  if (normalized === "account") return true;
  if (normalized.startsWith("legal/")) return true;
  if (
    normalized === "crew" ||
    normalized.startsWith("crew/") ||
    normalized === "settings" ||
    normalized === "family"
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} fromPath
 * @param {string} toPath
 * @returns {boolean}
 */
export function worldBandsNeedTransition(fromPath, toPath) {
  return shouldCompressWorldBands(fromPath) !== shouldCompressWorldBands(toPath);
}
