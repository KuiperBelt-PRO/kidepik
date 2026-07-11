/**
 * Secuencia de revelado del loader: fondo → logo → anillo → fantasía → espacio.
 *
 * @module loader-reveal-sequence
 */

/** @typedef {'bg' | 'logo' | 'ring' | 'fantasy' | 'space'} LoaderRevealStage */

/** Orden canónico de aparición en pantalla. */
export const LOADER_REVEAL_ORDER = /** @type {const} */ ([
  "bg",
  "logo",
  "ring",
  "fantasy",
  "space",
]);

/** Retrasos por defecto entre el arranque y cada etapa (ms). */
export const LOADER_REVEAL_DELAYS_MS = {
  bg: 0,
  logo: 420,
  ring: 880,
  fantasy: 1360,
  space: 1920,
};

/**
 * @param {boolean} [reducedMotion]
 * @returns {Record<LoaderRevealStage, number>}
 */
export function resolveLoaderRevealDelays(reducedMotion = false) {
  if (reducedMotion) {
    return {
      bg: 0,
      logo: 0,
      ring: 0,
      fantasy: 0,
      space: 0,
    };
  }
  return { ...LOADER_REVEAL_DELAYS_MS };
}

/**
 * @param {HTMLElement} scene
 * @param {string} stage
 */
function applyRevealStageClass(scene, stage) {
  scene.classList.add(`is-reveal-${stage}`);
}

/**
 * Programa las clases `is-reveal-*` sobre `.scene-loader`.
 *
 * @param {HTMLElement} scene
 * @param {{
 *   reducedMotion?: boolean;
 *   delays?: Partial<Record<LoaderRevealStage, number>>;
 *   onStage?: (stage: LoaderRevealStage, scene: HTMLElement) => void;
 * }} [options]
 * @returns {{ destroy: () => void; delays: Record<LoaderRevealStage, number> }}
 */
export function startLoaderRevealSequence(scene, { reducedMotion = false, delays, onStage } = {}) {
  const schedule = { ...resolveLoaderRevealDelays(reducedMotion), ...delays };
  /** @type {ReturnType<typeof setTimeout>[]} */
  const timers = [];

  for (const stage of LOADER_REVEAL_ORDER) {
    const delay = schedule[stage] ?? 0;
    timers.push(
      setTimeout(() => {
        applyRevealStageClass(scene, stage);
        onStage?.(stage, scene);
      }, delay),
    );
  }

  return {
    delays: schedule,
    destroy() {
      for (const timer of timers) clearTimeout(timer);
    },
  };
}
