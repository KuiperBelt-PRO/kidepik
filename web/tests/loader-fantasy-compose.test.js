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
import { createRng } from "../js/components/loader-ship-rng.js";
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
  it("grafo élfico tiene podio, dos torres de flanco y corona central", () => {
    const rng = createRng(99);
    const g = planElfCastleGraph({ seed: 99, ruined: false }, rng);
    assert.equal(g.meta.faction, "elf");
    assert.equal(g.meta.composeMode, "graph");
    assert.ok(g.nodes.some((n) => n.module === "elf.podium"));
    assert.equal(g.nodes.filter((n) => n.module === "elf.tower_flank").length, 2);
    assert.ok(g.nodes.some((n) => n.module === "elf.slab_crown"));
    assert.equal(g.nodes.filter((n) => n.module === "elf.tower_central").length, 0);
  });

  it("castillo élfico vía grafo es válido y determinista", () => {
    const a = generateCastle({ seed: 4242, faction: "elf" });
    const b = generateCastle({ seed: 4242, faction: "elf" });
    assert.ok(isValidFantasyElement(a));
    assert.equal(a.meta.composeMode, "graph");
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.ok(a.parts.filter((p) => p.role === "tower").length >= 2);
    assert.ok(a.parts.some((p) => p.role === "plinth"), "elfos sin zócalo");
    const hasArrow = a.parts.filter((p) => p.role === "decoration").length >= 5;
    assert.ok(hasArrow, "pocas piezas decorativas en torre élfica");
  });

  it("torres élficas son esbeltas (ancho local bajo)", () => {
    const el = generateCastle({ seed: 77, faction: "elf" });
    const towers = el.parts.filter((p) => p.role === "tower");
    for (const t of towers) {
      const w = t.d.match(/[\d.]+/g)?.map(Number) ?? [];
      const xs = [];
      for (let i = 0; i < w.length; i += 2) xs.push(w[i]);
      const width = xs.length ? Math.max(...xs) - Math.min(...xs) : 100;
      assert.ok(width < 10, `torre demasiado ancha: ${width}`);
    }
  });
});
