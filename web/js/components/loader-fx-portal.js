/**
 * Receta FX para portales mágicos (dolmen, arco románico, anillo circular).
 *
 * Partículas blancas que nacen en las rocas y fluyen hacia el vano.
 *
 * @module loader-fx-portal
 */

import { computePortalAperture, pathBBox } from "./loader-fantasy-portal.js";
import { FX_RECIPE_BUILDERS } from "./loader-fx-engine.js";
import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {import('./loader-fx-engine.js').FxAnchor} FxAnchor */
/** @typedef {import('./loader-fx-engine.js').FxRecipe} FxRecipe */

const SPAWN_POINTS_PER_EDGE = 5;

/**
 * Puntos de spawn en el borde interior de una pieza hacia el centro del vano.
 * @param {string} id
 * @param {string} d
 * @param {number} cx
 * @param {number} cy
 * @param {number} count
 * @returns {FxAnchor[]}
 */
function spawnAnchorsTowardCenter(id, d, cx, cy, count) {
  const b = pathBBox(d);
  /** @type {FxAnchor[]} */
  const anchors = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const x = b.minX + (b.maxX - b.minX) * t;
    const y = b.minY + (b.maxY - b.minY) * t;
    const dx = cx - x;
    const dy = cy - y;
    const dist = Math.hypot(dx, dy) || 1;
    const inset = Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.18;
    anchors.push({
      id: `${id}-${i}`,
      kind: "point",
      x: x + (dx / dist) * inset,
      y: y + (dy / dist) * inset,
      role: "portal_rock_spawn",
    });
  }
  return anchors;
}

/**
 * Puntos de spawn en el borde interior de cada roca (hacia el vano).
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {FxAnchor[]}
 */
export function extractPortalFxAnchors(element) {
  const aperture = computePortalAperture(element);
  if (!aperture) return [];

  const { cx, cy } = aperture;
  /** @type {FxAnchor[]} */
  const anchors = [
    {
      id: "aperture-center",
      kind: "point",
      x: cx,
      y: cy,
      weight: 1,
      role: "portal_aperture",
    },
  ];

  if (element.style === "dolmen") {
    const left = element.parts.find((p) => p.role === "upright_left");
    const right = element.parts.find((p) => p.role === "upright_right");
    const lintel = element.parts.find((p) => p.role === "lintel");

    if (left) {
      const b = pathBBox(left.d);
      for (let i = 0; i < SPAWN_POINTS_PER_EDGE; i += 1) {
        const t = (i + 0.5) / SPAWN_POINTS_PER_EDGE;
        anchors.push({
          id: `spawn-left-${i}`,
          kind: "point",
          x: b.maxX,
          y: b.minY + (b.maxY - b.minY) * t,
          role: "portal_rock_spawn",
        });
      }
    }

    if (right) {
      const b = pathBBox(right.d);
      for (let i = 0; i < SPAWN_POINTS_PER_EDGE; i += 1) {
        const t = (i + 0.5) / SPAWN_POINTS_PER_EDGE;
        anchors.push({
          id: `spawn-right-${i}`,
          kind: "point",
          x: b.minX,
          y: b.minY + (b.maxY - b.minY) * t,
          role: "portal_rock_spawn",
        });
      }
    }

    if (lintel) {
      const b = pathBBox(lintel.d);
      for (let i = 0; i < SPAWN_POINTS_PER_EDGE + 1; i += 1) {
        const t = (i + 0.5) / (SPAWN_POINTS_PER_EDGE + 1);
        anchors.push({
          id: `spawn-lintel-${i}`,
          kind: "point",
          x: b.minX + (b.maxX - b.minX) * t,
          y: b.maxY,
          role: "portal_rock_spawn",
        });
      }
    }
    return anchors;
  }

  if (element.style === "romanesque") {
    const left = element.parts.find((p) => p.role === "upright_left");
    const right = element.parts.find((p) => p.role === "upright_right");
    if (left) {
      const b = pathBBox(left.d);
      for (let i = 0; i < SPAWN_POINTS_PER_EDGE; i += 1) {
        const t = (i + 0.5) / SPAWN_POINTS_PER_EDGE;
        anchors.push({
          id: `spawn-left-${i}`,
          kind: "point",
          x: b.maxX,
          y: b.minY + (b.maxY - b.minY) * t,
          role: "portal_rock_spawn",
        });
      }
    }
    if (right) {
      const b = pathBBox(right.d);
      for (let i = 0; i < SPAWN_POINTS_PER_EDGE; i += 1) {
        const t = (i + 0.5) / SPAWN_POINTS_PER_EDGE;
        anchors.push({
          id: `spawn-right-${i}`,
          kind: "point",
          x: b.minX,
          y: b.minY + (b.maxY - b.minY) * t,
          role: "portal_rock_spawn",
        });
      }
    }
    const voussoirs = element.parts.filter((p) => p.role.startsWith("voussoir_"));
    for (const v of voussoirs) {
      anchors.push(...spawnAnchorsTowardCenter(v.role, v.d, cx, cy, 2));
    }
    return anchors;
  }

  const stones = element.parts.filter((p) => p.role.startsWith("ring_stone_"));
  for (const stone of stones) {
    anchors.push(...spawnAnchorsTowardCenter(stone.role, stone.d, cx, cy, 2));
  }

  return anchors;
}

/**
 * @param {FxAnchor[]} anchors
 * @returns {number}
 */
export function countPortalRockSpawns(anchors) {
  return anchors.filter((a) => a.role === "portal_rock_spawn").length;
}

/**
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @param {number} seed
 * @param {{ intensity?: number; fxProfile?: string }} [opts]
 * @returns {FxRecipe | null}
 */
export function planPortalMagicFx(element, seed, opts = {}) {
  const { intensity = 1, fxProfile } = opts;
  if (fxProfile === "none") return null;

  const anchors = extractPortalFxAnchors(element);
  if (anchors.length < 4) return null;

  const rng = createRng(seed ^ 0x51a8c4e2);
  const subtle = fxProfile === "subtle";
  const visIntensity = subtle ? intensity * 0.65 : intensity * 1.1;

  /** @type {import('./loader-fx-engine.js').FxEffectSpec[]} */
  const effects = [
    {
      type: "portal_inflow",
      phase: "holding",
      particleBudget: 38,
      intensity: visIntensity,
    },
    {
      type: "portal_inflow",
      phase: "eroding",
      particleBudget: 2,
      intensity: visIntensity * 0.6,
    },
  ];

  return {
    id: `portal-magic-${seed}`,
    realm: "fantasy",
    hostKind: "portal",
    seed,
    anchors,
    intensity: visIntensity,
    effects,
    meta: {
      spawnIntervalMs: Math.round(randRange(rng, 32, 48)),
      spawnBurst: 1,
      particleRadiusMin: 0.85,
      particleRadiusMax: 1.45,
    },
  };
}

FX_RECIPE_BUILDERS.portal = planPortalMagicFx;
