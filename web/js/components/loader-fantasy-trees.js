/**
 * Generador procedural de árboles (tronco + copa).
 *
 * @module loader-fantasy-trees
 */

import { jitterRing, polygon, rect } from "./loader-fantasy-geom.js";
import { randPick, randRange } from "./loader-ship-rng.js";

/** @typedef {'straight'|'tapered'|'gnarled'|'slender'|'forked'} TrunkKind */
/** @typedef {'round'|'lobed'|'conical'|'flat'|'sparse'} CanopyKind */
/** @typedef {'pine'|'oak'|'holm_oak'|'birch'|'fir'} TreeSpecies */

/** @typedef {{ role: 'trunk'|'canopy'; outer: import('./loader-fantasy-geom.js').FPoint[]; holes: import('./loader-fantasy-geom.js').FPoint[][]; buildSequence: number; tiltDeg?: number; smoothOutline?: boolean }} TreePartSpec */

/**
 * @type {Record<TreeSpecies, {
 *   trunk: TrunkKind;
 *   canopy: CanopyKind;
 *   crownStyle: 'oak' | 'holm' | 'birch' | 'conical';
 *   trunkHMult: number;
 *   trunkWMult: number;
 *   canopyWMult: number;
 *   canopyHMult: number;
 * }>}
 */
export const TREE_SPECIES = {
  pine: { trunk: "tapered", canopy: "conical", crownStyle: "conical", trunkHMult: 1, trunkWMult: 1, canopyWMult: 1, canopyHMult: 1 },
  oak: { trunk: "gnarled", canopy: "lobed", crownStyle: "oak", trunkHMult: 0.9, trunkWMult: 1.08, canopyWMult: 1.28, canopyHMult: 0.98 },
  holm_oak: { trunk: "straight", canopy: "flat", crownStyle: "holm", trunkHMult: 0.74, trunkWMult: 0.95, canopyWMult: 1.42, canopyHMult: 0.72 },
  birch: { trunk: "slender", canopy: "round", crownStyle: "birch", trunkHMult: 1.2, trunkWMult: 0.62, canopyWMult: 0.68, canopyHMult: 1.38 },
  fir: { trunk: "straight", canopy: "conical", crownStyle: "conical", trunkHMult: 1.06, trunkWMult: 0.92, canopyWMult: 1.02, canopyHMult: 1.12 },
};

/** @type {TreeSpecies[]} */
export const TREE_SPECIES_POOL = Object.keys(TREE_SPECIES);

/** Escala global de árboles respecto al tamaño base del generador. */
export const TREE_SIZE_FACTOR = 0.25;

/** Estrechamiento global de troncos respecto al generador base. */
export const TRUNK_WIDTH_FACTOR = 0.68;

/**
 * @param {() => number} rng
 * @param {TrunkKind} kind
 * @param {number} cx
 * @param {number} baseY
 * @param {number} height
 * @param {number} width
 * @returns {import('./loader-fantasy-geom.js').FPoint[]}
 */
export function buildTrunkOuter(rng, kind, cx, baseY, height, width) {
  const h = Math.max(height, 4);
  const w = Math.max(width, 1.2);

  /** @type {import('./loader-fantasy-geom.js').FPoint[]} */
  let outer;
  switch (kind) {
    case "tapered": {
      const topW = w * randRange(rng, 0.35, 0.55);
      outer = polygon([
        { x: cx - w / 2, y: baseY },
        { x: cx + w / 2, y: baseY },
        { x: cx + topW / 2, y: baseY + h },
        { x: cx - topW / 2, y: baseY + h },
      ]);
      break;
    }
    case "gnarled": {
      const bulge = w * randRange(rng, 0.15, 0.35);
      outer = polygon([
        { x: cx - w / 2, y: baseY },
        { x: cx + w / 2, y: baseY },
        { x: cx + w / 2 + bulge, y: baseY + h * 0.45 },
        { x: cx + w * 0.35, y: baseY + h * 0.72 },
        { x: cx + w * 0.2, y: baseY + h },
        { x: cx - w * 0.25, y: baseY + h },
        { x: cx - w / 2 - bulge * 0.4, y: baseY + h * 0.5 },
      ]);
      break;
    }
    case "slender": {
      const sw = w * 0.48;
      outer = polygon([
        { x: cx - sw / 2, y: baseY },
        { x: cx + sw / 2, y: baseY },
        { x: cx + sw * 0.22, y: baseY + h * 0.55 },
        { x: cx + sw * 0.12, y: baseY + h },
        { x: cx - sw * 0.14, y: baseY + h },
        { x: cx - sw * 0.2, y: baseY + h * 0.52 },
      ]);
      break;
    }
    case "forked": {
      const splitY = baseY + h * randRange(rng, 0.55, 0.72);
      outer = polygon([
        { x: cx - w / 2, y: baseY },
        { x: cx + w / 2, y: baseY },
        { x: cx + w * 0.22, y: splitY },
        { x: cx + w * 0.55, y: baseY + h },
        { x: cx + w * 0.05, y: splitY },
        { x: cx - w * 0.5, y: baseY + h },
        { x: cx - w * 0.15, y: splitY },
      ]);
      break;
    }
  default:
      outer = rect(cx, baseY, w, h);
  }

  return jitterRing(outer, rng, w * 0.08, { lockY: [baseY, baseY + h], freezeSeams: true });
}

