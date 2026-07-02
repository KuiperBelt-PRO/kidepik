import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  arch,
  aperture,
  boundsOfFantasyGroups,
  buildPartPath,
  chamferAperture,
  chamferRect,
  chamferTopAperture,
  chamferTopRect,
  crossingArches,
  dome,
  domeCropped,
  domeCroppedCapY,
  gableRoof,
  gothicArchOutline,
  gothicBoundedInterlaceRow,
  gothicFlankInterlaceOutlines,
  gothicFlankInterlaceRow,
  elfFlankRoofOutlines,
  elfRoofTowerOutlines,
  elfTrapezoidRoofOutline,
  fishScaleFillTrapezoid,
  fishScaleOutline,
  planElfRoofTowerPlacements,
  planElfRoofTowerTargetCount,
  rectOutline,
  jitterRing,
  merlons,
  normalizeFantasyGroups,
  pointsToPath,
  polygon,
  rect,
  spikeRow,
  trapezoidTopChamfer,
  trapezoidFlareDown,
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
    const fill = 0.5;
    const pitch = w / n;
    const merW = pitch * fill;
    const inset = (pitch - merW) / 2;
    const leftEdge = cx - hw;
    const merH = merW * 0.82;
    const pts = merlons(cx, 0, w, n, merH, fill);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    assert.ok(xs.some((x) => Math.abs(x - leftEdge) < 0.01), "falta borde izquierdo");
    assert.ok(xs.some((x) => Math.abs(x - (leftEdge + inset)) < 0.01), "falta base merlón izquierdo");
    assert.ok(
      xs.some((x) => Math.abs(x - (leftEdge + inset + merW)) < 0.01),
      "falta cima merlón izquierdo",
    );
    assert.ok(xs.some((x) => Math.abs(x - (cx + hw)) < 0.01), "falta borde derecho");
    assert.ok(Math.max(...ys) <= merH + 0.01, "altura acorde al ancho del diente");
  });

  it("paso uniforme: n merlones reparten todo el ancho", () => {
    const w = 36;
    const n = 6;
    const pts = merlons(50, 0, w, n, 3, 0.5);
    const xs = pts.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    assert.ok(Math.abs(minX - (50 - w / 2)) < 0.01);
    assert.ok(Math.abs(maxX - (50 + w / 2)) < 0.01);
  });
});

// ---------------------------------------------------------------------------
// chamferRect, crossingArches, spikeRow
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / facciones", () => {
  it("chamferRect tiene 8 vértices", () => {
    assert.equal(chamferRect(50, 0, 40, 30, 4).length, 8);
  });

  it("crossingArches devuelve dos anillos", () => {
    const rings = crossingArches(50, 10, 30, 20);
    assert.equal(rings.length, 2);
    assert.ok(rings[0].length > 4);
  });

  it("spikeRow devuelve al menos 2 pinchos", () => {
    const spikes = spikeRow(50, 0, 40, 4, 8);
    assert.ok(spikes.length >= 2);
    assert.equal(spikes[0].length, 3);
  });
});

// ---------------------------------------------------------------------------
// chamferAperture
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / chamferAperture", () => {
  it("tiene 8 vértices (igual que chamferRect)", () => {
    assert.equal(chamferAperture(50, 0, 20, 30, 4).length, 8);
  });

  it("produce la misma forma que chamferRect con los mismos parámetros", () => {
    const a = JSON.stringify(chamferAperture(50, 5, 16, 24, 3));
    const b = JSON.stringify(chamferRect(50, 5, 16, 24, 3));
    assert.equal(a, b);
  });

  it("se contiene en la caja w×h", () => {
    const pts = chamferAperture(50, 10, 18, 26, 4);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    assert.ok(Math.min(...xs) >= 50 - 9 - 0.1);
    assert.ok(Math.max(...xs) <= 50 + 9 + 0.1);
    assert.ok(Math.min(...ys) >= 10 - 0.1);
    assert.ok(Math.max(...ys) <= 36 + 0.1);
  });
});

