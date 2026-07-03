import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MOON_PHASE_COUNT,
  MOON_PHASE_NAMES,
  planSunRayCounts,
  buildConstellationEdges,
  celestialArcPoseAt,
  celestialOpacityAt,
  celestialTransitPoseAt,
  constrainOutsideLogo,
  createCelestialTransitParams,
  generateStarField,
  moonShadowMaskCx,
  nextMoonPhaseIndex,
  segmentsIntersect,
  star4PathD,
} from "../js/components/loader-fantasy-celestial.js";
import { createRng } from "../js/components/loader-ship-rng.js";

describe("loader-fantasy-celestial", () => {
  it("nextMoonPhaseIndex cicla 2 fases (creciente / menguante)", () => {
    assert.equal(MOON_PHASE_COUNT, 2);
    assert.equal(MOON_PHASE_NAMES.length, 2);
    assert.equal(nextMoonPhaseIndex(0), 1);
    assert.equal(nextMoonPhaseIndex(1), 0);
  });

  it("moonShadowMaskCx: creciente y menguante muy finas", () => {
    const cx = 50;
    const r = 22;
    const waxing = moonShadowMaskCx(0, cx, r);
    assert.ok(waxing > cx - 0.78 * r);
    assert.ok(waxing < cx - 0.58 * r);
    const waning = moonShadowMaskCx(1, cx, r);
    assert.ok(waning > cx + 0.58 * r);
    assert.ok(waning < cx + 0.78 * r);
    assert.notEqual(waxing, waning);
  });

  it("planSunRayCounts: 14–18 rayos principales y wisps dobles", () => {
    const rng = createRng(12);
    for (let i = 0; i < 25; i += 1) {
      const { mainCount, wispCount } = planSunRayCounts(rng);
      assert.ok(mainCount >= 14 && mainCount <= 18);
      assert.equal(wispCount, mainCount * 2);
    }
  });

  it("celestialArcPoseAt: parábola este→oeste con X lineal", () => {
    const w = 390;
    const h = 400;
    const dawn = celestialArcPoseAt(0, w, h);
    const noon = celestialArcPoseAt(0.5, w, h);
    const dusk = celestialArcPoseAt(1, w, h);
    assert.ok(dawn.x > w * 0.9, "amanecer a la derecha");
    assert.ok(dusk.x < w * 0.1, "atardecer a la izquierda");
    assert.ok(noon.y < dawn.y, "mediodía más alto que horizonte");
    assert.ok(noon.y < dusk.y, "mediodía más alto que atardecer");

    const mid1 = celestialArcPoseAt(0.25, w, h);
    const mid2 = celestialArcPoseAt(0.5, w, h);
    const mid3 = celestialArcPoseAt(0.75, w, h);
    const dx1 = mid2.x - mid1.x;
    const dx2 = mid3.x - mid2.x;
    assert.ok(Math.abs(dx1 - dx2) < 0.5, "velocidad horizontal constante");
  });

  it("constrainOutsideLogo empuja hacia fuera del disco central", () => {
    const w = 390;
    const h = 400;
    const bodyR = 20;
    const inside = constrainOutsideLogo(w * 0.5, h * 0.06, w, h, bodyR);
    const logoCx = w * 0.5;
    const logoCy = h * 0.06;
    const logoR = w * 0.34;
    const dist = Math.hypot(inside.x - logoCx, inside.y - logoCy);
    assert.ok(dist >= logoR + bodyR - 0.5);
  });

  it("star4PathD genera estrella de 4 puntas cerrada", () => {
    const d = star4PathD(10, 10, 4);
    assert.ok(d.startsWith("M"));
    assert.ok(d.endsWith("Z"));
    assert.ok(d.includes("L"));
  });

  it("generateStarField: estrellas más bajas y constelaciones sin cruces", () => {
    const rng = createRng(55);
    const stars = generateStarField(rng);
    assert.ok(stars.length >= 24);
    for (const s of stars) {
      assert.ok(s.yFrac >= 0.22 && s.yFrac <= 0.65);
      assert.ok(s.opacity >= 0.2 && s.opacity <= 0.5);
      assert.ok(s.r >= 0.32 && s.r <= 0.95);
    }
    const edges = buildConstellationEdges(stars, createRng(56), 390, 400);
    assert.ok(edges.length >= 6);
    for (let i = 0; i < edges.length; i += 1) {
      const [a0, b0] = edges[i];
      const sa = stars[a0];
      const sb = stars[b0];
      for (let j = i + 1; j < edges.length; j += 1) {
        const [a1, b1] = edges[j];
        if (a0 === a1 || a0 === b1 || b0 === a1 || b0 === b1) continue;
        const sc = stars[a1];
        const sd = stars[b1];
        assert.equal(
          segmentsIntersect(
            sa.xFrac, sa.yFrac, sb.xFrac, sb.yFrac,
            sc.xFrac, sc.yFrac, sd.xFrac, sd.yFrac,
          ),
          false,
          `cruce entre aristas ${i} y ${j}`,
        );
      }
    }
  });

  it("celestialOpacityAt hace fade en extremos", () => {
    assert.equal(celestialOpacityAt(0), 0);
    assert.equal(celestialOpacityAt(0.5), 1);
    assert.equal(celestialOpacityAt(1), 0);
  });

  it("createCelestialTransitParams distingue sol y luna", () => {
    const rng = createRng(3);
    const sun = createCelestialTransitParams(rng, "sun");
    const moon = createCelestialTransitParams(rng, "moon", 1);
    assert.equal(sun.kind, "sun");
    assert.equal(moon.kind, "moon");
    assert.equal(moon.moonPhase, 1);
    assert.ok(sun.durationMs >= 22000);
  });

  it("celestialTransitPoseAt sigue parábola sin saltos", () => {
    const params = createCelestialTransitParams(createRng(9), "sun");
    const a = celestialTransitPoseAt(params, 390, 400, 0.45);
    const b = celestialTransitPoseAt(params, 390, 400, 0.5);
    const c = celestialTransitPoseAt(params, 390, 400, 0.55);
    assert.ok(b.y <= a.y && b.y <= c.y, "cénit en el centro del arco");
    assert.ok(Math.abs((b.x - a.x) - (c.x - b.x)) < 1);
  });
});
