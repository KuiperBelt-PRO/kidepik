import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computePortalAperture,
  generatePortal,
  planPortalScale,
  planPortalStyle,
  PORTAL_STYLES,
} from "../js/components/loader-fantasy-portal.js";
import {
  generateFantasyElement,
  isValidFantasyElement,
  planLifecycleTiming,
} from "../js/components/loader-fantasy-element.js";

describe("loader-fantasy-portal / determinismo", () => {
  it("misma seed → mismo portal", () => {
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

describe("loader-fantasy-portal / estilos", () => {
  it("PORTAL_STYLES incluye dolmen, romanesque y circular", () => {
    assert.deepEqual(PORTAL_STYLES, ["dolmen", "romanesque", "circular"]);
  });

  it("planPortalStyle reparte los tres estilos en 90 seeds", () => {
    const seen = new Set();
    for (let s = 0; s < 90; s += 1) {
      seen.add(planPortalStyle(s));
    }
    assert.deepEqual([...seen].sort(), [...PORTAL_STYLES].sort());
  });

  it("isValidFantasyElement en 30 seeds por estilo forzado", () => {
    for (const style of PORTAL_STYLES) {
      for (let s = 1; s <= 30; s += 1) {
        const el = generatePortal({ seed: s * 13, style });
        assert.ok(isValidFantasyElement(el), `${style} seed ${s}`);
        assert.equal(el.kind, "portal");
        assert.equal(el.style, style);
      }
    }
  });

  it("computePortalAperture con vano significativo en los tres estilos", () => {
    for (const style of PORTAL_STYLES) {
      const el = generatePortal({ seed: 9001, style });
      const aperture = computePortalAperture(el);
      assert.ok(aperture, style);
      assert.ok(aperture.w >= 4, style);
      assert.ok(aperture.h >= 4, style);
      assert.ok(aperture.cx >= 20 && aperture.cx <= 80, style);
      assert.ok(aperture.cy >= 8 && aperture.cy <= 95, style);
    }
  });
});

describe("loader-fantasy-portal / dolmen", () => {
  it("tres piezas con roles dolmen", () => {
    const el = generatePortal({ seed: 77, style: "dolmen" });
    assert.equal(el.parts.length, 3);
    const roles = el.parts.map((p) => p.role).sort();
    assert.deepEqual(roles, ["lintel", "upright_left", "upright_right"]);
  });

  it("build order: uprights antes que lintel", () => {
    const el = generatePortal({ seed: 55, style: "dolmen" });
    const left = el.parts.find((p) => p.role === "upright_left");
    const right = el.parts.find((p) => p.role === "upright_right");
    const lintel = el.parts.find((p) => p.role === "lintel");
    assert.ok(left && right && lintel);
    assert.ok(left.buildOrder < lintel.buildOrder);
    assert.ok(right.buildOrder < lintel.buildOrder);
  });
});

describe("loader-fantasy-portal / romanesque", () => {
  it("columnas + varias dovelas", () => {
    const el = generatePortal({ seed: 101, style: "romanesque" });
    const uprights = el.parts.filter((p) => p.role.startsWith("upright_"));
    const voussoirs = el.parts.filter((p) => p.role.startsWith("voussoir_"));
    assert.equal(uprights.length, 2);
    assert.ok(voussoirs.length >= 5 && voussoirs.length <= 8);
    assert.equal(el.parts.length, 2 + voussoirs.length);
  });

  it("build order: columnas antes que dovelas", () => {
    const el = generatePortal({ seed: 202, style: "romanesque" });
    const maxUpright = Math.max(
      ...el.parts.filter((p) => p.role.startsWith("upright_")).map((p) => p.buildOrder),
    );
    const minVoussoir = Math.min(
      ...el.parts.filter((p) => p.role.startsWith("voussoir_")).map((p) => p.buildOrder),
    );
    assert.ok(maxUpright < minVoussoir);
  });

  it("dovelas en orden izquierda → derecha", () => {
    const el = generatePortal({ seed: 303, style: "romanesque" });
    const voussoirs = el.parts
      .filter((p) => p.role.startsWith("voussoir_"))
      .sort((a, b) => a.buildOrder - b.buildOrder);
    for (let i = 1; i < voussoirs.length; i += 1) {
      assert.ok(voussoirs[i].buildOrder > voussoirs[i - 1].buildOrder);
    }
  });
});

describe("loader-fantasy-portal / circular", () => {
  it("anillo con 7–11 piedras distintas", () => {
    const el = generatePortal({ seed: 404, style: "circular" });
    const stones = el.parts.filter((p) => p.role.startsWith("ring_stone_"));
    assert.ok(stones.length >= 7 && stones.length <= 11);
    assert.equal(el.parts.length, stones.length);
  });

  it("piedras con geometría irregular", () => {
    const el = generatePortal({ seed: 505, style: "circular" });
    for (const part of el.parts) {
      const nums = part.d.match(/-?[\d.]+/g)?.length ?? 0;
      assert.ok(nums >= 8, `piedra ${part.role} demasiado simple`);
    }
  });

  it("build order por profundidad (fondo antes que frente)", () => {
    const el = generatePortal({ seed: 606, style: "circular" });
    const stones = el.parts
      .filter((p) => p.role.startsWith("ring_stone_"))
      .sort((a, b) => a.buildOrder - b.buildOrder);
    assert.ok(stones.length >= 7);
    assert.ok(stones[0].buildOrder < stones[stones.length - 1].buildOrder);
  });
});

describe("loader-fantasy-portal / integración motor", () => {
  it("generateFantasyElement portal registrado", () => {
    const el = generateFantasyElement("portal", { seed: 12 });
    assert.ok(el);
    assert.equal(el.kind, "portal");
    assert.ok(PORTAL_STYLES.includes(el.style));
  });

  it("timings portal deterministas", () => {
    const el = generatePortal({ seed: 42 });
    const a = planLifecycleTiming(42, "portal", el.parts.length);
    const b = planLifecycleTiming(42, "portal", el.parts.length);
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
    const el = generatePortal({ seed: 314, style: "dolmen" });
    for (const part of el.parts) {
      const nums = part.d.match(/-?[\d.]+/g)?.length ?? 0;
      assert.ok(nums >= 8, `parte ${part.role} demasiado simple`);
      assert.ok(el.meta.imperfection >= 0.4 && el.meta.imperfection <= 0.66);
    }
  });
});
