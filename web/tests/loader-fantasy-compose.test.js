import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addNode,
  createGraph,
  executeGraph,
  sortGraphNodes,
} from "../js/components/loader-fantasy-compose.js";
import { generateCastle } from "../js/components/loader-fantasy-castle.js";
import { planElfCastleGraph } from "../js/components/loader-fantasy-elf-graph.js";
import { ensureModulesRegistered } from "../js/components/loader-fantasy-modules.js";
import { ElementAssembler } from "../js/components/loader-fantasy-element.js";
import { getFactionProfile } from "../js/components/loader-fantasy-castle-factions.js";
import { createRng, mixFantasySeed } from "../js/components/loader-ship-rng.js";
import { isValidFantasyElement } from "../js/components/loader-fantasy-element.js";

describe("loader-fantasy-compose / grafo", () => {
  it("sortGraphNodes respeta after y order", () => {
    const nodes = [
      { id: "c", module: "x", cx: 0, baseY: 0, order: 30, after: ["b"] },
      { id: "a", module: "x", cx: 0, baseY: 0, order: 0 },
      { id: "b", module: "x", cx: 0, baseY: 0, order: 10, after: ["a"] },
    ];
    const sorted = sortGraphNodes(nodes);
    assert.deepEqual(sorted.map((n) => n.id), ["a", "b", "c"]);
  });

  it("executeGraph emite partes registradas", () => {
    ensureModulesRegistered();
    const rng = createRng(42);
    const graph = createGraph();
    addNode(graph, {
      id: "plinth",
      module: "core.plinth",
      cx: 50,
      baseY: -10,
      params: { w: 60, h: 12 },
      order: 0,
    });
    addNode(graph, {
      id: "deck",
      module: "elf.deck",
      cx: 50,
      baseY: 0,
      params: { w: 50, h: 14 },
      order: 10,
      after: ["plinth"],
    });
    const asm = new ElementAssembler();
    const profile = getFactionProfile("elf");
    executeGraph(graph, {
      rng,
      profile,
      imperfection: 0.5,
      jitterAmt: 0.3,
      ruined: false,
      palace: false,
      asm,
      arches: { gothic: 0, romanesque: 0, flat: 0, trefoil: 0 },
      counters: { doorCount: 0, windowCount: 0, slitCount: 0 },
    });
    const el = asm.build("castle", 42, "white", {});
    assert.ok(el.parts.some((p) => p.role === "plinth"));
    assert.ok(el.parts.some((p) => p.role === "base" || p.role === "decoration"));
  });
});

describe("loader-fantasy-elf-graph / planificación", () => {
  it("grafo élfico (fase 5): puerta, arcadas, tejados y torres sobre tejados", () => {
    const rng = createRng(99);
    const g = planElfCastleGraph({ seed: 99, ruined: false }, rng);
    assert.equal(g.meta.faction, "elf");
    assert.equal(g.meta.composeMode, "graph");
    assert.equal(g.meta.elfRebuildPhase, 5);
    assert.equal(g.nodes.length, 4);
    assert.equal(g.nodes[3].module, "elf.roof_towers");
    assert.ok(g.meta.towerCount >= 1 && g.meta.towerCount <= 3);
  });

  it("castillo élfico vía grafo es válido y determinista", () => {
    const a = generateCastle({ seed: 4242, faction: "elf" });
    const b = generateCastle({ seed: 4242, faction: "elf" });
    assert.ok(isValidFantasyElement(a));
    assert.equal(a.meta.composeMode, "graph");
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.equal(a.parts.filter((p) => p.role === "plinth").length, 1);
    assert.ok(a.parts.filter((p) => p.stroke).length > 11);
    assert.ok(a.meta.towerCount >= 1 && a.meta.towerCount <= 3);
    assert.ok(a.meta.doorCount >= 1);
    assert.ok(a.meta.arches.gothic >= 11);
  });

  it("elfos: torres sobre tejados con buildSequence >= 3", () => {
    const el = generateCastle({ seed: 77, faction: "elf" });
    const plinth = el.parts.find((p) => p.role === "plinth");
    const strokes = el.parts.filter((p) => p.stroke);
    assert.ok(plinth);
    assert.ok(strokes.length > 11);
    assert.ok(el.meta.towerCount >= 1 && el.meta.towerCount <= 3);
    const towerStrokes = strokes.filter((p) => p.buildOrder >= 3);
    assert.ok(towerStrokes.length > 4, "torres con trazos propios");
    assert.ok(strokes.every((p) => p.buildOrder > plinth.buildOrder));
  });

  it("elfos: towerCount del castillo coincide con el grafo (sin style, como dev URL)", () => {
    const elfRng = createRng(mixFantasySeed(77, 0));
    elfRng(); // pickStyle implícito cuando no hay style en la URL
    const graph = planElfCastleGraph({ seed: 77, variant: 0, ruined: false }, elfRng);
    const el = generateCastle({ seed: 77, faction: "elf", variant: 0 });
    assert.equal(el.meta.towerCount, graph.meta.towerCount);
    assert.deepEqual(
      (el.meta.towerXs ?? []).map((x) => x.toFixed(2)),
      (graph.meta.towerXs ?? []).map((x) => x.toFixed(2)),
    );
  });

  it("elfos: variant distinto altera torres y arcos con la misma seed base", () => {
    /** @param {import('../js/components/loader-fantasy-element.js').FantasyElement} el */
    const signature = (el) => JSON.stringify({
      tc: el.meta.towerCount,
      doorH: el.meta.doorH?.toFixed(2),
      flank: el.meta.flankArchH?.toFixed(2),
      roof: el.meta.roofHRatio?.toFixed(3),
      xs: (el.meta.towerXs ?? []).map((x) => x.toFixed(1)),
      ws: (el.meta.towerWs ?? []).map((w) => w.toFixed(1)),
    });
    const variants = [0, 1, 2, 3, 4, 5].map((v) =>
      signature(generateCastle({ seed: 77, faction: "elf", variant: v })));
    const unique = new Set(variants);
    assert.ok(unique.size >= 4, `pocas variantes distintas con seed 77: ${unique.size}`);
    assert.equal(
      signature(generateCastle({ seed: 77, faction: "elf", variant: 2 })),
      variants[2],
      "misma variant debe ser reproducible",
    );
  });

  it("elfos: posiciones de torre varían entre seeds", () => {
    /** @type {Set<string>} */
    const signatures = new Set();
    for (let s = 0; s < 40; s++) {
      const el = generateCastle({ seed: s, faction: "elf" });
      signatures.add((el.meta.towerXs ?? []).map((x) => x.toFixed(1)).join("|"));
    }
    assert.ok(signatures.size >= 28, `pocas disposiciones distintas: ${signatures.size}`);
  });
});
