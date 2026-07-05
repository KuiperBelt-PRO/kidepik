import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TREE_SPECIES,
  TREE_SPECIES_POOL,
  TREE_SIZE_FACTOR,
  TRUNK_WIDTH_FACTOR,
  buildCanopyOuters,
  buildOrganicCrown,
  buildTrunkOuter,
  generateTree,
} from "../js/components/loader-fantasy-trees.js";
import { createRng } from "../js/components/loader-ship-rng.js";

describe("loader-fantasy-trees / especies", () => {
  it("cada especie define tronco y copa", () => {
    for (const species of TREE_SPECIES_POOL) {
      assert.ok(TREE_SPECIES[species].trunk);
      assert.ok(TREE_SPECIES[species].canopy);
    }
  });

  it("generateTree devuelve tronco + al menos una copa", () => {
    const rng = createRng(42);
    const tree = generateTree(rng, { species: "pine", cx: 40, baseY: 0 });
    assert.equal(tree.species, "pine");
    const trunks = tree.parts.filter((p) => p.role === "trunk");
    const canopies = tree.parts.filter((p) => p.role === "canopy");
    assert.equal(trunks.length, 1);
    assert.ok(canopies.length >= 1);
  });

  it("TREE_SIZE_FACTOR reduce la escala global", () => {
    assert.equal(TREE_SIZE_FACTOR, 0.25);
    assert.equal(TRUNK_WIDTH_FACTOR, 0.68);
    const ref = generateTree(createRng(99), { species: "pine", cx: 40, scale: 1 / TREE_SIZE_FACTOR });
    const tiny = generateTree(createRng(99), { species: "pine", cx: 40, scale: 1 });
    const refH = Math.max(...ref.parts[0].outer.map((p) => p.y)) - Math.min(...ref.parts[0].outer.map((p) => p.y));
    const tinyH = Math.max(...tiny.parts[0].outer.map((p) => p.y)) - Math.min(...tiny.parts[0].outer.map((p) => p.y));
    assert.ok(Math.abs(tinyH / refH - TREE_SIZE_FACTOR) < 0.08);
  });

  it("copas tienen buildSequence mayor que el tronco", () => {
    const tree = generateTree(createRng(7), { species: "oak", cx: 30 });
    const trunkSeq = tree.parts.find((p) => p.role === "trunk")?.buildSequence ?? 0;
    for (const canopy of tree.parts.filter((p) => p.role === "canopy")) {
      assert.ok(canopy.buildSequence > trunkSeq);
    }
  });
});

describe("loader-fantasy-trees / determinismo", () => {
  it("misma semilla y especie → mismo árbol", () => {
    const a = generateTree(createRng(100), { species: "holm_oak", cx: 22, scale: 1 });
    const b = generateTree(createRng(100), { species: "holm_oak", cx: 22, scale: 1 });
    assert.deepEqual(a.parts.map((p) => p.outer), b.parts.map((p) => p.outer));
  });

  it("especies distintas producen siluetas distintas", () => {
    const rngA = createRng(55);
    const rngB = createRng(55);
    const oak = generateTree(rngA, { species: "oak", cx: 50, scale: 1 / TREE_SIZE_FACTOR });
    const birch = generateTree(rngB, { species: "birch", cx: 50, scale: 1 / TREE_SIZE_FACTOR });
    assert.notDeepEqual(oak.parts[0].outer, birch.parts[0].outer);
    const oakCanopyW = Math.max(...oak.parts[1].outer.map((p) => p.x)) - Math.min(...oak.parts[1].outer.map((p) => p.x));
    const birchCanopyW = Math.max(...birch.parts[1].outer.map((p) => p.x)) - Math.min(...birch.parts[1].outer.map((p) => p.x));
    assert.ok(oakCanopyW > birchCanopyW * 1.15, "roble más ancho que abedul");
  });

  it("copa se superpone al tronco sin hueco visible", () => {
    for (const species of ["oak", "birch", "holm_oak"]) {
      const tree = generateTree(createRng(33), { species, cx: 40, scale: 1 / TREE_SIZE_FACTOR });
      const trunk = tree.parts.find((p) => p.role === "trunk");
      const canopies = tree.parts.filter((p) => p.role === "canopy");
      const trunkTop = Math.max(...trunk.outer.map((p) => p.y));
      const canopyLow = Math.min(...canopies.flatMap((c) => c.outer.map((p) => p.y)));
      assert.ok(
        canopyLow <= trunkTop + trunkTop * 0.02,
        `${species}: copa demasiado separada del tronco`,
      );
    }
  });
});

