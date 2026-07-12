import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isValidFxRecipe, planFxRecipe, totalParticleBudget, MAX_PARTICLES_PER_HOST } from "../js/components/loader-fx-engine.js";
import {
  countPortalRockSpawns,
  extractPortalFxAnchors,
  planPortalMagicFx,
} from "../js/components/loader-fx-portal.js";
import { generatePortal, PORTAL_STYLES } from "../js/components/loader-fantasy-portal.js";
import "../js/components/loader-fx-portal.js";

describe("loader-fx-portal / determinismo", () => {
  it("misma seed → misma receta", () => {
    const el = generatePortal({ seed: 4242 });
    const a = planPortalMagicFx(el, 4242);
    const b = planPortalMagicFx(el, 4242);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});

describe("loader-fx-portal / anclas y receta", () => {
  it("spawn en rocas y vano en 30 seeds por estilo", () => {
    for (const style of PORTAL_STYLES) {
      let ok = 0;
      for (let s = 1; s <= 30; s += 1) {
        const el = generatePortal({ seed: s * 11, style });
        const anchors = extractPortalFxAnchors(el);
        const center = anchors.find((a) => a.role === "portal_aperture");
        const spawns = countPortalRockSpawns(anchors);
        if (center && spawns >= 12) ok += 1;
      }
      assert.ok(ok >= 26, style);
    }
  });

  it("receta válida con portal_inflow y presupuesto alto", () => {
    const el = generatePortal({ seed: 88 });
    const recipe = planPortalMagicFx(el, 88);
    assert.ok(recipe);
    assert.ok(isValidFxRecipe(recipe));
    assert.equal(recipe.hostKind, "portal");
    const inflows = recipe.effects.filter((e) => e.type === "portal_inflow");
    assert.equal(inflows.length, 2);
    assert.ok(inflows.some((e) => e.phase === "holding" && (e.particleBudget ?? 0) >= 36));
    assert.ok(totalParticleBudget(recipe) <= MAX_PARTICLES_PER_HOST);
  });

  it("planFxRecipe resuelve portal para cada estilo", () => {
    for (const style of PORTAL_STYLES) {
      const el = generatePortal({ seed: 33, style });
      const recipe = planFxRecipe("portal", el, { seed: 33 });
      assert.ok(recipe, style);
      assert.ok(isValidFxRecipe(recipe), style);
    }
  });

  it("fxProfile none → sin receta", () => {
    const el = generatePortal({ seed: 1 });
    assert.equal(planPortalMagicFx(el, 1, { fxProfile: "none" }), null);
  });
});
