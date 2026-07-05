/**
 * Generador de bosques (conjunto de árboles tronco + copa).
 *
 * @module loader-fantasy-forest
 */

import { ElementAssembler } from "./loader-fantasy-element.js";
import { sampleTerrainCrestYNorm } from "./loader-fantasy-terrain.js";
import { generateTree, TREE_SPECIES_POOL } from "./loader-fantasy-trees.js";
import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {'compact' | 'extensive'} ForestExtent */
/** @typedef {import('./loader-fantasy-trees.js').TreeSpecies} TreeSpecies */
/** @typedef {import('./loader-fantasy-terrain.js').TerrainProfile} TerrainProfile */

const EXTENT_CONFIG = {
  compact: { treeMin: 14, treeMax: 20, spanMin: 48, spanMax: 68 },
  extensive: { treeMin: 26, treeMax: 38, spanMin: 78, spanMax: 96 },
};

/**
 * @param {number} seed
 * @returns {ForestExtent}
 */
export function planForestExtent(seed) {
  const rng = createRng(seed >>> 0);
  return rng() < 0.45 ? "compact" : "extensive";
}

/**
 * @param {number} seed
 * @returns {TreeSpecies[]}
 */
export function planForestSpeciesMix(seed) {
  const rng = createRng((seed ^ 0x8b3f1a2c) >>> 0);
  let count = Math.min(TREE_SPECIES_POOL.length, 1 + Math.floor(rng() * 5));
  if (count === 1 && TREE_SPECIES_POOL.length > 1 && rng() < 0.78) {
    count = Math.min(TREE_SPECIES_POOL.length, 2 + Math.floor(rng() * 3));
  }
  /** @type {TreeSpecies[]} */
  const pool = [...TREE_SPECIES_POOL];
  /** @type {TreeSpecies[]} */
  const mix = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(rng() * pool.length);
    mix.push(/** @type {TreeSpecies} */ (pool.splice(idx, 1)[0]));
  }
  return mix;
}

/**
 * Posiciones horizontales de árboles con separación mínima para conservar siluetas.
 * @param {() => number} rng
 * @param {number} treeCount
 * @param {number} layoutWidth
 * @returns {number[]}
 */
export function planForestTreePositions(rng, treeCount, layoutWidth) {
  const minGap = layoutWidth * randRange(rng, 0.024, 0.042);
  const xMin = layoutWidth * 0.05;
  const xMax = layoutWidth * 0.95;
  /** @type {number[]} */
  const positions = [];

  for (let i = 0; i < treeCount; i += 1) {
    let cx = randRange(rng, xMin, xMax);
    let attempts = 0;
    while (attempts < 16 && positions.some((p) => Math.abs(p - cx) < minGap)) {
      cx = randRange(rng, xMin, xMax);
      attempts += 1;
    }
    positions.push(cx);
  }

  return positions.sort((a, b) => a - b);
}

/**
 * Asigna especie a cada árbol del bosque (mezcla equilibrada y orden barajado).
 * @param {TreeSpecies[]} speciesMix
 * @param {number} treeCount
 * @param {number} seed
 * @returns {TreeSpecies[]}
 */
export function assignForestTreeSpecies(speciesMix, treeCount, seed) {
  if (!speciesMix.length || treeCount <= 0) return [];
  const rng = createRng((seed ^ 0x5d1a9c33) >>> 0);
  /** @type {TreeSpecies[]} */
  const assigned = [];
  const shuffledMix = [...speciesMix];
  for (let i = shuffledMix.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffledMix[i];
    shuffledMix[i] = shuffledMix[j];
    shuffledMix[j] = tmp;
  }
  const guaranteed = Math.min(treeCount, shuffledMix.length);
  for (let i = 0; i < guaranteed; i += 1) {
    assigned.push(shuffledMix[i]);
  }
  for (let i = assigned.length; i < treeCount; i += 1) {
    assigned.push(speciesMix[Math.floor(rng() * speciesMix.length)]);
  }
  for (let i = assigned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = assigned[i];
    assigned[i] = assigned[j];
    assigned[j] = tmp;
  }
  return assigned;
}

/**
 * Ajusta baseY (y-up) según la pendiente del perfil de terreno.
 * @param {number} baseY
 * @param {number} cx
 * @param {number} layoutWidth
 * @param {TerrainProfile | undefined} profile
 * @param {number} centerXNorm
 * @returns {number}
 */
export function terrainAdjustedBaseY(baseY, cx, layoutWidth, profile, centerXNorm) {
  if (!profile?.length || layoutWidth <= 0) return baseY;
  const half = layoutWidth / 2;
  const rel = (cx - half) / (layoutWidth * 1.8);
  const xNorm = Math.max(0, Math.min(1, centerXNorm + rel));
  const centerY = sampleTerrainCrestYNorm(profile, centerXNorm);
  const localY = sampleTerrainCrestYNorm(profile, xNorm);
  const slopeScale = layoutWidth * 0.42;
  return baseY + (centerY - localY) * slopeScale;
}

/**
 * @param {{
 *   seed: number;
 *   extent?: ForestExtent;
 *   speciesMix?: TreeSpecies[];
 *   terrainProfile?: TerrainProfile;
 *   forestCenterXNorm?: number;
 * }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateForest(options) {
  const { seed } = options;
  const rng = createRng(seed >>> 0);
  const extent = options.extent ?? planForestExtent(seed);
  const speciesMix = options.speciesMix ?? planForestSpeciesMix(seed);
  const cfg = EXTENT_CONFIG[extent];
  const layoutWidth = randRange(rng, cfg.spanMin, cfg.spanMax);
  const centerXNorm = options.forestCenterXNorm ?? 0.5;
  const treeCount = cfg.treeMin + Math.floor(rng() * (cfg.treeMax - cfg.treeMin + 1));
  const treeSpecies = assignForestTreeSpecies(speciesMix, treeCount, seed);
  const treePositions = planForestTreePositions(rng, treeCount, layoutWidth);

  const asm = new ElementAssembler();
  /** @type {TreeSpecies[]} */
  const usedSpecies = [];

  for (let i = 0; i < treeCount; i += 1) {
    const species = treeSpecies[i];
    usedSpecies.push(species);
    const cx = treePositions[i];
    const depth = randRange(rng, 0.72, 1.12);
    const baseY = terrainAdjustedBaseY(0, cx, layoutWidth, options.terrainProfile, centerXNorm);
    const tree = generateTree(rng, {
      species,
      cx,
      baseY,
      scale: depth * randRange(rng, 0.78, 1.08),
      leanDeg: (rng() - 0.5) * 9,
      canopyScale: 0.86,
    });

    for (const part of tree.parts) {
      asm.addPart(part.role, part.outer, part.holes, {
        tiltDeg: part.tiltDeg,
        buildSequence: i,
        treeIndex: i,
        smoothOutline: part.smoothOutline,
      });
    }
  }

  const style = extent === "compact" ? "grove" : "woodland";

  return asm.build("forest", seed, style, {
    extent,
    speciesMix: [...new Set(usedSpecies)],
    treeSpeciesAssigned: treeSpecies,
    treeCount,
    layoutWidth,
    forestCenterXNorm: centerXNorm,
    normalizeScaleBy: "height",
  });
}
