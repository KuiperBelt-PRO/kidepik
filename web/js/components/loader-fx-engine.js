/**
 * Motor FX del loader: recetas deterministas y presupuesto de partículas.
 *
 * @module loader-fx-engine
 */

import { createRng } from "./loader-ship-rng.js";

/** @typedef {'fantasy' | 'spaceOpera'} FxRealm */
/** @typedef {'building' | 'holding' | 'eroding' | 'gone' | 'building_end'} FxPhase */

/**
 * @typedef {{
 *   id: string;
 *   kind: 'point' | 'segment' | 'path';
 *   x: number;
 *   y: number;
 *   x2?: number;
 *   y2?: number;
 *   path?: string;
 *   weight?: number;
 *   role?: string;
 *   phase?: number;
 * }} FxAnchor
 */

/**
 * @typedef {{
 *   type: 'sparkle' | 'mote' | 'edge_shimmer' | 'internal_reflection' | 'burst' | 'scatter';
 *   phase: FxPhase;
 *   intensity?: number;
 *   durationMs?: number;
 *   particleBudget?: number;
 * }} FxEffectSpec
 */

/**
 * @typedef {{
 *   id: string;
 *   realm: FxRealm;
 *   hostKind: string;
 *   effects: FxEffectSpec[];
 *   seed: number;
 *   anchors: FxAnchor[];
 *   intensity?: number;
 * }} FxRecipe
 */

export const MAX_PARTICLES_PER_HOST = 40;
export const MAX_PARTICLES_SCENE = 48;

/** @type {Record<string, (hostModel: object, seed: number, opts?: { intensity?: number }) => FxRecipe | null>} */
export const FX_RECIPE_BUILDERS = {};

let sceneParticleBudget = 0;

/** @returns {number} */
export function getSceneParticleBudget() {
  return sceneParticleBudget;
}

/** @param {number} delta */
export function adjustSceneParticleBudget(delta) {
  sceneParticleBudget = Math.max(0, Math.min(MAX_PARTICLES_SCENE, sceneParticleBudget + delta));
}

/** Reinicia contador global (tests). */
export function resetSceneParticleBudget() {
  sceneParticleBudget = 0;
}

/**
 * Suma de presupuestos de partículas en una receta.
 * @param {FxRecipe} recipe
 */
export function totalParticleBudget(recipe) {
  return recipe.effects.reduce((sum, fx) => sum + (fx.particleBudget ?? 0), 0);
}

/**
 * @param {FxRecipe} recipe
 */
export function isValidFxRecipe(recipe) {
  if (!recipe?.id || !recipe.hostKind || !Array.isArray(recipe.effects) || !Array.isArray(recipe.anchors)) {
    return false;
  }
  if (totalParticleBudget(recipe) > MAX_PARTICLES_PER_HOST) return false;
  const validPhases = new Set(["building", "holding", "eroding", "gone", "building_end"]);
  for (const fx of recipe.effects) {
    if (!validPhases.has(fx.phase)) return false;
  }
  return true;
}

/**
 * @param {string} hostKind
 * @param {object} hostModel
 * @param {{ seed: number; realm?: FxRealm; intensity?: number; fxProfile?: string }} options
 * @returns {FxRecipe | null}
 */
export function planFxRecipe(hostKind, hostModel, options) {
  const { seed, realm = "fantasy", intensity = 1, fxProfile } = options;
  if (fxProfile === "none") return null;

  const builder = FX_RECIPE_BUILDERS[hostKind];
  if (!builder) return null;

  const profileIntensity = fxProfile === "subtle" ? 0.55 : intensity;
  const recipe = builder(hostModel, seed, { intensity: profileIntensity, fxProfile });
  if (!recipe) return null;

  return {
    ...recipe,
    realm: recipe.realm ?? realm,
    intensity: profileIntensity,
  };
}

/**
 * Receta mínima de prueba (host block / tests FX-0).
 * @param {object} _hostModel
 * @param {number} seed
 * @returns {FxRecipe}
 */
export function planBlockTestFx(_hostModel, seed) {
  const rng = createRng(seed);
  return {
    id: `block-test-${seed}`,
    realm: "fantasy",
    hostKind: "block",
    seed,
    intensity: 1,
    anchors: [
      { id: "a0", kind: "point", x: 50, y: 40, role: "test" },
      { id: "a1", kind: "point", x: 55, y: 35, weight: 0.5, role: "test" },
    ],
    effects: [
      {
        type: "burst",
        phase: "building_end",
        particleBudget: 4,
        durationMs: 300,
        intensity: 0.5 + rng() * 0.2,
      },
    ],
  };
}

FX_RECIPE_BUILDERS.block = planBlockTestFx;
