/**
 * Builder de muros rocosos en los bordes laterales (pared al mundo exterior).
 *
 * @module loader-fantasy-cliffs
 */

import { ElementAssembler } from "./loader-fantasy-element.js";
import { polygon } from "./loader-fantasy-geom.js";
import { createRng, randRange } from "./loader-ship-rng.js";

const SEAM = 1.1;
const WALL_BLEED = 108;
const FACE_DEPTH_MIN = 16;
const FACE_DEPTH_MAX = 26;

/**
 * @typedef {'left' | 'right'} CliffSide
 * @typedef {'cliff' | 'rocks'} CliffFormationType
 */

export function planCliffSides(seed) {
  void seed;
  return { sides: ["left", "right"] };
}

/**
 * Tipo de formación compartido por ambos extremos en un mismo ciclo de muro.
 * @param {number} seed  semilla de sesión/ciclo (no la semilla por lado)
 * @returns {CliffFormationType}
 */
export function planCliffFormation(seed) {
  const rng = createRng(seed >>> 0);
  return rng() < 0.5 ? "cliff" : "rocks";
}

/**
 * @param {string} d
 * @returns {number}
 */
export function maxVerticalSpanInPath(d) {
  const nums = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
  let max = 0;
  for (let i = 0; i < nums.length - 3; i += 2) {
    const x1 = nums[i];
    const y1 = nums[i + 1];
    const x2 = nums[i + 2];
    const y2 = nums[i + 3];
    if (Math.abs(x1 - x2) < 0.4) {
      max = Math.max(max, Math.abs(y2 - y1));
    }
  }
  return max;
}

/**
 * Perfil interior x(y): una sola x por altura → sin picos ni autointersección.
 * @param {() => number} rng
 * @param {number} toeX
 * @param {number} height
 * @param {number} steps
 * @returns {import('./loader-fantasy-geom.js').FPoint[]}
 */
export function buildInnerFaceProfile(rng, toeX, height, steps) {
  const minX = toeX * randRange(rng, 0.42, 0.68);
  /** @type {import('./loader-fantasy-geom.js').FPoint[]} */
  const pts = [{ x: toeX, y: 0 }];
  let y = 0;
  const stepH = height / steps;

  for (let i = 0; i < steps; i++) {
    y += stepH * randRange(rng, 0.88, 1.12);
    y = Math.min(height, y);
    const t = i / Math.max(1, steps - 1);
    const recess = randRange(rng, 0.05, 0.95) * (0.55 + t * 0.45);
    const x = minX + (toeX - minX) * recess;
    pts.push({ x: Math.min(toeX, x), y });
  }

  const last = pts[pts.length - 1];
  if (last.y < height * 0.92) {
    pts.push({ x: minX + (toeX - minX) * randRange(rng, 0.35, 0.75), y: height });
  }
  return pts;
}

/**
 * Muro macizo: costura x=0, masa x≤0, cara interior con perfil monótono.
 * @param {() => number} rng
 * @param {number} bleed
 * @param {number} faceDepth
 * @param {number} height
 * @returns {import('./loader-fantasy-geom.js').FPoint[]}
 */
function buildWallMass(rng, bleed, faceDepth, height) {
  const toeX = faceDepth;
  const topY = height;
  const faceSteps = 14 + Math.floor(rng() * 8);
  const facePts = buildInnerFaceProfile(rng, toeX, topY, faceSteps);

  return polygon([
    { x: -bleed, y: 0 },
    { x: toeX, y: 0 },
    ...facePts.slice(1),
  ]);
}

/**
 * Losas horizontales dentro de la columna del muro (sin sobresalir).
 * @param {number} bleed
 * @param {number} y0
 * @param {number} y1
 * @param {number} frontLo
 * @param {number} frontHi
 * @returns {import('./loader-fantasy-geom.js').FPoint[]}
 */
function buildRockSlab(bleed, y0, y1, frontLo, frontHi) {
  const h = y1 - y0;
  const backBot = -bleed;
  const backTop = backBot + Math.min(h * 0.4, bleed * 0.1);
  const f0 = Math.min(frontLo, frontHi);
  const f1 = Math.max(frontLo, frontHi);
  return polygon([
    { x: backBot, y: y0 },
    { x: f0, y: y0 },
    { x: f1, y: y1 },
    { x: backTop, y: y1 },
  ]);
}

/**
 * @param {() => number} rng
 * @param {ElementAssembler} asm
 * @param {number} bleed
 * @param {number} faceDepth
 * @param {number} height
 */
function addRockSlabs(rng, asm, bleed, faceDepth, height) {
  const toeX = faceDepth;
  const count = 6 + Math.floor(rng() * 5);
  /** @type {number[]} */
  const heights = [];
  let remaining = height;
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      heights.push(remaining);
    } else {
      const slice = remaining * randRange(rng, 0.09, 0.2);
      heights.push(slice);
      remaining -= slice;
    }
  }

  let y = 0;
  let front = toeX;
  heights.forEach((h, i) => {
    const y1 = y + h;
    let frontTop = toeX * randRange(rng, 0.52, 1.0);
    const minSpread = h * 0.42;
    if (Math.abs(frontTop - front) < minSpread) {
      frontTop = front + (frontTop >= front ? minSpread : -minSpread);
      frontTop = Math.min(toeX, Math.max(toeX * 0.38, frontTop));
    }
    const slab = buildRockSlab(bleed, y, y1, front, frontTop);
    asm.addPart("rock", slab, [], { buildSequence: i });
    y = y1 - SEAM * 0.5;
    front = frontTop;
  });
}

/**
 * @param {() => number} rng
 * @param {ElementAssembler} asm
 * @param {number} bleed
 * @param {number} faceDepth
 * @param {number} height
 */
function addCliffMass(rng, asm, bleed, faceDepth, height) {
  const outer = buildWallMass(rng, bleed, faceDepth, height);
  asm.addPart("cliff", outer, [], { buildSequence: 0 });
}

/**
 * @param {{
 *   seed: number;
 *   side: CliffSide;
 *   formationType?: CliffFormationType;
 * }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateCliffs(options) {
  const { seed, side } = options;
  const rng = createRng(seed >>> 0);
  const formationType = options.formationType ?? planCliffFormation(seed);

  const faceDepth = randRange(rng, FACE_DEPTH_MIN, FACE_DEPTH_MAX);
  const heightAbove = randRange(rng, 74, 98);
  const bleed = WALL_BLEED * randRange(rng, 0.94, 1.06);

  const asm = new ElementAssembler();

  if (formationType === "rocks") {
    addRockSlabs(rng, asm, bleed, faceDepth, heightAbove);
  } else {
    addCliffMass(rng, asm, bleed, faceDepth, heightAbove);
  }

  const meta = {
    formationType,
    side,
    faceDepth,
    bleed,
    heightAbove,
    normalizeMode: "wallSeam",
    normalizeScaleBy: "height",
    normalizeAnchorX: side,
  };

  return asm.build("cliffs", seed, "white", meta);
}
