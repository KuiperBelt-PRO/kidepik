/**
 * Aplica layout de bandas al montar una escena de gestión, con animación si hay transición pendiente.
 * @module apply-world-band-transition
 */

import { shouldCompressWorldBands } from "./world-band-layout.js";
import {
  animateWorldBands,
  consumeWorldTransition,
  setWorldBandLayout,
} from "./world-transition.js";

/**
 * @param {HTMLElement} scene
 * @param {string} path
 * @returns {Promise<void>}
 */
export async function applyWorldBandTransitionOnMount(scene, path) {
  const targetCompressed = shouldCompressWorldBands(path);
  const { snapshot, intent } = consumeWorldTransition();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durationMs = reduced ? 0 : 720;

  if (intent?.bandTransition === true && typeof snapshot?.fromBandsCompressed === "boolean") {
    const fromCompressed = snapshot.fromBandsCompressed;
    setWorldBandLayout(scene, fromCompressed);
    if (fromCompressed === targetCompressed) {
      return;
    }
    // Forzar frame con layout origen antes de animar al destino.
    void scene.offsetWidth;
    await animateWorldBands(scene, targetCompressed, durationMs);
    return;
  }

  setWorldBandLayout(scene, targetCompressed);
}
