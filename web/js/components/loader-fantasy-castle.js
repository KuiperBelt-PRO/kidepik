/**
 * Builder de castillos y palacios (Fase 1 del motor de fantasía).
 *
 * Genera siluetas blancas detalladas, asimétricas e imperfectas:
 * cuerpo central rectangular + 2–5 torres con remates variados (tejado,
 * almenas o cúpula) + bloques laterales, con sustracciones de puerta y
 * ventanas mediante arcos góticos/románicos/flat/trilobulados.
 *
 * `castle` y `palace` comparten builder; `palace:true` sesga estilo, arcos y
 * remates hacia lo señorial (más cúpulas, gótico/trilobulado, menos almenas).
 *
 * @module loader-fantasy-castle
 */

import { ElementAssembler } from "./loader-fantasy-element.js";
import {
  aperture,
  arch,
  dome,
  finial,
  gableRoof,
  jitterRing,
  merlons,
  rect,
} from "./loader-fantasy-geom.js";
import { createRng, randPick, randRange } from "./loader-ship-rng.js";

/** Solape vertical entre piezas para evitar huecos tras normalizar. */
const SEAM = 1.4;

/**
 * @param {() => number} rng
 * @param {boolean} palace
 * @returns {string}
 */
function pickStyle(rng, palace) {
  return palace
    ? randPick(rng, ["manor", "palace"])
    : randPick(rng, ["keep", "citadel", "ruinedKeep"]);
}

/**
 * Tipo de arco dominante según carácter del edificio.
 * @param {() => number} rng
 * @param {boolean} palace
 * @returns {'gothic'|'romanesque'}
 */
function pickArchDominant(rng, palace) {
  if (palace) return rng() < 0.72 ? "gothic" : "romanesque";
  return rng() < 0.62 ? "romanesque" : "gothic";
}

/**
 * Remate de torre ponderado por carácter.
 * @param {() => number} rng
 * @param {boolean} palace
 * @returns {'roof'|'battlement'|'dome'}
 */
function pickRemate(rng, palace) {
  const r = rng();
  if (palace) {
    if (r < 0.45) return "dome";
    if (r < 0.75) return "roof";
    return "battlement";
  }
  if (r < 0.5) return "battlement";
  if (r < 0.85) return "roof";
  return "dome";
}

