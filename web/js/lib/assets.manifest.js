/**
 * Rutas de assets por slot. Sustituir ficheros en disco sin tocar escenas.
 * @type {Record<string, string>}
 */
export const ASSETS = {
  "loader.bg.dual": "/assets/shared/screens/loader-bg-dual.png",
  "loader.bg.plain": "/assets/shared/screens/loader-bg-plain.png",
  "loader.logo": "/assets/shared/logo/wordmark-ambigram-light.png",
  "loader.logo.alt": "/assets/shared/logo/wordmark-ambigram-dark.png",
  "loader.accent.fantasy": "/assets/themes/fantasy/screens/loader-runes-glow.webp",
  "loader.accent.space": "/assets/themes/spaceOpera/screens/loader-nebula-glow.webp",
  "loader.particles.fantasy": "/assets/themes/fantasy/lottie/fireflies.json",
  "loader.particles.space": "/assets/themes/spaceOpera/lottie/stars-drift.json",
  "loader.ring": "/assets/shared/ui/loader-ring-dual.webp",
};

/**
 * @param {string} slotId
 * @returns {string | undefined}
 */
export function assetUrl(slotId) {
  return ASSETS[slotId];
}
