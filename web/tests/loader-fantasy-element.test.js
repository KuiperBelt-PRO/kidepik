import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  erosionThresholdAt,
  generateFantasyElement,
  isValidFantasyElement,
  planBuildOrder,
  planLifecycleTiming,
} from "../js/components/loader-fantasy-element.js";

// ---------------------------------------------------------------------------
// generateFantasyElement — builder 'block'
// ---------------------------------------------------------------------------
describe("loader-fantasy-element / generateFantasyElement('block')", () => {
  it("devuelve un FantasyElement con campos obligatorios", () => {
    const el = generateFantasyElement("block", { seed: 42 });
    assert.equal(el.kind, "block");
    assert.equal(el.seed, 42);
    assert.equal(el.viewBox, "0 0 100 100");
    assert.ok(Array.isArray(el.parts));
    assert.ok(el.parts.length >= 1);
    assert.ok(Number.isFinite(el.width));
    assert.ok(Number.isFinite(el.height));
    assert.ok(Number.isFinite(el.footprint));
  });

  it("determinista: misma semilla → misma salida", () => {
    const a = generateFantasyElement("block", { seed: 123 });
    const b = generateFantasyElement("block", { seed: 123 });
    assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
  });

  it("semillas distintas producen elementos distintos", () => {
    const a = generateFantasyElement("block", { seed: 1 });
    const b = generateFantasyElement("block", { seed: 9999 });
    assert.notDeepEqual(JSON.stringify(a.parts), JSON.stringify(b.parts));
  });

  it("todas las partes tienen id, role, d (no vacío), baseY, centerX, buildOrder", () => {
    const el = generateFantasyElement("block", { seed: 77 });
    for (const part of el.parts) {
      assert.ok(part.id, "id ausente");
      assert.ok(part.role, "role ausente");
      assert.ok(part.d && part.d.startsWith("M"), "d inválido");
      assert.ok(Number.isFinite(part.baseY), "baseY no es número");
      assert.ok(Number.isFinite(part.centerX), "centerX no es número");
      assert.ok(Number.isFinite(part.buildOrder), "buildOrder no es número");
    }
  });

  it("buildOrder asignados empezando desde 0 y sin saltos", () => {
    const el = generateFantasyElement("block", { seed: 5 });
    const orders = el.parts.map((p) => p.buildOrder).sort((a, b) => a - b);
    orders.forEach((o, i) => assert.equal(o, i));
  });

  it("las partes están ordenadas por buildOrder ascendente", () => {
    const el = generateFantasyElement("block", { seed: 33 });
    for (let i = 1; i < el.parts.length; i++) {
      assert.ok(el.parts[i].buildOrder >= el.parts[i - 1].buildOrder);
    }
  });

  it("lanza o devuelve null para kind desconocido", () => {
    try {
      const el = generateFantasyElement("kind_inexistente", { seed: 1 });
      assert.equal(el, null);
    } catch (e) {
      assert.ok(e instanceof Error);
    }
  });
});

// ---------------------------------------------------------------------------
// isValidFantasyElement
// ---------------------------------------------------------------------------
describe("loader-fantasy-element / isValidFantasyElement", () => {
  it("true para elemento generado válido", () => {
    const el = generateFantasyElement("block", { seed: 42 });
    assert.equal(isValidFantasyElement(el), true);
  });

  it("false para null / undefined", () => {
    assert.equal(isValidFantasyElement(null), false);
    assert.equal(isValidFantasyElement(undefined), false);
  });

  it("false si parts está vacío", () => {
    const el = generateFantasyElement("block", { seed: 42 });
    assert.equal(isValidFantasyElement({ ...el, parts: [] }), false);
  });

  it("false si viewBox es incorrecto", () => {
    const el = generateFantasyElement("block", { seed: 42 });
    assert.equal(isValidFantasyElement({ ...el, viewBox: "0 0 200 200" }), false);
  });

  it("false si falta kind", () => {
    const el = generateFantasyElement("block", { seed: 42 });
    const { kind, ...noKind } = el;
    assert.equal(isValidFantasyElement(noKind), false);
  });
});

