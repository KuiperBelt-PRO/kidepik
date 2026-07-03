import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInnerFaceProfile,
  generateCliffs,
  maxVerticalSpanInPath,
  planCliffSides,
} from "../js/components/loader-fantasy-cliffs.js";
import {
  generateFantasyElement,
  isValidFantasyElement,
  planLifecycleTiming,
} from "../js/components/loader-fantasy-element.js";

describe("loader-fantasy-cliffs / determinismo", () => {
  it("misma seed + lado + tipo → mismo elemento", () => {
    const a = generateCliffs({ seed: 4242, side: "left", formationType: "cliff" });
    const b = generateCliffs({ seed: 4242, side: "left", formationType: "cliff" });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("lados distintos producen siluetas distintas (espejo de costura)", () => {
    const left = generateCliffs({ seed: 99, side: "left", formationType: "rocks" });
    const right = generateCliffs({ seed: 99, side: "right", formationType: "rocks" });
    assert.notEqual(JSON.stringify(left.parts), JSON.stringify(right.parts));
  });
});

describe("loader-fantasy-cliffs / planCliffSides", () => {
  it("siempre devuelve ambos extremos", () => {
    for (let s = 0; s < 20; s++) {
      assert.deepEqual(planCliffSides(s), { sides: ["left", "right"] });
    }
  });
});

describe("loader-fantasy-cliffs / validez", () => {
  it("isValidFantasyElement OK para 30 semillas (ambos tipos y lados)", () => {
    for (let s = 0; s < 30; s++) {
      for (const formationType of ["cliff", "rocks"]) {
        for (const side of ["left", "right"]) {
          const el = generateCliffs({ seed: s * 7 + 1, side, formationType });
          assert.ok(isValidFantasyElement(el), `${formationType} ${side} seed ${s}`);
          assert.equal(el.kind, "cliffs");
        }
      }
    }
  });

  it("ningún path contiene NaN", () => {
    for (let s = 0; s < 25; s++) {
      const el = generateCliffs({ seed: s, side: "left" });
      for (const part of el.parts) {
        assert.ok(!/NaN/.test(part.d), `seed ${s} part ${part.id}`);
      }
    }
  });
});

describe("loader-fantasy-cliffs / muro lateral", () => {
  it("masa exterior sangra fuera del viewBox (x<0 izq, x>100 der)", () => {
    const left = generateCliffs({ seed: 12, side: "left", formationType: "cliff" });
    const right = generateCliffs({ seed: 12, side: "right", formationType: "cliff" });
    const leftXs = left.parts.flatMap((p) => p.d.match(/-?[\d.]+/g)?.map(Number).filter((_, i) => i % 2 === 0) ?? []);
    const rightXs = right.parts.flatMap((p) => p.d.match(/-?[\d.]+/g)?.map(Number).filter((_, i) => i % 2 === 0) ?? []);
    assert.ok(leftXs.some((x) => x < -2), "muro izquierdo debe extenderse fuera de pantalla");
    assert.ok(rightXs.some((x) => x > 102), "muro derecho debe extenderse fuera de pantalla");
  });

  it("sin tramos verticales largos en las siluetas", () => {
    for (let s = 0; s < 25; s++) {
      const el = generateCliffs({ seed: s * 5, side: "left" });
      for (const part of el.parts) {
        if (part.role === "plinth") continue;
        assert.ok(
          maxVerticalSpanInPath(part.d) < 16,
          `seed ${s} part ${part.id}: tramo vertical demasiado largo`,
        );
      }
    }
  });
});

describe("loader-fantasy-cliffs / cliff vs rocks", () => {
  it("cliff: una sola pieza maciza (sin talus ni repisas sueltas)", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCliffs({ seed: s * 11, side: "left", formationType: "cliff" });
      const solids = el.parts.filter((p) => !p.stroke);
      assert.equal(solids.length, 1, `seed ${s}`);
      assert.equal(solids[0].role, "cliff");
    }
  });

  it("sin zócalo plinth", () => {
    const el = generateCliffs({ seed: 333, side: "left", formationType: "cliff" });
    assert.ok(!el.parts.some((p) => p.role === "plinth"));
  });

  it("ninguna pieza sobresale del perfil del muro", () => {
    for (let s = 0; s < 30; s++) {
      for (const formationType of ["cliff", "rocks"]) {
        const el = generateCliffs({ seed: s * 9, side: "left", formationType });
        const xs = el.parts.flatMap(
          (p) => p.d.match(/-?[\d.]+/g)?.map(Number).filter((_, i) => i % 2 === 0) ?? [],
        );
        const inner = xs.filter((x) => x > 0);
        if (inner.length === 0) continue;
        const maxInner = Math.max(...inner);
        const minInner = Math.min(...inner);
        assert.ok(maxInner - minInner < 55, `${formationType} seed ${s}: perfil demasiado irregular`);
        assert.ok(maxInner <= 100, `${formationType} seed ${s}: pico ${maxInner}`);
      }
    }
  });

  it("perfil interior monótono en x (sin picos)", () => {
    const rng = () => 0.5;
    const profile = buildInnerFaceProfile(rng, 20, 80, 12);
    for (let i = 1; i < profile.length; i++) {
      assert.ok(profile[i].y >= profile[i - 1].y);
      assert.ok(profile[i].x <= 20.01);
      assert.ok(profile[i].x >= 0);
    }
  });

  it("rocks: al menos 6 piezas apiladas con buildSequence creciente", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCliffs({ seed: s * 13 + 5, side: "right", formationType: "rocks" });
      const rocks = el.parts.filter((p) => p.role === "rock");
      assert.ok(rocks.length >= 6, `seed ${s}: solo ${rocks.length} rocas`);
      const seqs = rocks.map((p) => p.buildSequence ?? 0);
      for (let i = 1; i < seqs.length; i++) {
        assert.ok(seqs[i] > seqs[i - 1], `buildSequence no crece en seed ${s}`);
      }
    }
  });
});

describe("loader-fantasy-cliffs / ciclo de vida", () => {
  it("cliffs tienen hold y erosión más largos que castillos", () => {
    const cliff = planLifecycleTiming(42, "cliffs", 8);
    const castle = planLifecycleTiming(42, "castle", 8);
    assert.ok(cliff.holdMs > castle.holdMs);
    assert.ok(cliff.erodeMs > castle.erodeMs);
  });
});

describe("loader-fantasy-cliffs / variación", () => {
  it("40 seeds cliff producen siluetas mayoritariamente distintas", () => {
    const set = new Set();
    for (let s = 0; s < 40; s++) {
      set.add(JSON.stringify(generateCliffs({ seed: s, side: "left", formationType: "cliff" }).parts));
    }
    assert.ok(set.size >= 35);
  });

  it("mezcla aleatoria cliff/rocks según semilla", () => {
    const types = new Set();
    for (let s = 0; s < 40; s++) {
      types.add(generateCliffs({ seed: s * 3, side: "right" }).meta.formationType);
    }
    assert.ok(types.has("cliff"));
    assert.ok(types.has("rocks"));
  });
});

describe("loader-fantasy-cliffs / registro motor", () => {
  it("generateFantasyElement('cliffs') devuelve elemento válido", () => {
    const el = generateFantasyElement("cliffs", { seed: 42, side: "left" });
    assert.ok(el);
    assert.ok(isValidFantasyElement(el));
    assert.equal(el.meta.side, "left");
    assert.equal(el.meta.normalizeMode, "wallSeam");
  });
});