/**
 * @param {() => number} rng
 * @param {CanopyKind} kind
 * @param {number} cx
 * @param {number} baseY
 * @param {number} width
 * @param {number} height
 * @param {{ conicalStyle?: 'pine' | 'fir' }} [opts]
 * @returns {import('./loader-fantasy-geom.js').FPoint[][]}
 */
export function buildCanopyOuters(rng, kind, cx, baseY, width, height, opts = {}) {
  const w = Math.max(width, 6);
  const h = Math.max(height, 5);

  switch (kind) {
    case "conical": {
      const isFir = opts.conicalStyle === "fir";
      const layers = isFir ? 4 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 2);
      const taper = isFir ? 0.42 : 0.58;
      /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
      const rings = [];
      for (let i = 0; i < layers; i += 1) {
        const t = i / layers;
        const layerW = w * (1 - t * taper) * (isFir ? 1.08 : 0.92);
        const layerH = h / layers;
        const layerBase = baseY + i * layerH * (isFir ? 0.78 : 0.82);
        const tipY = layerBase + layerH * (isFir ? 1.05 : 1);
        rings.push(jitterRing(
          polygon([
            { x: cx - layerW / 2, y: layerBase },
            { x: cx + layerW / 2, y: layerBase },
            { x: cx + layerW * randRange(rng, -0.08, 0.08), y: tipY },
          ]),
          rng,
          layerW * 0.1,
          { lockY: [layerBase], freezeSeams: true },
        ));
      }
      return rings;
    }
    case "lobed": {
      const lobes = 4 + Math.floor(rng() * 2);
      /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
      const rings = [buildOrganicCrown(rng, cx, baseY, w, h, { crownStyle: "oak", lobes })];
      if (rng() > 0.62) {
        const side = rng() < 0.5 ? -1 : 1;
        rings.push(buildOrganicCrown(
          rng,
          cx + side * w * 0.14,
          baseY,
          w * 0.48,
          h * 0.58,
          { crownStyle: "oak", lobes: 2 },
        ));
      }
      return rings;
    }
    case "flat": {
      const span = w * randRange(rng, 1.1, 1.32);
      const domeH = h * randRange(rng, 0.75, 0.98);
      return [
        buildOrganicCrown(rng, cx, baseY, span, domeH, { crownStyle: "holm", lobes: 3 }),
      ];
    }
    case "sparse": {
      const blobs = 2 + Math.floor(rng() * 2);
      /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
      const rings = [];
      for (let i = 0; i < blobs; i += 1) {
        const bx = cx + (rng() - 0.5) * w * 0.5;
        const bw = w * randRange(rng, 0.25, 0.45);
        const bh = h * randRange(rng, 0.35, 0.6);
        rings.push(buildRoundCanopy(rng, bx, baseY + bh * 0.1, bw, bh));
      }
      return rings;
    }
  default:
      return [buildOrganicCrown(rng, cx, baseY, w, h, { crownStyle: "birch" })];
  }
}

/**
 * @param {'oak' | 'holm' | 'birch' | undefined} crownStyle
 * @returns {{ lobes: number; asymmetry: number; rxScale: number; ryScale: number; wide: boolean }}
 */
function crownStyleParams(crownStyle) {
  switch (crownStyle) {
    case "oak":
      return { lobes: 4, asymmetry: 0.14, rxScale: 1.12, ryScale: 0.92, wide: false };
    case "holm":
      return { lobes: 3, asymmetry: 0.06, rxScale: 1.18, ryScale: 0.78, wide: true };
    case "birch":
      return { lobes: 2, asymmetry: 0.05, rxScale: 0.72, ryScale: 1.22, wide: false };
    default:
      return { lobes: 3, asymmetry: 0.1, rxScale: 1, ryScale: 1, wide: false };
  }
}

/**
 * Corona orgánica con contorno de árbol reconocible (domo suave + pocos lóbulos).
 * @param {() => number} rng
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {{ lobes?: number; asymmetry?: number; wide?: boolean; crownStyle?: 'oak' | 'holm' | 'birch' }} [opts]
 * @returns {import('./loader-fantasy-geom.js').FPoint[]}
 */
