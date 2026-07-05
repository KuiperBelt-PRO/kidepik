import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assignForestTreeSpecies,
  generateForest,
  planForestExtent,
  planForestSpeciesMix,
  planForestTreePositions,
  terrainAdjustedBaseY,
} from "../js/components/loader-fantasy-forest.js";
import {
  generateFantasyElement,
  isValidFantasyElement,
  planLifecycleTiming,
} from "../js/components/loader-fantasy-element.js";
import { buildTerrainProfile } from "../js/components/loader-fantasy-terrain.js";
import { createRng, mixFantasySeed } from "../js/components/loader-ship-rng.js";

describe("loader-fantasy-forest / determinismo", () => {
  it("misma seed → mismo bosque", () => {
    const a = generateForest({ seed: 4242, extent: "compact" });
    const b = generateForest({ seed: 4242, extent: "compact" });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("seeds distintas → bosques distintos", () => {
    const a = generateForest({ seed: 1 });
    const b = generateForest({ seed: 999 });
    assert.notEqual(JSON.stringify(a.parts), JSON.stringify(b.parts));
  });

  it("variant de semilla distinto → bosques distintos (misma base)", () => {
    const a = generateForest({ seed: mixFantasySeed(42, 0) });
    const b = generateForest({ seed: mixFantasySeed(42, 1) });
    assert.notEqual(JSON.stringify(a.parts), JSON.stringify(b.parts));
  });
});

describe("loader-fantasy-forest / validez", () => {
  it("isValidFantasyElement OK para 30 semillas", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateForest({ seed: s * 11 + 3 });
      assert.ok(isValidFantasyElement(el), `seed ${s}`);
      assert.equal(el.kind, "forest");
    }
  });

  it("ningún path contiene NaN", () => {
    for (let s = 0; s < 25; s++) {
      const el = generateForest({ seed: s });
      for (const part of el.parts) {
        assert.ok(!/NaN/.test(part.d), `seed ${s} part ${part.id}`);
      }
    }
  });
});

describe("loader-fantasy-forest / estructura", () => {
  it("cada árbol tiene tronco y copa(s)", () => {
    const el = generateForest({ seed: 88, extent: "compact" });
    const trunks = el.parts.filter((p) => p.role === "trunk");
    const canopies = el.parts.filter((p) => p.role === "canopy");
    assert.ok(trunks.length >= 14);
    assert.ok(canopies.length >= trunks.length);
    assert.equal(el.meta.treeCount, trunks.length);
  });

  it("extensive tiene muchos más árboles que compact", () => {
    const compact = generateForest({ seed: 5, extent: "compact" });
    const extensive = generateForest({ seed: 5, extent: "extensive" });
    assert.ok(compact.meta.treeCount >= 14);
    assert.ok(extensive.meta.treeCount >= 26);
    assert.ok(compact.meta.treeCount < extensive.meta.treeCount);
    assert.ok(compact.parts.length < extensive.parts.length);
  });

  it("planForestSpeciesMix devuelve 1–5 especies sin repetir", () => {
    const counts = new Set();
    for (let s = 0; s < 50; s++) {
      const mix = planForestSpeciesMix(s);
      assert.ok(mix.length >= 1 && mix.length <= 5);
      assert.equal(mix.length, new Set(mix).size);
      counts.add(mix.length);
    }
    assert.ok(counts.size >= 2, "debería variar el número de especies");
  });

  it("planForestTreePositions separa árboles", () => {
    const rng = createRng(77);
    const positions = planForestTreePositions(rng, 12, 80);
    assert.equal(positions.length, 12);
    for (let i = 1; i < positions.length; i += 1) {
      assert.ok(positions[i] >= positions[i - 1]);
    }
    const minGap = 80 * 0.024;
    let closePairs = 0;
    for (let i = 1; i < positions.length; i += 1) {
      if (positions[i] - positions[i - 1] < minGap) closePairs += 1;
    }
    assert.ok(closePairs <= 2, "la mayoría de pares deberían respetar separación mínima");
  });

  it("assignForestTreeSpecies reparte todas las especies del mix", () => {
    const mix = ["pine", "oak", "birch"];
    const assigned = assignForestTreeSpecies(mix, 12, 42);
    assert.equal(assigned.length, 12);
    for (const sp of mix) {
      assert.ok(assigned.includes(sp), `falta ${sp}`);
    }
  });

  it("assignForestTreeSpecies mezcla aleatoria (no solo round-robin)", () => {
    const mix = ["oak", "birch", "holm_oak"];
    const a = assignForestTreeSpecies(mix, 18, 100);
    const b = assignForestTreeSpecies(mix, 18, 101);
    assert.notDeepEqual(a, b);
  });

  it("planForestExtent alterna compact y extensive", () => {
    const extents = new Set();
    for (let s = 0; s < 40; s++) extents.add(planForestExtent(s));
    assert.ok(extents.has("compact"));
    assert.ok(extents.has("extensive"));
  });
});