// ---------------------------------------------------------------------------
// planBuildOrder
// ---------------------------------------------------------------------------
describe("loader-fantasy-element / planBuildOrder", () => {
  it("ordena partes por baseY descendente (suelo primero → mayor SVG y primero)", () => {
    const parts = [
      { id: "a", role: "tower", d: "M 0 0 Z", baseY: 30, centerX: 50, buildOrder: 0 },
      { id: "b", role: "base", d: "M 0 0 Z", baseY: 90, centerX: 50, buildOrder: 0 },
      { id: "c", role: "roof", d: "M 0 0 Z", baseY: 10, centerX: 50, buildOrder: 0 },
    ];
    const ordered = planBuildOrder(parts);
    assert.equal(ordered[0].id, "b"); // baseY 90 → primera (suelo)
    assert.equal(ordered[1].id, "a"); // baseY 30
    assert.equal(ordered[2].id, "c"); // baseY 10 → última (cima)
  });

  it("buildOrder numérico empieza en 0 y sube de 1 en 1", () => {
    const parts = [
      { id: "x", role: "a", d: "M 0 0 Z", baseY: 80, centerX: 50, buildOrder: 999 },
      { id: "y", role: "b", d: "M 0 0 Z", baseY: 40, centerX: 50, buildOrder: 999 },
    ];
    const ordered = planBuildOrder(parts);
    assert.equal(ordered[0].buildOrder, 0);
    assert.equal(ordered[1].buildOrder, 1);
  });

  it("no muta el array original", () => {
    const original = [
      { id: "a", role: "x", d: "M 0 0 Z", baseY: 20, centerX: 50, buildOrder: 0 },
      { id: "b", role: "y", d: "M 0 0 Z", baseY: 70, centerX: 50, buildOrder: 0 },
    ];
    const copy = [...original];
    planBuildOrder(original);
    assert.deepEqual(original.map((p) => p.id), copy.map((p) => p.id));
  });
});

// ---------------------------------------------------------------------------
// planLifecycleTiming
// ---------------------------------------------------------------------------
describe("loader-fantasy-element / planLifecycleTiming", () => {
  it("devuelve partDurationMs, holdMs, erodeMs, gapMs", () => {
    const t = planLifecycleTiming(42, "block", 1);
    assert.ok(Number.isFinite(t.partDurationMs));
    assert.ok(Number.isFinite(t.holdMs));
    assert.ok(Number.isFinite(t.erodeMs));
    assert.ok(Number.isFinite(t.gapMs));
  });

  it("partDurationMs en rango [580, 920]", () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = planLifecycleTiming(seed, "block", 1);
      assert.ok(t.partDurationMs >= 580 && t.partDurationMs <= 920, `partDurationMs=${t.partDurationMs}`);
    }
  });

  it("holdMs en rango [2000, 5500]", () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = planLifecycleTiming(seed, "block", 1);
      assert.ok(t.holdMs >= 2000 && t.holdMs <= 5500, `holdMs=${t.holdMs}`);
    }
  });

  it("erodeMs en rango [7000, 11000]", () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = planLifecycleTiming(seed, "block", 1);
      assert.ok(t.erodeMs >= 7000 && t.erodeMs <= 11000, `erodeMs=${t.erodeMs}`);
    }
  });

  it("gapMs en rango [300, 1400]", () => {
    for (let seed = 0; seed < 20; seed++) {
      const t = planLifecycleTiming(seed, "block", 1);
      assert.ok(t.gapMs >= 300 && t.gapMs <= 1400, `gapMs=${t.gapMs}`);
    }
  });

  it("determinista: misma semilla y kind → mismos valores", () => {
    const a = planLifecycleTiming(123, "block", 2);
    const b = planLifecycleTiming(123, "block", 2);
    assert.deepEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// erosionThresholdAt
// ---------------------------------------------------------------------------
describe("loader-fantasy-element / erosionThresholdAt", () => {
  it("devuelve 0 en t=0 y 1 en t=1", () => {
    assert.equal(erosionThresholdAt(0), 0);
    assert.equal(erosionThresholdAt(1), 1);
  });

  it("monotonamente creciente de 0 a 1", () => {
    let prev = 0;
    for (let i = 1; i <= 20; i++) {
      const val = erosionThresholdAt(i / 20);
      assert.ok(val >= prev - 1e-9, `no monótona en t=${i / 20}`);
      prev = val;
    }
  });

  it("siempre en rango [0, 1]", () => {
    for (let i = 0; i <= 20; i++) {
      const val = erosionThresholdAt(i / 20);
      assert.ok(val >= 0 && val <= 1, `fuera de rango en t=${i / 20}: val=${val}`);
    }
  });

  it("satura correctamente para t < 0 y t > 1", () => {
    assert.equal(erosionThresholdAt(-1, 1), 0);
    assert.equal(erosionThresholdAt(2, 1), 1);
  });

  it("con seed fija no es progreso lineal puro en t=0.5", () => {
    const mid = erosionThresholdAt(0.5, 404);
    assert.ok(Math.abs(mid - 0.5) > 0.03);
  });
});
