import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  anchorCrystalToRock,
  buildCrystalAt,
  buildElongatedHexCrystal,
  buildIrregularRock,
  crystalParts,
  crystalPlantLine,
  generateCrystals,
  planCrystalStyle,
  rockCrestYAt,
  rockTopYAt,
  rotatePoints,
} from "../js/components/loader-fantasy-crystals.js";
import {
  generateFantasyElement,
  isValidFantasyElement,
  planLifecycleTiming,
} from "../js/components/loader-fantasy-element.js";
import { erosionMaskNoiseParams } from "../js/components/loader-fantasy-render.js";
import { createRng } from "../js/components/loader-ship-rng.js";

/** @param {import('../js/components/loader-fantasy-element.js').FantasyElement} el */
function rockBasePart(el) {
  const part = el.parts.find((p) => p.role === "rock_base");
  assert.ok(part);
  return part;
}

/** @param {import('../js/components/loader-fantasy-element.js').FantasyPart} part */
function minYInPath(part) {
  const nums = part.d.match(/-?[\d.]+/g)?.map(Number) ?? [];
  let minY = Infinity;
  for (let i = 1; i < nums.length; i += 2) {
    minY = Math.min(minY, nums[i]);
  }
  return minY;
}

describe("loader-fantasy-crystals / determinismo", () => {
  it("misma seed → mismo clúster", () => {
    const a = generateCrystals({ seed: 9001, style: "shard" });
    const b = generateCrystals({ seed: 9001, style: "shard" });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("seeds distintas → clústeres distintos", () => {
    const hashes = new Set();
    for (let s = 1; s <= 40; s++) {
      const el = generateCrystals({ seed: s * 17 });
      hashes.add(el.parts.map((p) => p.d).join("|"));
    }
    assert.ok(hashes.size >= 30);
  });
});

describe("loader-fantasy-crystals / validez", () => {
  it("isValidFantasyElement OK para 30+ semillas", () => {
    for (let s = 0; s < 35; s++) {
      const el = generateCrystals({ seed: s * 13 + 7 });
      assert.ok(isValidFantasyElement(el), `seed ${s}`);
      assert.equal(el.kind, "crystals");
    }
  });

  it("generateFantasyElement registra crystals", () => {
    const el = generateFantasyElement("crystals", { seed: 42 });
    assert.ok(el);
    assert.equal(el.kind, "crystals");
  });
});

describe("loader-fantasy-crystals / estructura", () => {
  it("exactamente 1 rock_base y 4–10 cristales hexagonales", () => {
    for (let s = 0; s < 25; s++) {
      const el = generateCrystals({ seed: s + 100 });
      const bases = el.parts.filter((p) => p.role === "rock_base");
      const crystals = crystalParts(el);
      assert.equal(bases.length, 1, `seed ${s}`);
      assert.ok(crystals.length >= 4, `seed ${s}`);
      assert.ok(crystals.length <= 10, `seed ${s}`);
      assert.equal(el.meta.crystalCount, crystals.length);
    }
  });

  it("cada cristal tiene path cerrado válido", () => {
    const el = generateCrystals({ seed: 555 });
    for (const part of crystalParts(el)) {
      assert.ok(part.d.includes("M"));
      assert.ok(part.d.includes("Z") || part.d.includes("z"));
    }
  });

  it("planCrystalStyle reparte los 3 estilos (60 seeds)", () => {
    /** @type {Record<string, number>} */
    const counts = { shard: 0, geode: 0, floatingShards: 0 };
    for (let s = 0; s < 60; s++) {
      counts[planCrystalStyle(s)] += 1;
    }
    for (const style of Object.keys(counts)) {
      assert.ok(counts[style] >= 6, style);
    }
  });

  it("cristales anclados en la cresta de la roca (sin flotar)", () => {
    let ok = 0;
    for (let s = 0; s < 30; s++) {
      const el = generateCrystals({ seed: s + 300, style: "shard" });
      const rock = rockBasePart(el);
      const crestY = minYInPath(rock);
      const rooted = crystalParts(el).filter((p) => p.baseY >= crestY - 0.5);
      if (rooted.length === el.meta.crystalCount) ok += 1;
    }
    assert.ok(ok >= 28);
  });

  it("rock_base construye primero", () => {
    for (let s = 0; s < 15; s++) {
      const el = generateCrystals({ seed: s + 200 });
      const rock = el.parts.find((p) => p.role === "rock_base");
      assert.ok(rock);
      for (const crystal of crystalParts(el)) {
        assert.ok(
          (rock.buildSequence ?? 0) < (crystal.buildSequence ?? 0),
          `seed ${s}`,
        );
      }
    }
  });
});

describe("loader-fantasy-crystals / geometría hexagonal", () => {
  it("buildElongatedHexCrystal tiene 6 vértices", () => {
    const hex = buildElongatedHexCrystal(20, 5, 30, 4, 4);
    assert.equal(hex.length, 6);
  });

  it("hexágono alargado: dos lados largos paralelos y cuatro cortos", () => {
    const hw = 5;
    const cap = 4;
    const height = 40;
    const hex = buildElongatedHexCrystal(0, 0, height, hw, cap);

    const rightLong = hex.filter((p) => Math.abs(p.x - hw) < 0.01);
    const leftLong = hex.filter((p) => Math.abs(p.x + hw) < 0.01);
    assert.equal(rightLong.length, 2);
    assert.equal(leftLong.length, 2);

    const longSpan = Math.abs(rightLong[0].y - rightLong[1].y);
    assert.ok(longSpan > height * 0.55, "caras largas deben dominar la altura");

    const apexTop = hex.find((p) => p.x === 0 && p.y === height);
    const apexBot = hex.find((p) => p.x === 0 && p.y === 0);
    assert.ok(apexTop);
    assert.ok(apexBot);
  });

  it("hexágono alargado: dos lados largos dominan la altura", () => {
    const hex = buildElongatedHexCrystal(0, 0, 40, 3, 5);
    const ys = hex.map((p) => p.y);
    const xs = hex.map((p) => p.x);
    const h = Math.max(...ys) - Math.min(...ys);
    const w = Math.max(...xs) - Math.min(...xs);
    assert.ok(h > w * 2.5);
  });

  it("anchorCrystalToRock inserta por la base ancha, no solo la punta", () => {
    const rng = createRng(11);
    const { outer: rockOuter } = buildIrregularRock(rng, 40, 12);
    const cx = 20;
    const crestY = rockTopYAt(rockOuter, cx);
    let crystal = buildElongatedHexCrystal(cx, crestY, 28, 4, 3);
    crystal = rotatePoints(crystal, cx, crestY, 18);
    const anchored = anchorCrystalToRock(crystal, rockOuter, 2);
    const { plantY, plantX, apexY, apexX } = crystalPlantLine(anchored);
    const surfaceY = rockTopYAt(rockOuter, plantX);
    assert.ok(Math.abs(plantY - (surfaceY - 2)) < 0.05);
    assert.ok(apexY < surfaceY - 1, "la punta inferior queda dentro del macizo rocoso");
    assert.ok(apexY < rockTopYAt(rockOuter, apexX) - 0.5);
  });

  it("buildCrystalAt aplica inclinación", () => {
    const rng = createRng(7);
    const rng2 = createRng(7);
    const { outer: rockOuter } = buildIrregularRock(createRng(3), 40, 10);
    const flat = buildCrystalAt(rng, 10, 6, 25, 3, 0, rockOuter);
    const tilted = buildCrystalAt(rng2, 10, 6, 25, 3, 20, rockOuter);
    assert.notDeepEqual(flat, tilted);
  });

  it("rotatePoints conserva el pivote", () => {
    const pts = buildElongatedHexCrystal(12, 4, 20, 3, 3);
    const rotated = rotatePoints(pts, 12, 4, 15);
    const pivot = rotated.find((p) => Math.abs(p.x - 12) < 0.01 && Math.abs(p.y - 4) < 0.01);
    assert.ok(pivot);
  });

  it("rockCrestYAt interpola la cresta", () => {
    const rng = createRng(3);
    const { crestPts } = buildIrregularRock(rng, 40, 10);
    const mid = crestPts[Math.floor(crestPts.length / 2)];
    const y = rockCrestYAt(crestPts, mid.x);
    assert.ok(Math.abs(y - mid.y) < 0.01);
  });

  it("cristales del clúster tienen longitudes variables", () => {
    const el = generateCrystals({ seed: 4242, style: "shard" });
    const heights = crystalParts(el).map((part) => {
      const nums = part.d.match(/-?[\d.]+/g)?.map(Number) ?? [];
      const ys = nums.filter((_, i) => i % 2 === 1);
      return Math.max(...ys) - Math.min(...ys);
    });
    const minH = Math.min(...heights);
    const maxH = Math.max(...heights);
    assert.ok(maxH > minH * 1.45);
  });

  it("planLifecycleTiming crystals en rango de spec", () => {
    const t = planLifecycleTiming(77, "crystals", 8);
    assert.ok(t.partDurationMs >= 160 && t.partDurationMs <= 280);
    assert.ok(t.holdMs >= 2500 && t.holdMs <= 4500);
    assert.ok(t.erodeMs >= 1400 && t.erodeMs <= 2000);
  });

  it("erosionMaskNoiseParams más fino para crystals", () => {
    const base = erosionMaskNoiseParams(42);
    const fine = erosionMaskNoiseParams(42, "crystals");
    const baseFreq = parseFloat(base.baseFrequency.split(" ")[0]);
    const fineFreq = parseFloat(fine.baseFrequency.split(" ")[0]);
    assert.ok(fineFreq > baseFreq);
  });
});

describe("loader-fantasy-crystals / estilos", () => {
  it("geode tiene más cristales que shard a igual seed base", () => {
    const shard = generateCrystals({ seed: 12, style: "shard" });
    const geode = generateCrystals({ seed: 12, style: "geode" });
    assert.ok(geode.meta.crystalCount >= shard.meta.crystalCount);
  });
});
