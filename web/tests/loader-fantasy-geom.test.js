import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  arch,
  aperture,
  boundsOfFantasyGroups,
  buildPartPath,
  dome,
  gableRoof,
  jitterRing,
  merlons,
  normalizeFantasyGroups,
  pointsToPath,
  polygon,
  rect,
} from "../js/components/loader-fantasy-geom.js";
import { createRng } from "../js/components/loader-ship-rng.js";

// ---------------------------------------------------------------------------
// rect
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / rect", () => {
  it("devuelve 4 puntos", () => {
    assert.equal(rect(50, 0, 20, 30).length, 4);
  });

  it("ancho y alto correctos", () => {
    const pts = rect(50, 0, 20, 30);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    assert.equal(Math.max(...xs) - Math.min(...xs), 20);
    assert.equal(Math.max(...ys) - Math.min(...ys), 30);
  });

  it("base (baseY mínima) correcta", () => {
    const pts = rect(50, 10, 20, 30);
    assert.equal(Math.min(...pts.map((p) => p.y)), 10);
  });

  it("centrado en cx", () => {
    const pts = rect(40, 0, 20, 10);
    const xs = pts.map((p) => p.x);
    const center = (Math.min(...xs) + Math.max(...xs)) / 2;
    assert.ok(Math.abs(center - 40) < 0.01);
  });
});

// ---------------------------------------------------------------------------
// gableRoof
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / gableRoof", () => {
  it("triángulo: 3 puntos sin ridgeW", () => {
    assert.equal(gableRoof(50, 0, 30, 20).length, 3);
  });

  it("trapecio: 4 puntos con ridgeW > 0", () => {
    assert.equal(gableRoof(50, 0, 30, 20, { ridgeW: 8 }).length, 4);
  });

  it("altura correcta", () => {
    const pts = gableRoof(50, 5, 30, 20);
    const ys = pts.map((p) => p.y);
    assert.equal(Math.max(...ys) - Math.min(...ys), 20);
  });
});

// ---------------------------------------------------------------------------
// dome
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / dome", () => {
  it("empieza y termina en la base (baseY)", () => {
    const pts = dome(50, 10, 15, 12);
    assert.equal(pts[0].y, 10);
    assert.equal(pts[1].y, 10);
  });

  it("punto más alto supera baseY + ry*0.9", () => {
    const pts = dome(50, 0, 15, 12);
    const maxY = Math.max(...pts.map((p) => p.y));
    assert.ok(maxY >= 12 * 0.9);
  });

  it("ancho = 2*rx en la base", () => {
    const pts = dome(50, 0, 15, 12);
    const basePts = pts.filter((p) => p.y === 0);
    assert.ok(basePts.length >= 2);
    const xs = basePts.map((p) => p.x);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 30) < 0.1);
  });
});

// ---------------------------------------------------------------------------
// merlons
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / merlons", () => {
  it("devuelve un anillo con puntos", () => {
    const pts = merlons(50, 0, 40, 4, 6);
    assert.ok(pts.length >= 2);
  });

  it("alturas entre baseY y baseY+merH", () => {
    const pts = merlons(50, 10, 40, 4, 6);
    const ys = pts.map((p) => p.y);
    assert.ok(Math.min(...ys) >= 10 - 0.01);
    assert.ok(Math.max(...ys) <= 10 + 6 + 0.01);
  });

  it("merlón en el extremo izquierdo y derecho del ancho", () => {
    const cx = 50;
    const w = 40;
    const hw = w / 2;
    const n = 4;
    const merW = (w / n) * 0.55;
    const pts = merlons(cx, 0, w, n, 6);
    const xs = pts.map((p) => p.x);
    const leftEdge = cx - hw;
    const rightEdge = cx + hw;
    assert.ok(xs.some((x) => Math.abs(x - leftEdge) < 0.01), "falta merlón izquierdo");
    assert.ok(xs.some((x) => Math.abs(x - (leftEdge + merW)) < 0.01), "falta cima merlón izquierdo");
    assert.ok(xs.some((x) => Math.abs(x - rightEdge) < 0.01), "falta merlón derecho");
    assert.ok(xs.some((x) => Math.abs(x - (rightEdge - merW)) < 0.01), "falta cima merlón derecho");
  });
});

