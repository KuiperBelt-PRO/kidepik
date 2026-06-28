import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateCastle } from "../js/components/loader-fantasy-castle.js";
import {
  generateFantasyElement,
  isValidFantasyElement,
} from "../js/components/loader-fantasy-element.js";

const REMATE_KINDS = ["roof", "battlement", "dome"];

/** Roles que coronan torres/bloques. */
const CAP_ROLES = new Set(["roof", "battlement", "dome"]);

// ---------------------------------------------------------------------------
// Determinismo
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / determinismo", () => {
  it("misma seed → mismo elemento (parts d idénticos)", () => {
    const a = generateCastle({ seed: 1234 });
    const b = generateCastle({ seed: 1234 });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("misma seed + palace → mismo elemento", () => {
    const a = generateCastle({ seed: 99, palace: true });
    const b = generateCastle({ seed: 99, palace: true });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("castle y palace con misma seed difieren", () => {
    const c = generateCastle({ seed: 77 });
    const p = generateCastle({ seed: 77, palace: true });
    assert.notEqual(JSON.stringify(c.parts), JSON.stringify(p.parts));
  });
});

// ---------------------------------------------------------------------------
// Variación
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / variación", () => {
  it("50 seeds producen siluetas mayoritariamente distintas", () => {
    const set = new Set();
    for (let s = 0; s < 50; s++) {
      set.add(JSON.stringify(generateCastle({ seed: s * 101 + 7 }).parts));
    }
    assert.ok(set.size >= 45, `solo ${set.size} siluetas distintas`);
  });

  it("varían los skylines (nº de torres no es constante)", () => {
    const counts = new Set();
    for (let s = 0; s < 40; s++) {
      counts.add(generateCastle({ seed: s * 31 + 3 }).meta.towerCount);
    }
    assert.ok(counts.size >= 2, "el nº de torres no varía");
  });
});

// ---------------------------------------------------------------------------
// Validez
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / validez", () => {
  it("isValidFantasyElement OK para 30 seeds (castle y palace)", () => {
    for (let s = 0; s < 30; s++) {
      assert.ok(isValidFantasyElement(generateCastle({ seed: s })), `castle seed ${s}`);
      assert.ok(isValidFantasyElement(generateCastle({ seed: s, palace: true })), `palace seed ${s}`);
    }
  });

  it("ningún path contiene NaN y todos empiezan con M", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 13 });
      for (const part of el.parts) {
        assert.ok(part.d.startsWith("M"), `part ${part.id} no empieza con M`);
        assert.ok(!/NaN/.test(part.d), `part ${part.id} contiene NaN`);
      }
    }
  });

  it("viewBox y kind correctos (castle/palace)", () => {
    const c = generateCastle({ seed: 5 });
    assert.equal(c.viewBox, "0 0 100 100");
    assert.equal(c.kind, "castle");
    const p = generateCastle({ seed: 5, palace: true });
    assert.equal(p.kind, "palace");
  });
});

