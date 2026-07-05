import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateCastle } from "../js/components/loader-fantasy-castle.js";
import {
  buildErosionSpeedSegments,
  erosionThresholdAt,
} from "../js/components/loader-fantasy-element.js";
import {
  castleBuildTimingProfile,
  erosionClipBoundsFromParts,
  erosionMaskNoiseParams,
  erosionMaskOffsetForThreshold,
  forestTreePivot,
  FOREST_TREE_STAGGER_MS,
  groupForestPartsByTree,
  planForestTreeBuildDelays,
  svgBoundsFromParts,
} from "../js/components/loader-fantasy-render.js";
import { generateForest } from "../js/components/loader-fantasy-forest.js";

describe("loader-fantasy-render / erosion mask", () => {
  it("offset 0 deja el castillo intacto y 1 lo borra", () => {
    assert.equal(erosionMaskOffsetForThreshold(0), "0");
    assert.equal(erosionMaskOffsetForThreshold(1), "1");
  });

  it("el offset crece con el umbral", () => {
    const a = Number(erosionMaskOffsetForThreshold(0.2));
    const b = Number(erosionMaskOffsetForThreshold(0.6));
    assert.ok(b > a);
  });

  it("ruido de máscara más irregular que la versión plana (mayor displacement)", () => {
    const p = erosionMaskNoiseParams(42);
    assert.ok(p.dispScale >= 38);
    assert.equal(p.numOctaves, 3);
    assert.ok(parseFloat(p.baseFrequency.split(" ")[0]) >= 0.028);
  });

  it("elfos: la máscara cubre todo el zócalo en todas las seeds", () => {
    for (let s = 0; s < 50; s++) {
      const el = generateCastle({ seed: s * 41 + 2, faction: "elf" });
      const bounds = erosionClipBoundsFromParts(el.parts);
      const plinth = el.parts.find((p) => p.role === "plinth");
      assert.ok(plinth, `seed ${s}: sin zócalo`);
      const plinthBounds = svgBoundsFromParts([plinth]);
      assert.ok(
        plinthBounds.minX >= bounds.x && plinthBounds.maxX <= bounds.x + bounds.width,
        `seed ${s}: zócalo [${plinthBounds.minX}, ${plinthBounds.maxX}] fuera de máscara [${bounds.x}, ${bounds.x + bounds.width}]`,
      );
    }
  });
});

describe("loader-fantasy-element / erosionThresholdAt variable", () => {
  it("misma seed → misma curva", () => {
    const samples = [0.1, 0.35, 0.7, 0.95].map((t) => erosionThresholdAt(t, 99));
    const again = [0.1, 0.35, 0.7, 0.95].map((t) => erosionThresholdAt(t, 99));
    assert.deepEqual(samples, again);
  });

  it("velocidad no uniforme: no coincide con progreso lineal puro", () => {
    const mid = erosionThresholdAt(0.5, 12345);
    assert.ok(Math.abs(mid - 0.5) > 0.04, `demasiado lineal: ${mid}`);
  });

  it("buildErosionSpeedSegments normaliza duraciones", () => {
    const segs = buildErosionSpeedSegments(7);
    const sum = segs.reduce((s, seg) => s + seg.dur, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.equal(segs.length, 6);
  });
});

describe("loader-fantasy-render / castleBuildTimingProfile", () => {
  it("elfos: trazos 30 % más lentos que el perfil base", () => {
    const elf = generateCastle({ seed: 1, faction: "elf" });
    const elfP = castleBuildTimingProfile(elf);
    assert.equal(elfP.strokeFactor, 0.15 * 1.3);
    assert.equal(elfP.strokeMinMs, Math.round(70 * 1.3));
  });

  it("humanos y enanos: bloques 65 % más rápidos", () => {
    const human = generateCastle({ seed: 2, faction: "human" });
    const dwarf = generateCastle({ seed: 2, faction: "dwarf" });
    const fastScale = 1 / 1.65;
    assert.ok(Math.abs(castleBuildTimingProfile(human).fillScale - fastScale) < 1e-9);
    assert.ok(Math.abs(castleBuildTimingProfile(dwarf).fillScale - fastScale) < 1e-9);
  });

  it("elfos: timing de construcción sin aceleración de bloques", () => {
    const elf = generateCastle({ seed: 2, faction: "elf" });
    assert.equal(castleBuildTimingProfile(elf).fillScale, 1);
  });
});

describe("loader-fantasy-render / bosques", () => {
  it("groupForestPartsByTree agrupa tronco y copas del mismo árbol", () => {
    const el = generateForest({ seed: 12, extent: "compact" });
    const groups = groupForestPartsByTree(el.parts);
    assert.equal(groups.length, el.meta.treeCount);
    for (const group of groups) {
      assert.ok(group.parts.some((p) => p.role === "trunk"));
      assert.ok(group.parts.some((p) => p.role === "canopy"));
      const roles = new Set(group.parts.map((p) => p.treeIndex));
      assert.equal(roles.size, 1);
    }
  });

  it("forestTreePivot usa el tronco como ancla horizontal", () => {
    const el = generateForest({ seed: 3 });
    const group = groupForestPartsByTree(el.parts)[0];
    const trunk = group.parts.find((p) => p.role === "trunk");
    const pivot = forestTreePivot(group.parts);
    assert.equal(pivot.pivotX, trunk?.centerX);
    assert.ok(pivot.pivotY >= trunk?.baseY ?? 0);
  });

  it("planForestTreeBuildDelays escalona el crecimiento", () => {
    const delays = planForestTreeBuildDelays(5);
    assert.deepEqual(delays, [0, FOREST_TREE_STAGGER_MS, FOREST_TREE_STAGGER_MS * 2, FOREST_TREE_STAGGER_MS * 3, FOREST_TREE_STAGGER_MS * 4]);
    assert.ok(FOREST_TREE_STAGGER_MS >= 40 && FOREST_TREE_STAGGER_MS <= 60);
  });
});