describe("loader-fantasy-forest / build order", () => {
  it("bosque con 3 especies incluye caducifolios mezclados", () => {
    const el = generateForest({
      seed: 55,
      extent: "extensive",
      speciesMix: ["oak", "birch", "holm_oak"],
    });
    const assigned = /** @type {string[]} */ (el.meta?.treeSpeciesAssigned ?? []);
    assert.equal(assigned.length, el.meta.treeCount);
    for (const sp of ["oak", "birch", "holm_oak"]) {
      assert.ok(assigned.includes(sp), `falta ${sp} en asignación`);
    }
  });

  it("cada bosque puede tener una sola especie", () => {
    const el = generateForest({ seed: 42, speciesMix: ["pine"] });
    assert.deepEqual(el.meta?.speciesMix, ["pine"]);
  });

  it("copas no coníferas exportan path con curvas suaves", () => {
    const el = generateForest({ seed: 7, speciesMix: ["oak"], extent: "compact" });
    const canopy = el.parts.find((p) => p.role === "canopy");
    assert.ok(canopy?.d.includes(" C "), canopy?.d);
  });

  it("copas de pino mantienen vértices angulares (segmentos L)", () => {
    const el = generateForest({ seed: 7, speciesMix: ["pine"], extent: "compact" });
    const canopy = el.parts.find((p) => p.role === "canopy");
    assert.ok(canopy?.d.includes(" L "), canopy?.d);
    assert.ok(!canopy?.d.includes(" C "));
  });

  it("copas están por encima de troncos (menor baseY SVG = más arriba)", () => {
    const el = generateForest({ seed: 44 });
    const trunks = el.parts.filter((p) => p.role === "trunk");
    const canopies = el.parts.filter((p) => p.role === "canopy");
    const avgTrunkY = trunks.reduce((s, p) => s + p.baseY, 0) / trunks.length;
    const avgCanopyY = canopies.reduce((s, p) => s + p.baseY, 0) / canopies.length;
    assert.ok(avgCanopyY < avgTrunkY, "copas deben estar más arriba (menor baseY)");
  });
});

describe("loader-fantasy-forest / terreno", () => {
  it("terrainAdjustedBaseY sigue el perfil", () => {
    const profile = buildTerrainProfile(createRng(12));
    const center = terrainAdjustedBaseY(0, 50, 80, profile, 0.5);
    const left = terrainAdjustedBaseY(0, 10, 80, profile, 0.5);
    const right = terrainAdjustedBaseY(0, 70, 80, profile, 0.5);
    assert.notEqual(left, right);
    assert.ok(Math.abs(center - left) < 80);
    assert.ok(Math.abs(center - right) < 80);
  });

  it("con perfil de terreno los troncos no comparten todos la misma baseY", () => {
    const profile = buildTerrainProfile(createRng(99));
    const el = generateForest({
      seed: 77,
      extent: "extensive",
      terrainProfile: profile,
      forestCenterXNorm: 0.42,
    });
    const trunkYs = el.parts.filter((p) => p.role === "trunk").map((p) => p.baseY);
    const unique = new Set(trunkYs.map((y) => Math.round(y * 10)));
    assert.ok(unique.size >= 2, "pendiente del terreno debería variar baseY");
  });
});

describe("loader-fantasy-forest / ciclo de vida", () => {
  it("forest tiene ciclo prolongado (hold y erosión amplios)", () => {
    const forest = planLifecycleTiming(42, "forest", 12);
    const castle = planLifecycleTiming(42, "castle", 12);
    assert.ok(forest.holdMs >= 16000 && forest.holdMs <= 26000);
    assert.ok(forest.erodeMs >= 5500 && forest.erodeMs <= 9000);
    assert.ok(forest.holdMs > castle.holdMs * 2);
  });
});

describe("loader-fantasy-forest / registro motor", () => {
  it("generateFantasyElement('forest') devuelve elemento válido", () => {
    const el = generateFantasyElement("forest", { seed: 42 });
    assert.ok(el);
    assert.ok(isValidFantasyElement(el));
    assert.equal(el.meta.extent, planForestExtent(42));
  });
});
