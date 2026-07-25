/**
 * Rutas de assets por slot. Sustituir ficheros en disco sin tocar escenas.
 * @type {Record<string, string>}
 */
export const ASSETS = {
  "loader.bg.plain": "/assets/shared/screens/loader-bg-plain.png",
  "loader.logo": "/assets/shared/logo/wordmark-ambigram-light.png",
};

/**
 * @param {string} slotId
 * @returns {string | undefined}
 */
export function assetUrl(slotId) {
  return ASSETS[slotId];
}
