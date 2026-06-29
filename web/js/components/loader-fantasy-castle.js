/**
 * Builder de castillos y palacios (Fase 1 del motor de fantasía).
 *
 * Genera siluetas blancas detalladas, asimétricas e imperfectas:
 * cuerpo central rectangular + 2–5 torres con remates variados (tejado,
 * almenas o cúpula) + bloques laterales, con sustracciones de puerta y
 * ventanas mediante arcos góticos/románicos/flat/trilobulados.
 *
 * `castle` y `palace` comparten builder; cada aparición elige una facción
 * (humano, elfo, enano, maligno) que sesga arquitectura y decoración.
 *
 * @module loader-fantasy-castle
 */

import { ElementAssembler } from "./loader-fantasy-element.js";
import {
  getFactionProfile,
  pickArchForFaction,
  pickElfTowerCap,
  pickFaction,
  pickHumanCentralCrown,
  pickHumanTowerCap,
  pickRemateForFaction,
} from "./loader-fantasy-castle-factions.js";
import {
  aperture,
  arch,
  arcadeRow,
  buttress,
  chamferRect,
  crossingArches,
  dome,
  elfArcadeCluster,
  finial,
  flyingButtress,
  gableRoof,
  gothicArchCap,
  invertedArrowCap,
  jitterRing,
  merlons,
  rect,
  spikeRow,
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
 * Silueta de muro según facción (rectangular o achaflanada).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {import('./loader-fantasy-castle-factions.js').FactionProfile} profile
 * @returns {import('./loader-fantasy-geom.js').FPoint[]}
 */
function bodyShell(cx, baseY, w, h, profile) {
  if (profile.bodyShape === "chamfer") {
    return chamferRect(cx, baseY, w, h, profile.chamfer);
  }
  return rect(cx, baseY, w, h);
}

/**
 * @param {ElementAssembler} asm
 * @param {number} tcx
 * @param {number} topY
 * @param {number} w
 * @param {() => number} rng
 * @param {number} jitterAmt
 * @param {number} tilt
 * @param {number} [merCount]
 */
function addMerlons(asm, tcx, topY, w, rng, jitterAmt, tilt, merCount) {
  const count = merCount ?? 2 + Math.floor(rng() * 3);
  let mer = merlons(tcx, topY - SEAM, w * 0.98, count, w * 0.3 + SEAM);
  mer = jitterRing(mer, rng, jitterAmt * 0.5, { lockY: [topY - SEAM], freezeSeams: true });
  asm.addPart("battlement", mer, [], { tiltDeg: tilt });
}

/**
 * @param {ElementAssembler} asm
 * @param {{
 *   profile: import('./loader-fantasy-castle-factions.js').FactionProfile;
 *   elfCapKind: 'gothic_arch'|'inverted_arrow'|null;
 *   remate: string;
 *   tcx: number;
 *   towerTop: number;
 *   towerW: number;
 *   tilt: number;
 *   rng: () => number;
 *   jitterAmt: number;
 * }} opts
 */
function applyTowerCrown(asm, opts) {
  const { profile, elfCapKind, remate, tcx, towerTop, towerW, tilt, rng, jitterAmt } = opts;

  if (profile.remateMode === "none") return;

  if (profile.remateMode === "elf_cap" && elfCapKind) {
    const capH = towerW * randRange(rng, 1.1, 1.65);
    const capW = towerW * 1.08;
    let cap = elfCapKind === "gothic_arch"
      ? gothicArchCap(tcx, towerTop - SEAM, capW, capH + SEAM)
      : invertedArrowCap(tcx, towerTop - SEAM, capW, capH + SEAM);
    cap = jitterRing(cap, rng, jitterAmt * 0.45, { lockY: [towerTop - SEAM], freezeSeams: true });
    asm.addPart("decoration", cap, [], { tiltDeg: tilt });
    return;
  }

  if (remate === "battlement") {
    addMerlons(asm, tcx, towerTop, towerW, rng, jitterAmt, tilt);
    return;
  }

  if (remate === "dome") {
    const domeRy = towerW * randRange(rng, 0.65, 1.05);
    asm.addPart("dome", dome(tcx, towerTop - SEAM, towerW * 0.56, domeRy + SEAM), [], { tiltDeg: tilt });
    if (rng() < profile.finialChance) {
      const fk = randPick(rng, profile.finialKinds);
      for (const ring of finial(tcx, towerTop + domeRy - SEAM, towerW * 0.5, fk)) {
        asm.addPart("decoration", ring);
      }
    }
    return;
  }

  if (remate === "dome_battlement") {
    const domeRy = towerW * randRange(rng, 0.55, 0.92);
    asm.addPart("dome", dome(tcx, towerTop - SEAM, towerW * 0.56, domeRy + SEAM), [], { tiltDeg: tilt });
    addMerlons(asm, tcx, towerTop + domeRy, towerW * 0.88, rng, jitterAmt, tilt, 2 + Math.floor(rng() * 2));
    return;
  }

  if (remate === "roof") {
    const coneH = towerW * randRange(rng, 1.0, 1.7);
    let cone = gableRoof(tcx, towerTop - SEAM, towerW * 1.04, coneH + SEAM);
    cone = jitterRing(cone, rng, jitterAmt * 0.6, { lockY: [towerTop - SEAM], freezeSeams: true });
    asm.addPart("roof", cone, [], { tiltDeg: tilt });
    if (rng() < profile.finialChance) {
      const fk = randPick(rng, profile.finialKinds);
      for (const ring of finial(tcx, towerTop + coneH - SEAM, towerW * 0.5, fk)) {
        asm.addPart("decoration", ring);
      }
    }
    if (profile.spikeChance > 0 && rng() < profile.spikeChance * 0.65) {
      const spikeN = 2 + Math.floor(rng() * 2);
      for (const spike of spikeRow(tcx, towerTop + coneH - SEAM, towerW * 1.1, spikeN, towerW * 0.35)) {
        asm.addPart("decoration", spike);
      }
    }
  }
}

/**
 * Corona del cuerpo central (humanos).
 * @param {ElementAssembler} asm
 * @param {string} crown
 * @param {number} cx
 * @param {number} topY
 * @param {number} w
 * @param {() => number} rng
 * @param {number} jitterAmt
 */
function applyCentralCrown(asm, crown, cx, topY, w, rng, jitterAmt) {
  if (crown === "battlement") {
    addMerlons(asm, cx, topY, w * 0.94, rng, jitterAmt, 0, 3 + Math.floor(rng() * 2));
    return;
  }
  if (crown === "dome") {
    const domeRy = w * randRange(rng, 0.22, 0.34);
    asm.addPart("dome", dome(cx, topY - SEAM, w * 0.38, domeRy + SEAM));
    return;
  }
  if (crown === "dome_battlement") {
    const domeRy = w * randRange(rng, 0.18, 0.28);
    asm.addPart("dome", dome(cx, topY - SEAM, w * 0.36, domeRy + SEAM));
    addMerlons(asm, cx, topY + domeRy, w * 0.82, rng, jitterAmt, 0, 3 + Math.floor(rng() * 2));
  }
}

/**
 * Genera un castillo o palacio.
 *
 * @param {{ seed:number; style?:string; palace?:boolean; faction?:string; imperfection?:number }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateCastle(options) {
  const seed = options.seed >>> 0;
  const palace = !!options.palace;
  const rng = createRng(seed);
  const faction = /** @type {import('./loader-fantasy-castle-factions.js').CastleFaction} */ (
    options.faction ?? pickFaction(rng, palace)
  );
  const profile = getFactionProfile(faction);
  const style = options.style ?? pickStyle(rng, palace);
  const imperfection = options.imperfection ?? 0.55;
  const ruined = style === "ruinedKeep";

  const asym = randRange(rng, 0.3, 0.8);
  const jitterAmt = (0.18 + imperfection * 0.55) * profile.jitterScale;

  const asm = new ElementAssembler();

  /** @type {{ gothic:number; romanesque:number; flat:number; trefoil:number }} */
  const arches = { gothic: 0, romanesque: 0, flat: 0, trefoil: 0 };
  const archDominant = pickArchForFaction(rng, profile);
  /** @type {{ remate: 'roof'|'battlement'|'dome' }[]} */
  const towersMeta = [];
  let doorCount = 0;
  let windowCount = 0;
  let slitCount = 0;

  // ── Cuerpo central (base) ─────────────────────────────────────────────────
  const baseW = randRange(rng, profile.baseW[0], profile.baseW[1]);
  const baseH = randRange(rng, profile.baseH[0], profile.baseH[1]);
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
  let plinOuter = bodyShell(axis, -plinH, plinW, plinH + SEAM, profile);
  plinOuter = jitterRing(plinOuter, rng, jitterAmt * 0.25, { lockY: [-plinH], freezeSeams: true });
  asm.addPart("plinth", plinOuter);

  const baseTop = baseH;
  let baseOuter = bodyShell(axis, 0, baseW, baseTop, profile);
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
  const winKind = randPick(rng, profile.winKinds);
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

  // Corona central humana (cúpula grande o almenas en el centro del cuerpo)
  if (profile.remateMode === "human_mixed" && (palace || rng() < profile.centralCrownChance)) {
    const crown = palace && rng() < 0.65 ? "dome" : pickHumanCentralCrown(rng);
    applyCentralCrown(asm, crown, axis, baseTop, baseW, rng, jitterAmt);
  }

  // Contrafuertes (humanos y enanos)
  if (profile.buttressChance > 0 && rng() < profile.buttressChance) {
    const bCount = 2 + Math.floor(rng() * 2);
    const bH = baseH * randRange(rng, 0.42, 0.72);
    const bW = baseW * randRange(rng, 0.06, 0.1);
    for (let i = 0; i < bCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const wallEdge = axis + side * (baseW / 2);
      let butt = buttress(axis, wallEdge, 0, bW, bH);
      butt = jitterRing(butt, rng, jitterAmt * 0.35, { lockY: [0], freezeSeams: true });
      asm.addPart("decoration", butt);
    }
  }

  // Fachada élfica: arcadas orgánicas y arcos cruzados
  if (profile.remateMode === "elf_cap" && profile.arcadeRows > 0) {
    const clusterH = baseH * randRange(rng, 0.48, 0.68);
    const clusterW = baseW * randRange(rng, 0.72, 0.92);
    const clusterY = baseH * randRange(rng, 0.22, 0.32);
    for (const ring of elfArcadeCluster(axis, clusterY, clusterW, clusterH, profile.arcadeRows)) {
      asm.addPart("decoration", jitterRing(ring, rng, jitterAmt * 0.28));
    }
  } else if (rng() < profile.crossingArchChance) {
    const decoH = baseH * randRange(rng, 0.42, 0.58);
    const decoW = baseW * randRange(rng, 0.38, 0.52);
    const decoY = baseH * randRange(rng, 0.38, 0.48);
    for (const ring of crossingArches(axis, decoY, decoW, decoH)) {
      asm.addPart("decoration", jitterRing(ring, rng, jitterAmt * 0.35));
    }
  }

  // Pinchos malignos en la cornisa del cuerpo central
  if (profile.spikeChance > 0 && rng() < profile.spikeChance) {
    const spikeN = profile.spikeDensity[0]
      + Math.floor(rng() * (profile.spikeDensity[1] - profile.spikeDensity[0] + 1));
    const spikeH = baseH * randRange(rng, 0.12, 0.22);
    for (const spike of spikeRow(axis, baseTop - SEAM, baseW * 1.02, spikeN, spikeH + SEAM)) {
      asm.addPart("decoration", spike);
    }
  }

  // ── Bloques laterales (alas) ──────────────────────────────────────────────
  const blockCount = Math.floor(rng() * (profile.blockMax + 1));
  for (let b = 0; b < blockCount; b++) {
    const side = b % 2 === 0 ? -1 : 1;
    const blockW = baseW * randRange(rng, 0.22, 0.34);
    const blockH = baseH * randRange(rng, 0.5, 0.82);
    const blockCx = axis + side * (baseW / 2 + blockW * randRange(rng, 0.1, 0.4));
    const blockTop = blockH;
    let blockOuter = bodyShell(blockCx, 0, blockW, blockTop, profile);
    blockOuter = jitterRing(blockOuter, rng, jitterAmt, { lockY: [0, blockTop], freezeSeams: true });

    /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
    const blockHoles = [];
    if (rng() > 0.4) {
      blockHoles.push(aperture(blockCx, blockH * 0.45, blockW * 0.3, blockH * 0.26, winKind));
      if (arches[winKind] !== undefined) arches[winKind] += 1;
      windowCount += 1;
    }
    asm.addPart("block", blockOuter, blockHoles, {
      tiltDeg: (rng() - 0.5) * 2.4 * imperfection * profile.tiltScale,
    });

    // Tejado del bloque (humanos y malignos)
    if (profile.blockRoof) {
      const broofH = blockH * randRange(rng, 0.32, 0.5);
      let broof = gableRoof(blockCx, blockTop - SEAM, blockW * 1.06, broofH + SEAM);
      broof = jitterRing(broof, rng, jitterAmt * 0.7, { lockY: [blockTop - SEAM], freezeSeams: true });
      asm.addPart("roof", broof);
    }
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

  // Remate por facción: uniforme (maligno), caps élficos, mixto (humano) o monolítico (enano).
  const elfCapKind = profile.remateMode === "elf_cap" ? pickElfTowerCap(rng) : null;
  const towerRemate = profile.remateMode === "uniform" ? pickRemateForFaction(rng, profile) : null;

  towerXs.forEach((tcx, idx) => {
    const towerW = randRange(rng, profile.towerW[0], profile.towerW[1]);
    let hMul = randRange(rng, profile.hMul[0], profile.hMul[1]);
    // En ruinas, una torre queda truncada
    if (ruined && idx === towerCount - 1) hMul *= 0.55;
    const towerH = baseH * hMul;
    towerHeights.push(towerH);
    const towerTop = towerH;

    let towerOuter = bodyShell(tcx, 0, towerW, towerTop, profile);
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

    const tilt = (rng() - 0.5) * 3 * imperfection * profile.tiltScale;
    asm.addPart("tower", towerOuter, towerHoles, { tiltDeg: tilt });

    /** @type {string} */
    let remate;
    if (profile.remateMode === "human_mixed") {
      if (palace && rng() < 0.72) {
        remate = rng() < 0.45 ? "dome" : "dome_battlement";
      } else {
        remate = pickHumanTowerCap(rng, idx, towerCount);
      }
    } else if (profile.remateMode === "elf_cap") {
      remate = /** @type {'gothic_arch'|'inverted_arrow'} */ (elfCapKind);
    } else if (profile.remateMode === "none") {
      remate = "carved";
    } else {
      remate = /** @type {string} */ (towerRemate);
    }
    towersMeta.push({ remate });

    applyTowerCrown(asm, {
      profile,
      elfCapKind,
      remate,
      tcx,
      towerTop,
      towerW,
      tilt,
      rng,
      jitterAmt,
    });

    // Contrafuertes en torres (humanos)
    if (profile.remateMode === "human_mixed" && rng() < 0.55) {
      const side = tcx < axis ? -1 : 1;
      const wallEdge = axis + side * (baseW / 2);
      const bH = towerH * randRange(rng, 0.35, 0.55);
      const bW = towerW * randRange(rng, 0.35, 0.55);
      let tb = buttress(tcx, wallEdge, towerH * 0.2, bW, bH);
      tb = jitterRing(tb, rng, jitterAmt * 0.3, { freezeSeams: true });
      asm.addPart("decoration", tb, [], { tiltDeg: tilt });
    }
  });

  // Arbotantes élficos (torre ↔ muro)
  if (profile.flyingButtressChance > 0 && rng() < profile.flyingButtressChance) {
    towerXs.forEach((tcx) => {
      const side = tcx < axis ? -1 : 1;
      const wallX = axis + side * (baseW / 2);
      const y0 = baseH * randRange(rng, 0.5, 0.68);
      const y1 = towerHeights[towerXs.indexOf(tcx)] * randRange(rng, 0.48, 0.62);
      const thick = 1.4 + rng() * 1.2;
      asm.addPart("decoration", flyingButtress(wallX, y0, tcx, y1, thick));
    });
  }

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
    faction,
    factionLabel: profile.label,
    towerCount,
    blockCount,
    towers: towersMeta,
    towerRemate: profile.remateMode === "human_mixed"
      ? "mixed"
      : profile.remateMode === "elf_cap"
        ? elfCapKind
        : profile.remateMode === "none"
          ? "carved"
          : towerRemate,
    doorCount,
    windowCount,
    slitCount,
    arches,
    archDominant,
    asymmetry,
    localTowerMean: meanH,
    localTowerHeights: towerHeights,
  };

  return asm.build(palace ? "palace" : "castle", seed, style, meta);
}
