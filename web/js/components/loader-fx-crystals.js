/**
 * Receta FX mágica para racimos de cristales.
 *
 * @module loader-fx-crystals
 */

import {
  clusterCoreFromTips,
  footFromPoints,
  longestCrystalEdge,
  parsePathOuterRing,
  tipFromPoints,
} from "./loader-fx-anchors.js";
import { FX_RECIPE_BUILDERS } from "./loader-fx-engine.js";
import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {import('./loader-fx-engine.js').FxAnchor} FxAnchor */
/** @typedef {import('./loader-fx-engine.js').FxRecipe} FxRecipe */

/**
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {FxAnchor[]}
 */
export function extractCrystalFxAnchors(element) {
  /** @type {FxAnchor[]} */
  const anchors = [];
  const crystalParts = element.parts.filter((p) => p.role === "crystal");
  /** @type {{ x: number; y: number }[]} */
  const tips = [];
  const rng = createRng(element.seed ^ 0x71a3e5);

  crystalParts.forEach((part, idx) => {
    const ring = parsePathOuterRing(part.d);

    anchors.push({
      id: `body-${idx}`,
      kind: "path",
      x: 0,
      y: 0,
      path: part.d,
      role: "crystal_body",
    });

    const tip = tipFromPoints(ring);
    if (tip) {
      tips.push(tip);
      anchors.push({
        id: `tip-${idx}`,
        kind: "point",
        x: tip.x,
        y: tip.y,
        weight: 1,
        role: "crystal_tip",
      });
    }

    const foot = footFromPoints(ring);
    if (foot) {
      anchors.push({
        id: `foot-${idx}`,
        kind: "point",
        x: foot.x,
        y: foot.y,
        weight: 1,
        role: "crystal_foot",
      });
    }

    const edge = longestCrystalEdge(ring);
    if (edge) {
      const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length;
      const cy = ring.reduce((s, p) => s + p.y, 0) / ring.length;
      anchors.push({
        id: `center-${idx}`,
        kind: "point",
        x: cx,
        y: cy,
        role: "crystal_center",
      });
      anchors.push({
        id: `axis-${idx}`,
        kind: "segment",
        x: edge.x,
        y: edge.y,
        x2: edge.x2,
        y2: edge.y2,
        weight: edge.length,
        role: "crystal_long_axis",
        phase: rng() * Math.PI * 2,
      });
    }
  });

  const core = clusterCoreFromTips(tips);
  if (core) {
    anchors.push({
      id: "cluster-core",
      kind: "point",
      x: core.x,
      y: core.y,
      weight: 0.5,
      role: "cluster_core",
    });
  }

  return anchors;
}

/**
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @param {number} seed
 * @param {{ intensity?: number; fxProfile?: string }} [opts]
 * @returns {FxRecipe | null}
 */
export function planCrystalMagicFx(element, seed, opts = {}) {
  const { intensity = 1, fxProfile } = opts;
  if (fxProfile === "none") return null;

  const style = element.style ?? "shard";
  const rng = createRng(seed ^ 0x7a31cf);
  const anchors = extractCrystalFxAnchors(element);
  const tipCount = anchors.filter((a) => a.role === "crystal_tip").length;
  if (tipCount === 0) return null;

  const subtle = fxProfile === "subtle";
  const visIntensity = subtle ? intensity * 0.65 : intensity * 1.35;
  const styleBurstMul = style === "shard" ? 1.2 : style === "geode" ? 0.95 : 1.05;
  const styleMotesBonus = style === "geode" ? 3 : 0;
  const styleMoteDrift = style === "floatingShards" ? 1.12 : 1.0;

  const burstBudget = subtle
    ? 0
    : Math.min(10, Math.round((8 + rng() * 4) * visIntensity * styleBurstMul));
  const moteBudget = Math.min(20, Math.round((16 + rng() * 6 + styleMotesBonus) * visIntensity));
  const scatterBudget = Math.min(
    12,
    Math.max(0, 40 - burstBudget - moteBudget),
    Math.round((8 + rng() * 5) * visIntensity),
  );

  /** @type {import('./loader-fx-engine.js').FxEffectSpec[]} */
  const effects = [];

  if (burstBudget > 0) {
    effects.push({
      type: "burst",
      phase: "building_end",
      particleBudget: burstBudget,
      durationMs: Math.round(randRange(rng, 280, 420)),
      intensity: visIntensity,
    });
  }

  effects.push({
    type: "internal_reflection",
    phase: "holding",
    intensity: visIntensity,
    durationMs: Math.round(randRange(rng, 2400, 3600)),
  });

  effects.push({
    type: "mote",
    phase: "holding",
    particleBudget: moteBudget,
    intensity: visIntensity * styleMoteDrift,
  });

  effects.push({
    type: "scatter",
    phase: "eroding",
    particleBudget: scatterBudget,
    intensity: visIntensity,
  });

  return {
    id: `crystals-magic-${seed}`,
    realm: "fantasy",
    hostKind: "crystals",
    seed,
    anchors,
    intensity: visIntensity,
    effects,
    meta: { style, moteDrift: styleMoteDrift },
  };
}

FX_RECIPE_BUILDERS.crystals = planCrystalMagicFx;
