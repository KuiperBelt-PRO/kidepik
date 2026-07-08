import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { minTipSeparation } from "../js/components/loader-fx-anchors.js";
import { isValidFxRecipe, planFxRecipe, totalParticleBudget } from "../js/components/loader-fx-engine.js";
import {
  extractCrystalFxAnchors,
  planCrystalMagicFx,
} from "../js/components/loader-fx-crystals.js";
import { generateCrystals } from "../js/components/loader-fantasy-crystals.js";

describe("loader-fx-crystals / determinismo", () => {
  it("misma seed → misma receta", () => {
    const el = generateCrystals({ seed: 9001 });
    const a = planCrystalMagicFx(el, 9001);
    const b = planCrystalMagicFx(el, 9001);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});

describe("loader-fx-crystals / anclas", () => {
  it("≥ 4 tips en 30 seeds", () => {
    let ok = 0;
    for (let s = 1; s <= 30; s += 1) {
      const el = generateCrystals({ seed: s * 13 });
      const tips = extractCrystalFxAnchors(el).filter((a) => a.role === "crystal_tip");
      if (tips.length >= 4) ok += 1;
    }
    assert.ok(ok >= 28);
  });

  it("tips dentro del viewBox 0..100", () => {
    const el = generateCrystals({ seed: 77 });
    const tips = extractCrystalFxAnchors(el).filter((a) => a.role === "crystal_tip");
    for (const t of tips) {
      assert.ok(t.x >= 0 && t.x <= 100);
      assert.ok(t.y >= 0 && t.y <= 100);
    }
  });

  it("separación mínima entre tips > 2 u", () => {
    const el = generateCrystals({ seed: 55 });
    const tips = extractCrystalFxAnchors(el).filter((a) => a.role === "crystal_tip");
    if (tips.length >= 2) {
      assert.ok(minTipSeparation(tips) > 2 || tips.length === 1);
    }
  });

  it("cada cristal expone eje longitudinal", () => {
    const el = generateCrystals({ seed: 33 });
    const axes = extractCrystalFxAnchors(el).filter((a) => a.role === "crystal_long_axis");
    const crystals = el.parts.filter((p) => p.role === "crystal");
    assert.ok(axes.length >= 1);
    assert.ok(axes.length <= crystals.length);
    for (const axis of axes) {
      const len = Math.hypot((axis.x2 ?? axis.x) - axis.x, (axis.y2 ?? axis.y) - axis.y);
      assert.ok(len > 2.5);
    }
  });

  it("incluye clip de cuerpo por cristal", () => {
    const el = generateCrystals({ seed: 21 });
    const bodies = extractCrystalFxAnchors(el).filter((a) => a.role === "crystal_body");
    const crystals = el.parts.filter((p) => p.role === "crystal");
    assert.equal(bodies.length, crystals.length);
    assert.ok(bodies.every((b) => typeof b.path === "string" && b.path.length > 4));
  });
});

describe("loader-fx-crystals / receta", () => {
  it("presupuesto total ≤ 40", () => {
    for (let s = 1; s <= 40; s += 1) {
      const el = generateCrystals({ seed: s });
      const recipe = planCrystalMagicFx(el, s);
      assert.ok(recipe);
      assert.ok(isValidFxRecipe(recipe));
      assert.ok(totalParticleBudget(recipe) <= 40);
    }
  });

  it("shard vs geode difieren en al menos un parámetro", () => {
    const shardEl = generateCrystals({ seed: 100, style: "shard" });
    const geodeEl = generateCrystals({ seed: 100, style: "geode" });
    const shard = planCrystalMagicFx(shardEl, 100);
    const geode = planCrystalMagicFx(geodeEl, 100);
    const shardJson = JSON.stringify({ effects: shard?.effects, meta: shard?.meta });
    const geodeJson = JSON.stringify({ effects: geode?.effects, meta: geode?.meta });
    assert.notEqual(shardJson, geodeJson);
  });

  it("fxProfile none → null", () => {
    const el = generateCrystals({ seed: 1 });
    assert.equal(planCrystalMagicFx(el, 1, { fxProfile: "none" }), null);
    assert.equal(planFxRecipe("crystals", el, { seed: 1, fxProfile: "none" }), null);
  });

  it("receta usa internal_reflection", () => {
    const el = generateCrystals({ seed: 5 });
    const recipe = planCrystalMagicFx(el, 5);
    assert.ok(recipe?.effects.some((e) => e.type === "internal_reflection"));
  });

  it("fxProfile subtle sin burst", () => {
    const el = generateCrystals({ seed: 12 });
    const recipe = planCrystalMagicFx(el, 12, { fxProfile: "subtle" });
    assert.ok(recipe);
    const burst = recipe.effects.find((e) => e.type === "burst");
    assert.equal(burst?.particleBudget ?? 0, 0);
  });
});