// ---------------------------------------------------------------------------
// Invariantes de castillo
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / invariantes", () => {
  it("existe exactamente una base", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 7 + 1 });
      const bases = el.parts.filter((p) => p.role === "base");
      assert.equal(bases.length, 1, `seed ${s}: ${bases.length} bases`);
    }
  });

  it("hay 2–5 torres y meta coherente", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 17 + 2 });
      const towers = el.parts.filter((p) => p.role === "tower");
      assert.ok(towers.length >= 2 && towers.length <= 5, `seed ${s}: ${towers.length} torres`);
      assert.equal(el.meta.towerCount, towers.length);
      assert.equal(el.meta.towers.length, towers.length);
    }
  });

  it("cada torre tiene un remate ∈ {roof, battlement, dome}", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 5 + 9 });
      for (const t of el.meta.towers) {
        assert.ok(REMATE_KINDS.includes(t.remate), `seed ${s}: remate inválido ${t.remate}`);
      }
      // Hay al menos tantas piezas de coronación como torres
      const caps = el.parts.filter((p) => CAP_ROLES.has(p.role));
      assert.ok(caps.length >= el.meta.towerCount, `seed ${s}: ${caps.length} remates < ${el.meta.towerCount} torres`);
    }
  });

  it("≥1 puerta y ≥1 ventana", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 3 + 4 });
      assert.ok(el.meta.doorCount >= 1, `seed ${s}: sin puerta`);
      assert.ok(el.meta.windowCount >= 1, `seed ${s}: sin ventanas`);
    }
  });

  it("usa ≥1 arco del tipo dominante", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 11 + 6 });
      const dom = el.meta.archDominant;
      assert.ok(["gothic", "romanesque"].includes(dom), `seed ${s}: dominante ${dom}`);
      assert.ok(el.meta.arches[dom] >= 1, `seed ${s}: 0 arcos ${dom}`);
    }
  });

  it("asimetría supera umbral en la mayoría de seeds", () => {
    let asym = 0;
    const N = 50;
    for (let s = 0; s < N; s++) {
      if (generateCastle({ seed: s * 23 + 1 }).meta.asymmetry > 0.12) asym++;
    }
    assert.ok(asym >= N * 0.7, `solo ${asym}/${N} con asimetría suficiente`);
  });
});

// ---------------------------------------------------------------------------
// Orden de construcción
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / build order", () => {
  it("buildOrder monótono con baseY descendente", () => {
    const el = generateCastle({ seed: 321 });
    for (let i = 1; i < el.parts.length; i++) {
      assert.ok(el.parts[i].baseY <= el.parts[i - 1].baseY + 1e-9, "no monótono");
      assert.equal(el.parts[i].buildOrder, i);
    }
  });

  it("base se construye antes que cualquier torre", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCastle({ seed: s * 19 + 2 });
      const base = el.parts.find((p) => p.role === "base");
      const towerOrders = el.parts.filter((p) => p.role === "tower").map((p) => p.buildOrder);
      assert.ok(towerOrders.every((o) => base.buildOrder < o), `seed ${s}: base no precede a torres`);
    }
  });

  it("las coronaciones se construyen después de las torres", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCastle({ seed: s * 29 + 5 });
      const maxTower = Math.max(...el.parts.filter((p) => p.role === "tower").map((p) => p.buildOrder));
      const caps = el.parts.filter((p) => CAP_ROLES.has(p.role));
      // Al menos una coronación va después de la última torre
      assert.ok(caps.some((c) => c.buildOrder > maxTower), `seed ${s}: ninguna coronación tras torres`);
    }
  });
});

// ---------------------------------------------------------------------------
// palace vs castle (estadístico)
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / palace vs castle", () => {
  function aggregate(palace) {
    const acc = { dome: 0, battlement: 0, roof: 0, gothic: 0, romanesque: 0, trefoil: 0, flat: 0 };
    for (let s = 0; s < 80; s++) {
      const el = generateCastle({ seed: s * 37 + 13, palace });
      for (const t of el.meta.towers) acc[t.remate]++;
      for (const k of Object.keys(el.meta.arches)) acc[k] += el.meta.arches[k];
    }
    return acc;
  }

  it("palace tiene más cúpulas que castle", () => {
    assert.ok(aggregate(true).dome > aggregate(false).dome);
  });

  it("castle tiene más almenas que palace", () => {
    assert.ok(aggregate(false).battlement > aggregate(true).battlement);
  });

  it("palace tiene más arcos góticos+trilobulados que castle", () => {
    const p = aggregate(true);
    const c = aggregate(false);
    assert.ok(p.gothic + p.trefoil > c.gothic + c.trefoil);
  });
});

// ---------------------------------------------------------------------------
// Registro en el motor
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / registro en el motor", () => {
  it("generateFantasyElement('castle') y ('palace') funcionan", () => {
    const c = generateFantasyElement("castle", { seed: 42 });
    assert.ok(isValidFantasyElement(c));
    assert.equal(c.kind, "castle");
    const p = generateFantasyElement("palace", { seed: 42 });
    assert.ok(isValidFantasyElement(p));
    assert.equal(p.kind, "palace");
  });
});