// ---------------------------------------------------------------------------
// arch
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / arch", () => {
  it("flat devuelve 4 puntos", () => {
    assert.equal(arch(50, 0, 10, 15, "flat").length, 4);
  });

  it("romanesque tiene más puntos que flat (curva poligonalizada)", () => {
    assert.ok(arch(50, 0, 10, 15, "romanesque").length > 4);
  });

  it("gothic tiene más puntos que flat", () => {
    assert.ok(arch(50, 0, 10, 15, "gothic").length > 4);
  });

  it("trefoil tiene más puntos que romanesque", () => {
    assert.ok(arch(50, 0, 10, 15, "trefoil").length > arch(50, 0, 10, 15, "romanesque").length);
  });

  it("los 4 tipos producen formas distintas", () => {
    const kinds = ["flat", "romanesque", "gothic", "trefoil"];
    const paths = kinds.map((k) => JSON.stringify(arch(50, 0, 12, 20, k)));
    const uniq = new Set(paths);
    assert.equal(uniq.size, 4);
  });

  it("todos los tipos se contienen en la caja w×h", () => {
    for (const kind of ["flat", "romanesque", "gothic", "trefoil"]) {
      const pts = arch(50, 0, 12, 20, kind);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      assert.ok(Math.min(...xs) >= 50 - 12 / 2 - 0.1, `${kind}: minX overflow`);
      assert.ok(Math.max(...xs) <= 50 + 12 / 2 + 0.1, `${kind}: maxX overflow`);
      assert.ok(Math.min(...ys) >= -0.1, `${kind}: baseY overflow`);
      assert.ok(Math.max(...ys) <= 20 + 0.1, `${kind}: height overflow`);
    }
  });
});

// ---------------------------------------------------------------------------
// aperture
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / aperture", () => {
  it("rect → 4 puntos", () => {
    assert.equal(aperture(50, 0, 8, 12, "rect").length, 4);
  });

  it("gothic → más de 4 puntos", () => {
    assert.ok(aperture(50, 0, 8, 12, "gothic").length > 4);
  });
});

// ---------------------------------------------------------------------------
// jitterRing
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / jitterRing", () => {
  it("conserva el mismo número de puntos", () => {
    const pts = rect(50, 0, 20, 30);
    const rng = createRng(42);
    assert.equal(jitterRing(pts, rng, 1).length, pts.length);
  });

  it("los desplazamientos no superan 2 × amount", () => {
    const pts = rect(50, 0, 20, 30);
    const rng = createRng(99);
    const amount = 2;
    const jittered = jitterRing(pts, rng, amount);
    for (let i = 0; i < pts.length; i++) {
      assert.ok(Math.abs(jittered[i].x - pts[i].x) <= amount * 2 + 0.01);
      assert.ok(Math.abs(jittered[i].y - pts[i].y) <= amount * 2 + 0.01);
    }
  });

  it("con amount=0 devuelve los mismos valores", () => {
    const pts = rect(50, 0, 20, 30);
    const rng = createRng(1);
    const out = jitterRing(pts, rng, 0);
    for (let i = 0; i < pts.length; i++) {
      assert.ok(Math.abs(out[i].x - pts[i].x) < 0.01);
      assert.ok(Math.abs(out[i].y - pts[i].y) < 0.01);
    }
  });

  it("freezeSeams: puntos en lockY no se desplazan", () => {
    const pts = [{ x: 50, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 30 }, { x: 50, y: 30 }];
    const rng = createRng(7);
    const out = jitterRing(pts, rng, 3, { lockY: [20], freezeSeams: true });
    assert.deepEqual(out[0], pts[0]);
    assert.deepEqual(out[1], pts[1]);
    // puntos fuera de la costura sí se mueven
    const changed = out[2].x !== pts[2].x || out[2].y !== pts[2].y;
    assert.ok(changed);
  });
});

// ---------------------------------------------------------------------------
// polygon
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / polygon", () => {
  it("devuelve una copia con los mismos puntos", () => {
    const pts = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    const out = polygon(pts);
    assert.deepEqual(out, pts);
    assert.notEqual(out, pts); // copia, no referencia
  });
});

// ---------------------------------------------------------------------------
// boundsOfFantasyGroups
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / boundsOfFantasyGroups", () => {
  it("calcula bounds correctas de un grupo simple", () => {
    const pts = [{ x: 10, y: 5 }, { x: 40, y: 60 }];
    const b = boundsOfFantasyGroups([[...pts]]);
    assert.equal(b.minX, 10);
    assert.equal(b.maxX, 40);
    assert.equal(b.minY, 5);
    assert.equal(b.maxY, 60);
  });

  it("agrupa múltiples grupos correctamente", () => {
    const g1 = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const g2 = [{ x: -5, y: 5 }, { x: 20, y: 15 }];
    const b = boundsOfFantasyGroups([g1, g2]);
    assert.equal(b.minX, -5);
    assert.equal(b.maxX, 20);
    assert.equal(b.minY, 0);
    assert.equal(b.maxY, 15);
  });
});