describe("loader-fantasy-trees / geometría", () => {
  it("buildTrunkOuter y buildCanopyOuters no devuelven vacío", () => {
    const rng = createRng(3);
    const trunk = buildTrunkOuter(rng, "straight", 50, 0, 20, 4);
    assert.ok(trunk.length >= 4);
    const canopies = buildCanopyOuters(createRng(3), "conical", 50, 18, 16, 22);
    assert.ok(canopies.length >= 3);
    for (const c of canopies) assert.ok(c.length >= 3);
  });

  it("todas las especies generan partes válidas", () => {
    for (const species of TREE_SPECIES_POOL) {
      const tree = generateTree(createRng(species.length * 17), { species, cx: 45 });
      assert.ok(tree.parts.length >= 2, species);
    }
  });

  it("buildOrganicCrown genera domo compacto con pocos vértices", () => {
    const crown = buildOrganicCrown(createRng(12), 50, 0, 20, 16, { lobes: 3 });
    assert.ok(crown.length >= 8 && crown.length <= 16);
    const xs = crown.map((p) => p.x);
    const ys = crown.map((p) => p.y);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 4);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 4);
  });

  it("roble usa como máximo dos masas de copa", () => {
    for (let s = 0; s < 20; s += 1) {
      const tree = generateTree(createRng(s + 40), { species: "oak", cx: 50 });
      assert.ok(tree.parts.filter((p) => p.role === "canopy").length <= 2);
    }
  });

  it("buildOrganicCrown tiene cúspide central elevada (no meseta superior)", () => {
    const crown = buildOrganicCrown(createRng(12), 50, 8, 20, 16, { crownStyle: "oak", lobes: 3 });
    const maxY = Math.max(...crown.map((p) => p.y));
    const center = crown.reduce((best, p) => (
      Math.abs(p.x - 50) < Math.abs(best.x - 50) ? p : best
    ), crown[0]);
    assert.ok(center.y >= maxY - 0.15, "el centro debe ser el punto más alto");
    const sidePts = crown.filter((p) => Math.abs(p.x - 50) > 4);
    assert.ok(center.y > Math.max(...sidePts.map((p) => p.y)) + 0.5);
    assert.ok(crown.some((p) => Math.abs(p.y - 8) < 0.2), "la base de la copa ancla en baseY");
  });

  it("holm_oak tiene copa abombada (vértice superior elevado)", () => {
    const tree = generateTree(createRng(21), { species: "holm_oak", cx: 40 });
    const canopy = tree.parts.find((p) => p.role === "canopy");
    assert.ok(canopy);
    assert.equal(canopy.smoothOutline, true);
    const maxY = Math.max(...canopy.outer.map((p) => p.y));
    const center = canopy.outer.reduce((best, p) => (
      Math.abs(p.x - 40) < Math.abs(best.x - 40) ? p : best
    ), canopy.outer[0]);
    assert.ok(center.y >= maxY - 0.2);
  });

  it("pino mantiene copa angular (sin smoothOutline)", () => {
    const tree = generateTree(createRng(21), { species: "pine", cx: 40 });
    for (const canopy of tree.parts.filter((p) => p.role === "canopy")) {
      assert.equal(canopy.smoothOutline, false);
    }
  });
});