export function buildOrganicCrown(rng, cx, baseY, w, h, opts = {}) {
  const style = crownStyleParams(opts.crownStyle);
  const lobes = Math.max(2, opts.lobes ?? style.lobes);
  const asym = opts.asymmetry ?? (rng() - 0.5) * style.asymmetry;
  const wide = opts.wide ?? style.wide;
  const segments = lobes * 2 + 7;

  const anchorY = baseY;
  const rx0 = (w / 2) * randRange(rng, wide ? 0.98 : 0.94, wide ? 1.08 : 1.02) * style.rxScale;
  const ry0 = h * randRange(rng, 0.9, 1.02) * style.ryScale;
  const apexRy = ry0 * 1.1;

  /** @type {import('./loader-fantasy-geom.js').FPoint[]} */
  const pts = [];
  for (let i = 0; i < segments; i += 1) {
    const t = i / (segments - 1);
    const angle = Math.PI - t * Math.PI;
    const dome = Math.sin(t * Math.PI);
    const lobeWave = Math.sin(t * Math.PI * lobes) * (opts.crownStyle === "oak" ? 0.1 : 0.075);
    const rx = rx0 * (1 + lobeWave + asym * (t - 0.5));
    const ry = ry0 * (0.72 + dome * 0.4);
    const isApex = i === Math.floor((segments - 1) / 2);
    pts.push({
      x: cx + Math.cos(angle) * rx,
      y: anchorY + (isApex ? apexRy : Math.sin(angle) * ry),
    });
  }

  return jitterRing(pts, rng, w * 0.028, {
    lockY: [anchorY],
    freezeSeams: true,
    freezeHighY: anchorY + ry0 * 0.45,
  });
}

/**
 * @param {() => number} rng
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @returns {import('./loader-fantasy-geom.js').FPoint[]}
 */
function buildRoundCanopy(rng, cx, baseY, w, h) {
  return buildOrganicCrown(rng, cx, baseY, w, h, { crownStyle: "birch" });
}

/**
 * @param {{
 *   species?: TreeSpecies;
 *   scale?: number;
 *   leanDeg?: number;
 *   baseY?: number;
 *   cx?: number;
 *   canopyScale?: number;
 * }} [options]
 * @param {() => number} rng
 * @returns {{ species: TreeSpecies; parts: TreePartSpec[]; trunkTopY: number; footprintW: number }}
 */
export function generateTree(rng, options = {}) {
  const species = options.species ?? /** @type {TreeSpecies} */ (randPick(rng, TREE_SPECIES_POOL));
  const recipe = TREE_SPECIES[species];
  const scale = (options.scale ?? randRange(rng, 0.82, 1.18)) * TREE_SIZE_FACTOR;
  const canopyScale = options.canopyScale ?? 1;
  const cx = options.cx ?? 0;
  const baseY = options.baseY ?? 0;
  const leanDeg = options.leanDeg ?? (rng() - 0.5) * 7;

  const trunkH = randRange(rng, 14, 26) * scale * recipe.trunkHMult;
  const trunkW = randRange(rng, 2.2, 4.2) * scale * TRUNK_WIDTH_FACTOR * recipe.trunkWMult
    * (recipe.trunk === "slender" ? 0.68 : 1);
  const canopyW = trunkW * randRange(rng,
    recipe.canopy === "flat" ? 4.2 : recipe.canopy === "lobed" ? 3.8 : 3.0,
    recipe.canopy === "flat" ? 6.2 : recipe.canopy === "lobed" ? 5.6 : 5.2,
  ) * canopyScale * recipe.canopyWMult;
  const canopyH = trunkH * randRange(rng,
    recipe.canopy === "flat" ? 0.68 : recipe.canopy === "round" ? 0.95 : 0.75,
    recipe.canopy === "flat" ? 0.95 : recipe.canopy === "round" ? 1.45 : 1.35,
  ) * recipe.canopyHMult;
  const trunkTopY = baseY + trunkH;
  const canopyOverlap = trunkH * 0.05;

  const trunkOuter = buildTrunkOuter(rng, recipe.trunk, cx, baseY, trunkH, trunkW);
  /** @type {TreePartSpec[]} */
  const parts = [{
    role: "trunk",
    outer: trunkOuter,
    holes: [],
    buildSequence: 0,
    tiltDeg: leanDeg,
  }];

  const canopyRings = buildCanopyOuters(
    rng,
    recipe.canopy,
    cx,
    trunkTopY - canopyOverlap,
    canopyW,
    canopyH,
    {
      conicalStyle: species === "fir" ? "fir" : species === "pine" ? "pine" : undefined,
    },
  );
  canopyRings.forEach((outer, i) => {
    const smoothOutline = species !== "pine" && recipe.canopy !== "conical";
    const holes = [];
    if (rng() > 0.5 && recipe.canopy !== "conical") {
      const holeW = canopyW * randRange(rng, 0.08, 0.14);
      const holeH = canopyH * randRange(rng, 0.1, 0.16);
      holes.push(buildOrganicCrown(
        rng,
        cx + (rng() - 0.5) * canopyW * 0.15,
        trunkTopY - canopyOverlap * 0.5,
        holeW,
        holeH,
        { crownStyle: recipe.crownStyle === "conical" ? undefined : recipe.crownStyle, lobes: 2 },
      ));
    }
    parts.push({
      role: "canopy",
      outer,
      holes,
      buildSequence: 1 + i * 0.01,
      tiltDeg: leanDeg,
      smoothOutline,
    });
  });

  const xs = trunkOuter.map((p) => p.x);
  const footprintW = Math.max(...xs) - Math.min(...xs);

  return { species, parts, trunkTopY: trunkTopY + canopyH * 0.85, footprintW };
}