/**
 * Genera un castillo o palacio.
 *
 * @param {{ seed:number; style?:string; palace?:boolean; imperfection?:number }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateCastle(options) {
  const seed = options.seed >>> 0;
  const palace = !!options.palace;
  const rng = createRng(seed);
  const style = options.style ?? pickStyle(rng, palace);
  const imperfection = options.imperfection ?? 0.55;
  const ruined = style === "ruinedKeep";

  const asym = randRange(rng, 0.3, 0.8);
  const jitterAmt = 0.18 + imperfection * 0.55;

  const asm = new ElementAssembler();

  /** @type {{ gothic:number; romanesque:number; flat:number; trefoil:number }} */
  const arches = { gothic: 0, romanesque: 0, flat: 0, trefoil: 0 };
  const archDominant = pickArchDominant(rng, palace);
  /** @type {{ remate: 'roof'|'battlement'|'dome' }[]} */
  const towersMeta = [];
  let doorCount = 0;
  let windowCount = 0;
  let slitCount = 0;

  // ── Cuerpo central (base) ─────────────────────────────────────────────────
  const baseW = randRange(rng, 50, 70);
  const baseH = randRange(rng, 28, 44);
  const axisShift = (rng() - 0.5) * 2 * (asym * 13);
  const axis = 50 + axisShift;

  // ── Zócalo / plinth (desciende bajo y=0 para enraizar el castillo) ────────
  // En espacio local y-up, el zócalo va de y=-plinH a y=0.  Tras normalizar,
  // su borde inferior queda en y=100 (fondo del SVG).  Cuando el div se
  // posiciona en bottom=terrainH, el zócalo queda enterrado y las murallas
  // emergen por encima del terreno.
  const plinH = baseH * randRange(rng, 0.20, 0.30);
  // El plinth es notablemente más ancho que la base para que se mezcle con el terreno
  const plinW = baseW * randRange(rng, 1.5, 2.0);
  let plinOuter = rect(axis, -plinH, plinW, plinH + SEAM);
  plinOuter = jitterRing(plinOuter, rng, jitterAmt * 0.25, { lockY: [-plinH], freezeSeams: true });
  asm.addPart("plinth", plinOuter);

  const baseTop = baseH;
  let baseOuter = rect(axis, 0, baseW, baseTop);
  baseOuter = jitterRing(baseOuter, rng, jitterAmt, { lockY: [0, baseTop], freezeSeams: true });

  /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
  const baseHoles = [];

  // Puerta principal (arco grande, posición asimétrica)
  const doorW = baseW * randRange(rng, 0.14, 0.2);
  const doorH = baseH * randRange(rng, 0.46, 0.62);
  const doorCx = axis + (rng() - 0.5) * baseW * 0.28;
  baseHoles.push(arch(doorCx, 0, doorW, doorH, archDominant));
  arches[archDominant] += 1;
  doorCount += 1;

  // Ventanas en rejilla irregular sobre la base
  const density = randPick(rng, ["low", "med", "high"]);
  const winPerRow = density === "low" ? 2 : density === "med" ? 3 : 4;
  const winKind = palace
    ? randPick(rng, ["gothic", "trefoil", "gothic"])
    : randPick(rng, ["romanesque", "flat", "romanesque"]);
  const winY = baseH * randRange(rng, 0.46, 0.6);
  const winW = baseW * 0.08;
  const winH = baseH * 0.2;
  for (let i = 0; i < winPerRow; i++) {
    const frac = (i + 1) / (winPerRow + 1);
    const wx = axis - baseW / 2 + frac * baseW + (rng() - 0.5) * 3;
    // Evita solapar la puerta
    if (Math.abs(wx - doorCx) < doorW * 0.8) continue;
    baseHoles.push(aperture(wx, winY, winW, winH, winKind));
    if (arches[winKind] !== undefined) arches[winKind] += 1;
    windowCount += 1;
  }
  // Garantiza al menos una ventana aunque el filtro anterior las descarte
  if (windowCount === 0) {
    const wx = axis - baseW * 0.32;
    baseHoles.push(aperture(wx, winY, winW, winH, winKind));
    if (arches[winKind] !== undefined) arches[winKind] += 1;
    windowCount += 1;
  }

  asm.addPart("base", baseOuter, baseHoles);

  // ── Bloques laterales (alas) ──────────────────────────────────────────────
  const blockCount = Math.floor(rng() * (palace ? 3 : 4)); // 0..2 / 0..3
  for (let b = 0; b < blockCount; b++) {
    const side = b % 2 === 0 ? -1 : 1;
    const blockW = baseW * randRange(rng, 0.22, 0.34);
    const blockH = baseH * randRange(rng, 0.5, 0.82);
    const blockCx = axis + side * (baseW / 2 + blockW * randRange(rng, 0.1, 0.4));
    const blockTop = blockH;
    let blockOuter = rect(blockCx, 0, blockW, blockTop);
    blockOuter = jitterRing(blockOuter, rng, jitterAmt, { lockY: [0, blockTop], freezeSeams: true });

    /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
    const blockHoles = [];
    if (rng() > 0.4) {
      blockHoles.push(aperture(blockCx, blockH * 0.45, blockW * 0.3, blockH * 0.26, winKind));
      if (arches[winKind] !== undefined) arches[winKind] += 1;
      windowCount += 1;
    }
    asm.addPart("block", blockOuter, blockHoles, {
      tiltDeg: (rng() - 0.5) * 2.4 * imperfection,
    });

    // Tejado del bloque
    const broofH = blockH * randRange(rng, 0.32, 0.5);
    let broof = gableRoof(blockCx, blockTop - SEAM, blockW * 1.06, broofH + SEAM);
    broof = jitterRing(broof, rng, jitterAmt * 0.7, { lockY: [blockTop - SEAM], freezeSeams: true });
    asm.addPart("roof", broof);
  }

  // ── Torres (2–5, asimétricas) ─────────────────────────────────────────────
  const towerCount = 2 + Math.floor(rng() * 4); // 2..5
  /** @type {number[]} */
  const towerXs = [];
  /** @type {number[]} */
  const towerHeights = [];
  // Dos torres flanqueando la base
  towerXs.push(axis - (baseW / 2) * randRange(rng, 0.88, 1.06));
  towerXs.push(axis + (baseW / 2) * randRange(rng, 0.88, 1.06));
  // Torres adicionales repartidas (no equiespaciadas)
  for (let t = 2; t < towerCount; t++) {
    towerXs.push(axis + (rng() - 0.5) * 2 * (baseW * 0.55));
  }

  // Ordenar las torres de izquierda a derecha y garantizar que no se solapan.
  // MIN_TOWER_SPACING = max(towerW) + margen visual = 16 + 4 = 20 unidades locales.
  const MIN_TOWER_SPACING = 20;
  towerXs.sort((a, b) => a - b);
  for (let i = 1; i < towerXs.length; i++) {
    if (towerXs[i] - towerXs[i - 1] < MIN_TOWER_SPACING) {
      towerXs[i] = towerXs[i - 1] + MIN_TOWER_SPACING;
    }
  }
  // Re-centrar el conjunto de torres en torno al eje del castillo
  const towerSpanCenter = (towerXs[0] + towerXs[towerXs.length - 1]) / 2;
  const recenterShift = axis - towerSpanCenter;
  for (let i = 0; i < towerXs.length; i++) {
    towerXs[i] += recenterShift;
  }

  // Un solo tipo de remate para todas las torres (coherencia de estilo).
  const towerRemate = pickRemate(rng, palace);

  towerXs.forEach((tcx, idx) => {
    const towerW = randRange(rng, 10, 16);
    let hMul = randRange(rng, 1.2, 2.0);
    // En ruinas, una torre queda truncada
    if (ruined && idx === towerCount - 1) hMul *= 0.55;
    const towerH = baseH * hMul;
    towerHeights.push(towerH);
    const towerTop = towerH;

    let towerOuter = rect(tcx, 0, towerW, towerTop);
    towerOuter = jitterRing(towerOuter, rng, jitterAmt, { lockY: [0, towerTop], freezeSeams: true });

    /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
    const towerHoles = [];
    // Saeteras (1–2) verticales estrechas
    const slits = 1 + Math.floor(rng() * 2);
    for (let s = 0; s < slits; s++) {
      const sy = towerH * (0.4 + s * 0.25);
      if (sy + towerW * 0.5 > towerH) break;
      towerHoles.push(aperture(tcx, sy, towerW * 0.16, towerH * 0.14, "flat"));
      arches.flat += 1;
      slitCount += 1;
    }
    // Ventana superior ocasional
    if (rng() > 0.5) {
      const wy = towerH * 0.68;
      towerHoles.push(aperture(tcx, wy, towerW * 0.34, towerH * 0.12, winKind));
      if (arches[winKind] !== undefined) arches[winKind] += 1;
      windowCount += 1;
    }

    const tilt = (rng() - 0.5) * 3 * imperfection;
    asm.addPart("tower", towerOuter, towerHoles, { tiltDeg: tilt });

    // Remate de la torre (mismo tipo en todo el edificio)
    const remate = towerRemate;
    towersMeta.push({ remate });
    if (remate === "roof") {
      const coneH = towerW * randRange(rng, 1.0, 1.7);
      let cone = gableRoof(tcx, towerTop - SEAM, towerW * 1.04, coneH + SEAM);
      cone = jitterRing(cone, rng, jitterAmt * 0.6, { lockY: [towerTop - SEAM], freezeSeams: true });
      asm.addPart("roof", cone, [], { tiltDeg: tilt });
      // Aguja decorativa ocasional
      if (rng() > 0.55) {
        for (const ring of finial(tcx, towerTop + coneH - SEAM, towerW * 0.5, "needle")) {
          asm.addPart("decoration", ring);
        }
      }
    } else if (remate === "battlement") {
      const merCount = 2 + Math.floor(rng() * 3);
      let mer = merlons(tcx, towerTop - SEAM, towerW * 0.98, merCount, towerW * 0.3 + SEAM);
      mer = jitterRing(mer, rng, jitterAmt * 0.5, { lockY: [towerTop - SEAM], freezeSeams: true });
      asm.addPart("battlement", mer, [], { tiltDeg: tilt });
    } else {
      const domeRy = towerW * randRange(rng, 0.65, 1.0);
      const d = dome(tcx, towerTop - SEAM, towerW * 0.56, domeRy + SEAM);
      asm.addPart("dome", d, [], { tiltDeg: tilt });
      // Remate decorativo sobre la cúpula (esfera o aguja, sin símbolos religiosos)
      if (rng() < (palace ? 0.7 : 0.4)) {
        const fk = randPick(rng, ["ball", "needle"]);
        for (const ring of finial(tcx, towerTop + domeRy - SEAM, towerW * 0.5, fk)) {
          asm.addPart("decoration", ring);
        }
      }
    }
  });

  // ── Métrica de asimetría ──────────────────────────────────────────────────
  const axisOffset = Math.min(1, Math.abs(axis - 50) / 22);
  const meanH = towerHeights.reduce((s, h) => s + h, 0) / (towerHeights.length || 1);
  const std = Math.sqrt(
    towerHeights.reduce((s, h) => s + (h - meanH) ** 2, 0) / (towerHeights.length || 1),
  );
  const heightVar = Math.min(1, std / (baseH * 0.8));
  const asymmetry = Math.min(
    1,
    axisOffset * 0.5 + heightVar * 0.5 + (ruined ? 0.15 : 0),
  );

  const meta = {
    style,
    palace,
    towerCount,
    blockCount,
    towers: towersMeta,
    towerRemate,
    doorCount,
    windowCount,
    slitCount,
    arches,
    archDominant,
    asymmetry,
  };

  return asm.build(palace ? "palace" : "castle", seed, style, meta);
}
