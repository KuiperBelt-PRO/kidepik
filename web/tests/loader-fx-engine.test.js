import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  footFromPoints,
  longestCrystalEdge,
  parsePathOuterRing,
  tipFromPoints,
} from "../js/components/loader-fx-anchors.js";
import {
  isValidFxRecipe,
  planBlockTestFx,
  planFxRecipe,
  resetSceneParticleBudget,
  totalParticleBudget,
} from "../js/components/loader-fx-engine.js";
import { reflectionOpacityPulse } from "../js/components/loader-fx-fantasy-palette.js";
import "../js/components/loader-fx-crystals.js";
import { generateCrystals } from "../js/components/loader-fantasy-crystals.js";

describe("loader-fx-engine", () => {
  beforeEach(() => resetSceneParticleBudget());

  it("planBlockTestFx es determinista y válida", () => {
    const a = planBlockTestFx({}, 42);
    const b = planBlockTestFx({}, 42);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.ok(isValidFxRecipe(a));
  });

  it("planFxRecipe respeta fxProfile none", () => {
    const recipe = planFxRecipe("block", {}, { seed: 1, fxProfile: "none" });
    assert.equal(recipe, null);
  });

  it("presupuesto de partículas dentro del límite", () => {
    const recipe = planBlockTestFx({}, 99);
    assert.ok(totalParticleBudget(recipe) <= 32);
  });

  it("planFxRecipe crystals tras registro", () => {
    const el = generateCrystals({ seed: 42 });
    const recipe = planFxRecipe("crystals", el, { seed: 42 });
    assert.ok(recipe);
    assert.equal(recipe?.hostKind, "crystals");
  });
});

describe("loader-fx-anchors", () => {
  it("parsePathOuterRing extrae el primer subpath", () => {
    const d = "M 10 20 L 30 40 L 50 20 Z M 5 5 L 6 6 Z";
    const ring = parsePathOuterRing(d);
    assert.equal(ring.length, 3);
    assert.deepEqual(ring[0], { x: 10, y: 20 });
  });

  it("tipFromPoints elige menor y", () => {
    const tip = tipFromPoints([{ x: 1, y: 50 }, { x: 2, y: 10 }, { x: 3, y: 40 }]);
    assert.deepEqual(tip, { x: 2, y: 10 });
  });

  it("longestCrystalEdge ignora arista de base", () => {
    const pts = [
      { x: 40, y: 80 },
      { x: 60, y: 80 },
      { x: 65, y: 30 },
      { x: 50, y: 10 },
      { x: 35, y: 30 },
    ];
    const edge = longestCrystalEdge(pts);
    assert.ok(edge);
    assert.ok(edge.length > 3);
  });

  it("footFromPoints elige mayor y", () => {
    const foot = footFromPoints([
      { x: 40, y: 80 },
      { x: 60, y: 80 },
      { x: 50, y: 10 },
    ]);
    assert.ok(foot);
    assert.equal(foot?.y, 80);
  });
});

describe("loader-fx-fantasy-palette", () => {
  it("reflectionOpacityPulse oscila en rango", () => {
    const v = reflectionOpacityPulse(0);
    assert.ok(v >= 0.18 && v <= 0.52);
    const peak = reflectionOpacityPulse(0.25 / 0.38);
    assert.ok(peak >= 0.48 && peak <= 0.54);
  });
});