// ---------------------------------------------------------------------------
// normalizeFantasyGroups
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / normalizeFantasyGroups", () => {
  it("devuelve grupos vacíos para entrada vacía", () => {
    assert.deepEqual(normalizeFantasyGroups([]), []);
  });

  it("todos los puntos están en [0, 100]", () => {
    const groups = [rect(50, 0, 30, 50), rect(30, 50, 20, 20)];
    const norm = normalizeFantasyGroups(groups);
    for (const g of norm) {
      for (const p of g) {
        assert.ok(p.x >= -0.01 && p.x <= 100.01, `x=${p.x} out of range`);
        assert.ok(p.y >= -0.01 && p.y <= 100.01, `y=${p.y} out of range`);
      }
    }
  });

  it("preserva el número de grupos y puntos", () => {
    const g1 = rect(50, 0, 30, 50); // 4 pts
    const g2 = dome(50, 50, 10, 8, 6); // variable pts
    const norm = normalizeFantasyGroups([g1, g2]);
    assert.equal(norm.length, 2);
    assert.equal(norm[0].length, g1.length);
    assert.equal(norm[1].length, g2.length);
  });

  it("ancla el suelo local (minY) al borde inferior del viewBox (y≈100)", () => {
    const pts = rect(50, 0, 20, 50); // base en y=0 local
    const norm = normalizeFantasyGroups([pts]);
    const groundPts = norm[0].filter((_, i) => pts[i].y === 0);
    for (const p of groundPts) {
      assert.ok(Math.abs(p.y - 100) < 0.5, `suelo en y=${p.y}, esperado ≈100`);
    }
  });

  it("invierte el eje y (local y-up → SVG y-down): punto más alto en local → menor SVG y", () => {
    // Rect de altura 50, base en y=0, tope en y=50
    const pts = rect(50, 0, 20, 50); // local y: min=0, max=50
    const norm = normalizeFantasyGroups([pts]);
    const ys = norm[0].map((p) => p.y);
    // El punto con local y=50 (tope) debe tener SVG y pequeño (≈ top)
    // El punto con local y=0 (base) debe tener SVG y grande (≈ bottom)
    assert.ok(Math.min(...ys) < Math.max(...ys)); // hay variación
    // Puntos locales de base (y=0 local) → SVG y más alto (cercano a 100)
    const basePtsLocal = pts.filter((p) => p.y === 0);
    const basePtsNorm = norm[0].filter((_, i) => pts[i].y === 0);
    const topPtsNorm = norm[0].filter((_, i) => pts[i].y === 50);
    const avgBaseY = basePtsNorm.reduce((s, p) => s + p.y, 0) / basePtsNorm.length;
    const avgTopY = topPtsNorm.reduce((s, p) => s + p.y, 0) / topPtsNorm.length;
    assert.ok(avgBaseY > avgTopY, "base local debe tener mayor SVG y (más abajo en pantalla)");
  });

  it("determinista: misma entrada → misma salida", () => {
    const groups = [rect(50, 0, 30, 40), dome(50, 40, 10, 8)];
    const a = normalizeFantasyGroups(groups);
    const b = normalizeFantasyGroups(groups);
    assert.deepEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// pointsToPath
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / pointsToPath", () => {
  it("empieza con M", () => {
    const d = pointsToPath([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    assert.ok(d.startsWith("M"));
  });

  it("cerrado termina con Z", () => {
    const d = pointsToPath([{ x: 10, y: 20 }, { x: 30, y: 40 }], true);
    assert.ok(d.endsWith("Z"));
  });

  it("abierto no termina con Z", () => {
    const d = pointsToPath([{ x: 10, y: 20 }, { x: 30, y: 40 }], false);
    assert.ok(!d.endsWith("Z"));
  });

  it("lista vacía devuelve string vacío", () => {
    assert.equal(pointsToPath([]), "");
  });
});

// ---------------------------------------------------------------------------
// buildPartPath
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / buildPartPath", () => {
  it("sin huecos: produce un solo subpath", () => {
    const outer = normalizeFantasyGroups([rect(50, 0, 30, 40)])[0];
    const d = buildPartPath(outer, []);
    assert.ok(d.startsWith("M"));
    // Un solo M al inicio
    assert.equal((d.match(/M/g) ?? []).length, 1);
  });

  it("con 2 huecos: produce 3 subpaths (1 outer + 2 holes)", () => {
    const groups = [rect(50, 0, 40, 50), aperture(45, 10, 6, 8, "rect"), aperture(55, 10, 6, 8, "rect")];
    const norm = normalizeFantasyGroups(groups);
    const d = buildPartPath(norm[0], [norm[1], norm[2]]);
    assert.equal((d.match(/M/g) ?? []).length, 3);
  });
});
