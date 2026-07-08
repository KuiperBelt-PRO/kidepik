/**
 * Paleta y utilidades de color para FX de fantasía.
 *
 * @module loader-fx-fantasy-palette
 */

export const FANTASY_PRIMARY = "#3ddb7e";
export const FANTASY_SECONDARY = "#f0c14a";
export const FANTASY_GLOW = "rgba(61, 219, 126, 0.62)";

/**
 * @param {() => number} rng
 * @param {number} [greenWeight=0.7]
 */
export function pickFantasySparkColor(rng, greenWeight = 0.7) {
  return rng() < greenWeight ? FANTASY_PRIMARY : FANTASY_SECONDARY;
}

/**
 * Pulso de opacidad para reflejos interiores (blanco puro).
 * @param {number} t segundos
 * @param {number} [min=0.22]
 * @param {number} [max=0.72]
 */
export function reflectionOpacityPulse(t, min = 0.18, max = 0.52, cycleHz = 0.38) {
  const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * cycleHz);
  return min + (max - min) * wave;
}

/** @deprecated usar reflectionOpacityPulse */
export function shimmerOpacityPulse(t, min = 0.35, max = 0.82) {
  return reflectionOpacityPulse(t, min, max);
}