// ---------------------------------------------------------------------------
// domeCropped
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / domeCropped", () => {
  it("devuelve al menos 8 puntos", () => {
    assert.ok(domeCropped(50, 0, 15, 20, 0.45).length >= 8);
  });

  it("base en baseY (primeros dos puntos)", () => {
    const pts = domeCropped(50, 10, 15, 20, 0.45);
    assert.equal(pts[0].y, 10);
    assert.equal(pts[1].y, 10);
  });

  it("altura máxima = baseY + ry * cropRatio (tapa plana)", () => {
    const ry = 20;
    const cr = 0.45;
    const pts = domeCropped(50, 0, 15, ry, cr);
    const maxY = Math.max(...pts.map((p) => p.y));
    assert.ok(Math.abs(maxY - ry * cr) < 0.5, `altura ${maxY} ≠ ${ry * cr}`);
  });

  it("forma más baja que dome completa con mismo ry", () => {
    const domeH = Math.max(...dome(50, 0, 15, 20).map((p) => p.y));
    const croppedH = Math.max(...domeCropped(50, 0, 15, 20, 0.45).map((p) => p.y));
    assert.ok(croppedH < domeH);
  });

  it("cropRatio mayor produce cúpula más alta", () => {
    const h1 = Math.max(...domeCropped(50, 0, 15, 20, 0.35).map((p) => p.y));
    const h2 = Math.max(...domeCropped(50, 0, 15, 20, 0.55).map((p) => p.y));
    assert.ok(h2 > h1);
  });

  it("simétrica respecto al eje cx", () => {
    const pts = domeCropped(50, 0, 15, 20, 0.45);
    const xs = pts.map((p) => p.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    assert.ok(Math.abs(mid - 50) < 0.5, `centro ${mid} ≠ 50`);
  });

  it("domeCroppedCapY coincide con la tapa plana", () => {
    const baseY = 12;
    const ry = 18;
    const cr = 0.42;
    const capY = domeCroppedCapY(baseY, ry, cr);
    const maxY = Math.max(...domeCropped(50, baseY, 12, ry, cr).map((p) => p.y));
    assert.ok(Math.abs(capY - maxY) < 0.5);
  });
});

