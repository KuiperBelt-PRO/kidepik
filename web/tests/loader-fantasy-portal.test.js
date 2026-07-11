import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computePortalAperture,
  generatePortal,
  planPortalScale,
  planPortalStyle,
  PORTAL_PART_ROLES,
} from "../js/components/loader-fantasy-portal.js";
import {
  generateFantasyElement,
  isValidFantasyElement,
  planLifecycleTiming,
} from "../js/components/loader-fantasy-element.js";

describe("loader-fantasy-portal / determinismo", () => {
  it("misma seed → mismo dolmen", () => {
    const a = generatePortal({ seed: 4242 });
    const b = generatePortal({ seed: 4242 });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("seeds distintas → geometrías distintas", () => {
    const hashes = new Set();
    for (let s = 1; s <= 40; s += 1) {
      const el = generatePortal({ seed: s * 19 });
      hashes.add(el.parts.map((p) => p.d).join("|"));
    }
    assert.ok(hashes.size >= 28);
  });
});

describe("loader-fantasy-portal / estructura dolmen", () => {
  it("isValidFantasyElement en 30 seeds", () => {
    for (let s = 1; s <= 30; s += 1) {
      const el = generatePortal({ seed: s });
      assert.ok(isValidFantasyElement(el));
      assert.equal(el.kind, "portal");
      assert.equal(el.style, "dolmen");
    }
  });

  it("tres piezas con roles dolmen", () => {
    const el = generatePortal({ seed: 77 });
    assert.equal(el.parts.length, 3);
    const roles = el.parts.map((p) => p.role).sort();
    assert.deepEqual(roles, [...PORTAL_PART_ROLES].sort());
  });

  it("build order: uprights antes que lintel", () => {
    const el = generatePortal({ seed: 55 });
    const left = el.parts.find((p) => p.role === "upright_left");
    const right = el.parts.find((p) => p.role === "upright_right");
    const lintel = el.parts.find((p) => p.role === "lintel");
    assert.ok(left && right && lintel);
    assert.ok(left.buildOrder < lintel.buildOrder);
    assert.ok(right.buildOrder < lintel.buildOrder);
  });

  it("planPortalStyle siempre dolmen en v1", () => {
    for (let s = 0; s < 20; s += 1) {
      assert.equal(planPortalStyle(s), "dolmen");
    }
  });

  it("computePortalAperture con vano significativo", () => {
    const el = generatePortal({ seed: 9001 });
    const aperture = computePortalAperture(el);
    assert.ok(aperture);
    assert.ok(aperture.w >= 4);
    assert.ok(aperture.h >= 4);
    assert.ok(aperture.cx >= 20 && aperture.cx <= 80);
    assert.ok(aperture.cy >= 10 && aperture.cy <= 95);
  });

  it("generateFantasyElement portal registrado", () => {
    const el = generateFantasyElement("portal", { seed: 12 });
    assert.ok(el);
    assert.equal(el.kind, "portal");
  });

  it("timings portal deterministas", () => {
    const a = planLifecycleTiming(42, "portal", 3);
    const b = planLifecycleTiming(42, "portal", 3);
    assert.deepEqual(a, b);
    assert.ok(a.partDurationMs >= 200);
    assert.ok(a.holdMs >= 8500);
  });

  it("variación de escala por semilla", () => {
    const scales = new Set();
    for (let s = 1; s <= 30; s += 1) {
      const el = generatePortal({ seed: s * 7 });
      scales.add(el.meta.scale);
      assert.ok(el.meta.scale >= 0.74 && el.meta.scale <= 1.26);
    }
    assert.ok(scales.size >= 12);
    assert.equal(planPortalScale(99), planPortalScale(99));
  });

  it("rocas con ligera irregularidad (chaflán + jitter)", () => {
    const el = generatePortal({ seed: 314 });
    for (const part of el.parts) {
      const nums = part.d.match(/-?[\d.]+/g)?.length ?? 0;
      assert.ok(nums >= 8, `parte ${part.role} demasiado simple`);
      assert.ok(el.meta.imperfection >= 0.4 && el.meta.imperfection <= 0.66);
    }
  });
});