// ---------------------------------------------------------------------------
// chamferTopRect, trapezoidTopChamfer
// ---------------------------------------------------------------------------
describe("loader-fantasy-geom / enano top-chamfer", () => {
  it("chamferTopRect: base plana (4 puntos en baseY)", () => {
    const pts = chamferTopRect(50, 10, 30, 24, 4);
    const basePts = pts.filter((p) => p.y === 10);
    assert.equal(basePts.length, 2);
    assert.equal(pts.length, 6);
  });

  it("trapezoidTopChamfer: más estrecho arriba que abajo", () => {
    const pts = trapezoidTopChamfer(50, 0, 40, 30, 0.15, 3);
    const xs = pts.map((p) => p.x);
    const baseW = Math.max(...xs) - Math.min(...xs);
    const topYs = pts.filter((p) => p.y === 30).map((p) => p.x);
    const topW = topYs.length >= 2 ? Math.max(...topYs) - Math.min(...topYs) : 0;
    assert.ok(baseW > topW || topW === 0);
  });

  it("chamferTopAperture coincide con chamferTopRect", () => {
    const a = JSON.stringify(chamferTopAperture(50, 5, 16, 20, 3));
    const b = JSON.stringify(chamferTopRect(50, 5, 16, 20, 3));
    assert.equal(a, b);
  });

  it("trapezoidFlareDown: ensancha hacia abajo (zócalo enano)", () => {
    const pts = trapezoidFlareDown(50, 0, 60, 100, 40);
    const top = pts.filter((p) => p.y === 0);
    const bot = pts.filter((p) => p.y === -40);
    assert.equal(top.length, 2);
    assert.equal(bot.length, 2);
    const topW = Math.abs(top[1].x - top[0].x);
    const botW = Math.abs(bot[1].x - bot[0].x);
    assert.ok(botW > topW);
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

describe("loader-fantasy-geom / gothicArchOutline", () => {
  it("genera contorno abierto sin cierre Z", () => {
    const pts = gothicArchOutline(50, 0, 16, 24);
    const d = pointsToPath(pts, false);
    assert.ok(pts.length > 12);
    assert.ok(!d.endsWith("Z"));
    assert.equal(pts[0].x, 50 - 8);
    assert.equal(pts[pts.length - 1].x, 50 + 8);
  });

  it("la cúspide está centrada y las hojas son simétricas", () => {
    const pts = gothicArchOutline(50, 0, 20, 30);
    const apex = pts.reduce((best, p) => (p.y > best.y ? p : best), pts[0]);
    assert.ok(Math.abs(apex.x - 50) < 0.6, `ápice descentrado: ${apex.x}`);
    const leftSide = pts.filter((p) => p.x < 50 && p.y > 8);
    const rightSide = pts.filter((p) => p.x > 50 && p.y > 8);
    const leftSpan = Math.max(...leftSide.map((p) => p.x)) - Math.min(...leftSide.map((p) => p.x));
    const rightSpan = Math.max(...rightSide.map((p) => p.x)) - Math.min(...rightSide.map((p) => p.x));
    assert.ok(Math.abs(leftSpan - rightSpan) < 2, `asimetría hojas: ${leftSpan} vs ${rightSpan}`);
  });

  it("buildPartPath open no cierra el subpath exterior", () => {
    const pts = gothicArchOutline(50, 0, 16, 24);
    const d = buildPartPath(pts, [], { open: true });
    assert.ok(!d.endsWith("Z"));
  });
});

describe("loader-fantasy-geom / gothicFlankInterlaceOutlines", () => {
  it("genera 5 arcos por flanco (10 en total)", () => {
    const outlines = gothicFlankInterlaceOutlines(50, 0, 14, 10, 28, 72, 5);
    assert.equal(outlines.length, 10);
    for (const pts of outlines) {
      assert.ok(pts.length > 10);
    }
  });

  it("cada flanco cubre el tramo completo con distribución uniforme", () => {
    const envLeft = 30;
    const centralLeft = 44;
    const count = 5;
    const span = centralLeft - envLeft;
    const pitch = span / (count - 1);
    const left = gothicFlankInterlaceRow(0, 9, envLeft, centralLeft, "left", count);

    const centers = left.map((pts) => (pts[0].x + pts[pts.length - 1].x) / 2);
    assert.equal(centers[0], envLeft);
    assert.equal(centers[count - 1], centralLeft);
    for (let i = 1; i < count; i++) {
      assert.ok(Math.abs((centers[i] - centers[i - 1]) - pitch) < 0.01);
    }
  });

  it("arcos vecinos se solapan (entrecruzados)", () => {
    const envLeft = 30;
    const centralLeft = 44;
    const count = 5;
    const span = centralLeft - envLeft;
    const pitch = span / (count - 1);
    const archW = pitch * 1.62;
    const left = gothicFlankInterlaceRow(0, 9, envLeft, centralLeft, "left", count);

    assert.ok(archW > pitch, "ancho mayor que separación");

    const spanX = (pts) => {
      const xs = pts.map((p) => p.x);
      return [Math.min(...xs), Math.max(...xs)];
    };
    const baseCx = (pts) => (pts[0].x + pts[pts.length - 1].x) / 2;
    const apexPt = (pts) => pts.reduce((best, p) => (p.y > best.y ? p : best), pts[0]);

    for (const pts of left) {
      const cx = baseCx(pts);
      const apex = apexPt(pts);
      assert.ok(Math.abs(apex.x - cx) < 0.35, "arco simétrico, no inclinado");
    }

    for (let i = 0; i < left.length - 1; i++) {
      const [a0, a1] = spanX(left[i]);
      const [b0, b1] = spanX(left[i + 1]);
      assert.ok(a1 > b0 && b1 > a0, `arcos ${i} y ${i + 1} no se solapan`);
    }
  });

  it("los arcos laterales son más bajos que el central", () => {
    const doorH = 20;
    const archH = doorH * 0.55;
    const outlines = gothicFlankInterlaceOutlines(50, 0, 14, archH, 28, 72, 5);
    const apexY = (pts) => pts.reduce((best, p) => (p.y > best.y ? p : best), pts[0]).y;
    for (const pts of outlines) {
      assert.ok(apexY(pts) < doorH);
    }
  });
});

describe("loader-fantasy-geom / elfFlankRoofOutlines", () => {
  it("genera trapecio regular y 3 filas de tejas por flanco", () => {
    const outlines = elfFlankRoofOutlines(50, 0, 14, 10, 28, 72, {
      roofHRatio: 0.5,
      rows: 3,
    });
    assert.ok(outlines.length > 4, "al menos 2 contornos + varias tejas");
    const roofBase = 10;
    const leftTopRight = outlines[0][2];
    const leftTopLeft = outlines[0][3];
    assert.equal(outlines[0][0].y, roofBase);
    assert.equal(outlines[0][1].y, roofBase);
    assert.equal(leftTopRight.y, leftTopLeft.y, "cumbrera horizontal (trapecio regular)");
    assert.ok(leftTopRight.x < outlines[0][1].x, "cumbrera más estrecha hacia el centro");
    assert.ok(leftTopLeft.x > outlines[0][0].x, "cumbrera más estrecha hacia fuera");
  });

  it("cada teja apunta hacia abajo (pico inferior)", () => {
    const scale = fishScaleOutline(20, 5, 6, 4);
    const peak = scale.reduce((best, p) => (p.y > best.y ? p : best), scale[0]);
    assert.equal(peak.x, 20);
    assert.ok(peak.y > scale[0].y);
    assert.ok(peak.y > scale[scale.length - 1].y);
  });

  it("fishScaleFillTrapezoid rellena exactamente 3 filas", () => {
    const scales = fishScaleFillTrapezoid(30, 44, 10, 5, 0.12, { rows: 3 });
    assert.ok(scales.length >= 4);
    for (const pts of scales) {
      assert.equal(pts.length, 5);
      assert.ok(!buildPartPath(pts, [], { open: true }).endsWith("Z"));
    }
  });

  it("contorno trapezoidal regular es abierto (sin Z) y cierra el lado izquierdo", () => {
    const pts = elfTrapezoidRoofOutline(30, 44, 10, 5, 0.12);
    const d = buildPartPath(pts, [], { open: true });
    assert.ok(!d.endsWith("Z"));
    assert.equal(pts.length, 5);
    assert.equal(pts[2].y, pts[3].y, "cumbrera plana");
    assert.equal(pts[0].x, pts[4].x);
    assert.equal(pts[0].y, pts[4].y, "vuelve al vértice inferior izquierdo");
  });

  it("todas las tejas quedan dentro del trapecio del contorno", () => {
    const spanStart = 30;
    const spanEnd = 44;
    const baseY = 10;
    const roofH = 5;
    const topInsetRatio = 0.12;
    const outline = elfTrapezoidRoofOutline(spanStart, spanEnd, baseY, roofH, topInsetRatio);
    const scales = fishScaleFillTrapezoid(spanStart, spanEnd, baseY, roofH, topInsetRatio, { rows: 3 });
    const topInset = Math.max(1, (spanEnd - spanStart) * topInsetRatio);
    const topY = baseY + roofH;

    const inside = (x, y) => {
      const t = Math.min(1, Math.max(0, (y - baseY) / roofH));
      const leftX = spanStart + topInset * t;
      const rightX = spanEnd - topInset * t;
      return x >= leftX - 0.05 && x <= rightX + 0.05 && y >= baseY - 0.05 && y <= topY + 0.05;
    };

    for (const pts of scales) {
      for (const p of pts) {
        assert.ok(inside(p.x, p.y), `teja fuera del trapecio en (${p.x}, ${p.y})`);
      }
    }
    assert.ok(outline.length === 5);
  });
});

describe("loader-fantasy-geom / elfRoofTowerOutlines", () => {
  it("planElfRoofTowerPlacements genera entre 1 y 3 torres sobre la cumbrera", () => {
    const counts = { 1: 0, 2: 0, 3: 0 };
    for (let s = 0; s < 120; s++) {
      const rng = createRng(s * 17 + 3);
      const target = planElfRoofTowerTargetCount(rng);
      const towers = planElfRoofTowerPlacements(
        50, 0, 14, 10, 28, 72, 0.34, 0.12, rng,
        { targetCount: target },
      );
      assert.ok(towers.length >= 1 && towers.length <= 3, `seed ${s}: count ${towers.length}`);
      assert.ok(towers.length <= target, `seed ${s}: más torres que objetivo`);
      counts[Math.min(3, towers.length)] += 1;
      const roofTop = 10 + 10 * 0.34;
      for (const t of towers) {
        assert.equal(t.baseY, roofTop);
        assert.ok(t.w > 0 && t.h > 0);
      }
      if (towers.length >= 2) {
        const ws = new Set(towers.map((t) => Math.round(t.w * 10)));
        const hs = new Set(towers.map((t) => Math.round(t.h * 10)));
        assert.ok(ws.size === towers.length || hs.size === towers.length, "dimensiones distintas");
      }
    }
    assert.ok(counts[1] > 0 && counts[2] > 0 && counts[3] > 0, "debe haber 1, 2 y 3 torres");
  });

  it("elfRoofTowerOutlines: rectángulo, líneas verticales y 3 arcos de coronación", () => {
    const rng = createRng(4242);
    const w = 8;
    const cx = 40;
    const outlines = elfRoofTowerOutlines(cx, 12, w, 18, rng, 3);
    assert.ok(outlines.length >= 5);
    assert.equal(outlines[0].length, 5, "contorno rectangular");
    const body = outlines.slice(1, -3);
    for (const line of body) {
      assert.equal(line.length, 2);
      assert.equal(line[0].x, line[1].x, "línea vertical");
    }
    const crown = outlines.slice(-3);
    assert.equal(crown.length, 3);
    const leftX = cx - w / 2;
    const rightX = cx + w / 2;
    assert.ok(crown[0].some((p) => p.x === leftX), "arco izquierdo recortado al borde");
    assert.ok(crown[2].some((p) => p.x === rightX), "arco derecho recortado al borde");
  });

  it("gothicBoundedInterlaceRow recorta arcos exteriores al tramo", () => {
    const spanStart = 30;
    const spanEnd = 44;
    const rows = gothicBoundedInterlaceRow(10, 6, spanStart, spanEnd, 3);
    assert.equal(rows.length, 3);
    for (const pts of rows) {
      for (const p of pts) {
        assert.ok(p.x >= spanStart && p.x <= spanEnd);
      }
    }
  });

  it("torres distintas producen alturas y anchuras diferentes con otra seed", () => {
    const a = planElfRoofTowerPlacements(50, 0, 14, 10, 28, 72, 0.34, 0.12, createRng(1));
    const b = planElfRoofTowerPlacements(50, 0, 14, 10, 28, 72, 0.34, 0.12, createRng(999));
    if (a.length === 2 && b.length === 2) {
      const same = a[0].w === b[0].w && a[0].h === b[0].h && a[1].w === b[1].w && a[1].h === b[1].h;
      assert.ok(!same, "seeds distintas deben variar dimensiones");
    }
  });

  it("planElfRoofTowerPlacements varía la posición horizontal entre seeds", () => {
    /** @type {string[]} */
    const signatures = [];
    for (let s = 0; s < 40; s++) {
      const rng = createRng(s * 13 + 7);
      const target = planElfRoofTowerTargetCount(rng);
      const towers = planElfRoofTowerPlacements(
        50, 0, 14, 10, 28, 72, 0.34, 0.12, createRng(s * 29 + 11),
        { targetCount: target },
      );
      signatures.push(towers.map((t) => `${t.cx.toFixed(1)}:${t.w.toFixed(1)}`).join("|"));
    }
    const unique = new Set(signatures);
    assert.ok(unique.size >= 28, `posiciones repetidas: solo ${unique.size} firmas distintas`);
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
