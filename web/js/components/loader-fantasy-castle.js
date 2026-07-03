/**
 * Builder de castillos y palacios (Fase 1 del motor de fantasía).
 *
 * Genera siluetas blancas detalladas, asimétricas e imperfectas:
 * cuerpo central rectangular + 2–5 torres con remates variados (tejado,
 * almenas o cúpula) + bloques laterales, con sustracciones de puerta y
 * ventanas mediante arcos góticos/románicos/flat/trilobulados.
 *
 * `castle` y `palace` comparten builder; cada aparición elige una facción
 * (humano, elfo, enano) que sesga arquitectura y decoración.
 *
 * @module loader-fantasy-castle
 */

import { ElementAssembler } from "./loader-fantasy-element.js";
import { generateElfCastleFromGraph } from "./loader-fantasy-elf-graph.js";
import {
  getFactionProfile,
  pickArchForFaction,
  pickElfTowerCap,
  pickFaction,
  pickHumanCastleCrown,
  pickRemateForFaction,
} from "./loader-fantasy-castle-factions.js";
import {
  aperture,
  arch,
  arcadeRow,
  buttress,
  chamferAperture,
  chamferRect,
  chamferTopAperture,
  chamferTopRect,
  crossingArches,
  dome,
  domeCropped,
  trapezoidTopChamfer,
  computePlinthLocalHeight,
  clampPartsToEnvelope,
  localBoundsFromParts,
  DEFAULT_TERRAIN_HEIGHT_PX,
  elfArcadeCluster,
  elfBridgeArcade,
  elfFlyingButtress,
  elfPetalFlare,
  elfRibCrown,
  elfSpireCluster,
  finial,
  flyingButtress,
  gableRoof,
  gothicArchCap,
  jitterRing,
  merlons,
  rect,
  spikeRow,
} from "./loader-fantasy-geom.js";
import { createRng, mixFantasySeed, randPick, randRange } from "./loader-ship-rng.js";

/** Solape vertical entre piezas para evitar huecos tras normalizar. */
const SEAM = 1.4;

/**
 * @param {number} tcx
 * @param {number} towerW
 * @param {number} doorCx
 * @param {number} doorW
 * @returns {boolean}
 */
function towerClearsDoor(tcx, pieceW, doorCx, doorW) {
  const dead = doorW / 2 + pieceW / 2 + 1;
  return Math.abs(tcx - doorCx) >= dead;
}

/**
 * @param {() => number} rng
 * @returns {number}
 */
function sampleTrapezoidTaper(rng) {
  return 0.08 + rng() * 0.14;
}

/**
 * @param {number} w
 * @param {number} taper
 * @returns {number}
 */
function trapezoidTopW(w, taper) {
  return w * (1 - Math.min(0.4, Math.max(0, taper)));
}

/**
 * Torre en el flanco de un nivel: dentro de la anchura superior del trapecio que la sostiene.
 * @param {() => number} rng
 * @param {-1|1} side
 * @param {number} axis
 * @param {number} supportTopW  anchura en la cima del trapecio inferior
 * @param {number} towerW
 * @param {number} doorCx
 * @param {number} doorW
 * @returns {number}
 */
function pickTierFlankTowerX(rng, side, axis, supportTopW, towerW, doorCx, doorW) {
  const inset = towerW / 2 + 1;
  const dead = doorW / 2 + towerW / 2 + 1;
  const half = supportTopW / 2;
  if (side < 0) {
    const maxCx = Math.min(axis - dead, axis + half - inset);
    const minCx = axis - half + inset;
    const lo = Math.min(minCx, maxCx);
    const hi = Math.max(minCx, maxCx);
    return lo + rng() * Math.max(0.3, hi - lo);
  }
  const minCx = Math.max(axis + dead, axis - half + inset);
  const maxCx = axis + half - inset;
  const lo = Math.min(minCx, maxCx);
  const hi = Math.max(minCx, maxCx);
  return lo + rng() * Math.max(0.3, hi - lo);
}

/**
 * Torre en el borde del zócalo (enanos): anclada al plinth, no al bastión central.
 * @param {() => number} rng
 * @param {-1|1} side
 * @param {number} axis
 * @param {number} plinthW
 * @param {number} towerW
 * @param {number} envLeft
 * @param {number} envRight
 * @param {number} doorCx
 * @param {number} doorW
 * @returns {number}
 */
function pickPlinthFlankTowerX(rng, side, axis, plinthW, towerW, envLeft, envRight, doorCx, doorW) {
  const inset = towerW / 2 + 2;
  const edgeCx = side < 0 ? envLeft + inset : envRight - inset;
  if (towerClearsDoor(edgeCx, towerW, doorCx, doorW)) {
    const wiggle = (rng() - 0.5) * towerW * 0.28;
    return edgeCx + (side < 0 ? Math.abs(wiggle) : -Math.abs(wiggle));
  }
  return pickTierFlankTowerX(rng, side, axis, plinthW * 0.55, towerW, doorCx, doorW);
}

/**
 * @param {import('./loader-fantasy-castle-factions.js').FactionProfile} profile
 * @param {number} baseY
 * @returns {boolean}
 */
function dwarfTowerOnPlinth(profile, baseY) {
  return profile.useTrapezoidBodies && baseY <= 0;
}

/**
 * Torre humana en el flanco exterior: asoma del muro sin tapar el cuerpo central.
 * @param {() => number} rng
 * @param {-1|1} side
 * @param {number} axis
 * @param {number} supportTopW
 * @param {number} towerW
 * @param {number} doorCx
 * @param {number} doorW
 * @param {number} envelopeHalf
 * @returns {number}
 */
function pickHumanOutsetTowerX(rng, side, axis, supportTopW, towerW, doorCx, doorW, envelopeHalf) {
  const wallOverlap = 0.7;
  let tcx = axis + side * (supportTopW / 2 + towerW / 2 - wallOverlap);
  if (!towerClearsDoor(tcx, towerW, doorCx, doorW)) {
    tcx = pickTierFlankTowerX(rng, side, axis, supportTopW, towerW, doorCx, doorW);
  }
  return clampCenterInEnvelope(tcx, towerW, axis - envelopeHalf, axis + envelopeHalf);
}

/**
 * @param {() => number} rng
 * @param {-1|1} side
 * @param {number} axis
 * @param {number} supportTopW
 * @param {number} towerW
 * @param {number} doorCx
 * @param {number} doorW
 * @param {import('./loader-fantasy-castle-factions.js').FactionProfile} profile
 * @param {number} envelopeHalf
 * @returns {number}
 */
function pickFlankTowerX(rng, side, axis, supportTopW, towerW, doorCx, doorW, profile, envelopeHalf) {
  if (profile.remateMode === "human_mixed") {
    return pickHumanOutsetTowerX(rng, side, axis, supportTopW, towerW, doorCx, doorW, envelopeHalf);
  }
  return pickTierFlankTowerX(rng, side, axis, supportTopW, towerW, doorCx, doorW);
}

/**
 * @param {number} cx
 * @param {number} w
 * @param {number} left
 * @param {number} right
 * @returns {number}
 */
function clampCenterInEnvelope(cx, w, left, right) {
  const hw = w / 2;
  return Math.max(left + hw, Math.min(right - hw, cx));
}

function pickCastleLevelCount(rng, profile) {
  if (profile.useTrapezoidBodies) {
    return randPick(rng, [2, 3, 4, 4]);
  }
  if (profile.useStackedLevels && profile.stackedLevelRange) {
    const [lo, hi] = profile.stackedLevelRange;
    /** @type {number[]} */
    const opts = [];
    for (let n = lo; n <= hi; n += 1) opts.push(n);
    return randPick(rng, opts);
  }
  return 1;
}

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
 * Silueta de muro según facción.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {import('./loader-fantasy-castle-factions.js').FactionProfile} profile
 * @param {() => number} [rng]
 * @returns {import('./loader-fantasy-geom.js').FPoint[]}
 */
function bodyShell(cx, baseY, w, h, profile, rng = () => 0.5) {
  if (profile.useTrapezoidBodies) {
    const taper = 0.08 + (rng() * 0.14);
    return trapezoidTopChamfer(cx, baseY, w, h, taper, profile.chamfer);
  }
  if (profile.bodyShape === "chamfer") {
    return chamferRect(cx, baseY, w, h, profile.chamfer);
  }
  return rect(cx, baseY, w, h);
}

/**
 * Vano de puerta: arco curvo o hueco achaflanado (enano, solo arriba).
 */
function doorVano(profile, cx, baseY, w, h, archKind) {
  if (profile.useChamferApertures) {
    return profile.useTrapezoidBodies
      ? chamferTopAperture(cx, baseY, w, h, profile.chamfer)
      : chamferAperture(cx, baseY, w, h, profile.chamfer);
  }
  return arch(cx, baseY, w, h, archKind);
}

/**
 * Vano de ventana / saetera.
 */
function windowVano(profile, cx, baseY, w, h, kind) {
  if (profile.useChamferApertures) {
    return profile.useTrapezoidBodies
      ? chamferTopAperture(cx, baseY, w, h, profile.chamfer)
      : chamferAperture(cx, baseY, w, h, profile.chamfer);
  }
  return aperture(cx, baseY, w, h, kind);
}

/**
 * Columnas tipo dolmen en flancos (nunca en la puerta central).
 */
function addDolmenColumns(asm, rng, axis, flankW, baseH, profile, doorCx, doorW, force = false) {
  if (!force && profile.dolmenChance > 0 && rng() >= profile.dolmenChance) return [];

  const count = 1 + Math.floor(rng() * 3); // 1–3, siempre en flancos
  const colW = flankW * randRange(rng, 0.055, 0.09);
  const colH = baseH * randRange(rng, 0.55, 0.95);
  const slabW = colW * randRange(rng, 1.6, 2.4);
  const slabH = colW * randRange(rng, 0.5, 0.85);
  const chamf = Math.min(profile.chamfer, colW * 0.35);
  const pieceW = Math.max(colW, slabW);
  /** @type {number[]} */
  const centers = [];

  for (let i = 0; i < count; i += 1) {
    const side = /** @type {-1|1} */ (i % 2 === 0 ? -1 : 1);
    const cx = pickTierFlankTowerX(rng, side, axis, flankW, pieceW, doorCx, doorW);
    if (!towerClearsDoor(cx, pieceW, doorCx, doorW)) continue;
    centers.push(cx);
    asm.addPart("decoration", chamferRect(cx, 0, colW, colH, chamf));
    asm.addPart("decoration", chamferTopRect(cx, colH - SEAM, slabW, slabH + SEAM, chamf));
  }
  return centers;
}

/**
 * Base Y común del parapeto (almenas y cúpulas al mismo nivel sobre el muro).
 * @param {number} attachY  cima del muro / torre
 * @returns {number}
 */
function parapetBaseY(attachY) {
  return attachY - SEAM * 0.35;
}

/** Fracción del paso que ocupa cada merlón (merlón ≈ hueco). */
const MERLON_FILL = 0.55;

/**
 * @param {number} w
 * @param {() => number} rng
 * @param {number|undefined} fixed
 * @returns {number}
 */
function pickMerlonCount(w, rng, fixed) {
  if (fixed != null) return Math.max(2, fixed);
  if (w < 22) return 3;
  const pitch = randRange(rng, 7, 9.5);
  const n = Math.round(w / pitch);
  return Math.max(6, Math.min(11, n));
}

/**
 * Almenas: imposta + dientes, centradas en `tcx` y de borde a borde.
 * @param {ElementAssembler} asm
 * @param {number} tcx
 * @param {number} attachY  cima del muro en coords locales (y-up)
 * @param {number} w
 * @param {number} wallH  altura del muro que sostiene el parapeto
 * @param {() => number} rng
 * @param {number} [merCount]
 */
function addMerlons(asm, tcx, attachY, w, wallH, rng, merCount) {
  const count = pickMerlonCount(w, rng, merCount);
  const pitch = w / count;
  const merW = pitch * MERLON_FILL;
  const parapetTotalH = Math.max(w * 0.1, wallH * 0.12);
  const sillH = parapetTotalH * 0.42;
  const toothH = Math.min(parapetTotalH - sillH, merW * 0.82);
  const parapetY = parapetBaseY(attachY);
  asm.addPart("battlement", rect(tcx, parapetY, w, sillH));
  asm.addPart("battlement", merlons(tcx, parapetY + sillH, w, count, toothH, MERLON_FILL));
}

/**
 * Cúpula con base en el parapeto (mismo nivel que almenas, no encima).
 */
function addDomeOnParapet(
  asm, cx, attachY, w, profile, rng, rxFrac = 0.56, ryRange = [0.55, 0.92],
) {
  const parapetY = parapetBaseY(attachY);
  const cropR = randRange(rng, 0.35, 0.55);
  const domeRy = w * randRange(rng, ryRange[0], ryRange[1]);
  const rx = w * rxFrac;
  const domePts = profile.useCroppedDome
    ? domeCropped(cx, parapetY, rx, domeRy + SEAM, cropR)
    : dome(cx, parapetY, rx, domeRy + SEAM);
  asm.addPart("dome", domePts);
}

/** @typedef {'triple'|'flank_dome'|'split'} ParapetMixStyle */

/**
 * Mezcla almenas (ancho completo) y cúpula centrada en la misma cornisa.
 */
function applyMixedParapetCrown(asm, cx, attachY, w, wallH, profile, rng, mixStyle) {
  addMerlons(asm, cx, attachY, w, wallH, rng);
  const domeScale = mixStyle === "triple" ? 0.44 : mixStyle === "split" && rng() < 0.5 ? 0.5 : 0.52;
  const ryRange = mixStyle === "triple" ? [0.38, 0.58] : [0.48, 0.78];
  addDomeOnParapet(asm, cx, attachY, w * domeScale, profile, rng, 0.5, ryRange);
}

/**
 * @param {ElementAssembler} asm
 * @param {{
 *   profile: import('./loader-fantasy-castle-factions.js').FactionProfile;
 *   elfCapKind: import('./loader-fantasy-castle-factions.js').ElfCapKind|null;
 *   remate: string;
 *   tcx: number;
 *   towerTop: number;
 *   towerW: number;
 *   towerH: number;
 *   tilt: number;
 *   rng: () => number;
 *   jitterAmt: number;
 *   isCentral?: boolean;
 *   parapetMix?: ParapetMixStyle|null;
 * }} opts
 */
function applyTowerCrown(asm, opts) {
  const {
    profile, elfCapKind, remate, tcx, towerTop, towerW, towerH, tilt, rng, jitterAmt,
    isCentral = false,
    parapetMix = null,
  } = opts;

  if (profile.remateMode === "none") return;

  if (profile.remateMode === "elf_cap" && elfCapKind) {
    const baseCapY = towerTop - SEAM;
    const capH = towerW * randRange(rng, isCentral ? 1.75 : 1.35, isCentral ? 2.75 : 2.15);
    const capW = towerW * randRange(rng, 0.9, 1.14);

    /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
    let rings = [];

    if (elfCapKind === "rib_crown") {
      rings = elfRibCrown(tcx, baseCapY, capW, capH);
      rings.push(...finial(tcx, baseCapY + capH * 0.32, capH * randRange(rng, 0.75, 1.05), "needle"));
    } else if (elfCapKind === "spire_cluster" || elfCapKind === "inverted_arrow") {
      rings = elfSpireCluster(tcx, baseCapY, capW, capH);
    } else {
      const archH = capH * 1.08;
      rings = [gothicArchCap(tcx, baseCapY, capW, archH)];
      rings.push(...crossingArches(tcx, baseCapY + archH * 0.12, capW * 0.52, archH * 0.62));
      rings.push(...finial(tcx, baseCapY + archH * 0.68, capH * randRange(rng, 0.7, 0.95), "needle"));
    }

    for (const ring of rings) {
      if (!ring || ring.length < 3) continue;
      const j = jitterRing(ring, rng, jitterAmt * 0.32, { lockY: [baseCapY], freezeSeams: true });
      asm.addPart("decoration", j, [], { tiltDeg: tilt });
    }
    return;
  }

  if (remate === "battlement") {
    addMerlons(asm, tcx, towerTop, towerW, towerH, rng);
    return;
  }

  if (remate === "dome") {
    addDomeOnParapet(asm, tcx, towerTop, towerW, profile, rng);
    if (rng() < profile.finialChance) {
      const fk = randPick(rng, profile.finialKinds);
      const parapetY = parapetBaseY(towerTop);
      const domeRy = towerW * randRange(rng, 0.55, 0.92);
      for (const ring of finial(tcx, parapetY + domeRy, towerW * 0.5, fk)) {
        asm.addPart("decoration", ring);
      }
    }
    return;
  }

  if (remate === "dome_battlement") {
    const mix = parapetMix ?? /** @type {ParapetMixStyle} */ (randPick(rng, ["flank_dome", "split", "triple"]));
    applyMixedParapetCrown(asm, tcx, towerTop, towerW, towerH, profile, rng, mix);
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
/**
 * @param {import('./loader-fantasy-castle-factions.js').FactionProfile} profile
 * @param {ParapetMixStyle|null} [parapetMix]
 */
function applyCentralCrown(asm, crown, cx, topY, w, wallH, rng, _jitterAmt, profile, parapetMix = null) {
  if (crown === "battlement") {
    addMerlons(asm, cx, topY, w, wallH, rng);
    return;
  }
  if (crown === "dome") {
    addDomeOnParapet(asm, cx, topY, w, profile, rng, 0.38, [0.22, 0.34]);
    return;
  }
  if (crown === "dome_battlement") {
    const mix = parapetMix ?? /** @type {ParapetMixStyle} */ (randPick(rng, ["triple", "flank_dome", "split"]));
    applyMixedParapetCrown(asm, cx, topY, w, wallH, profile, rng, mix);
  }
}

/**
 * Genera un castillo o palacio.
 *
 * @param {{ seed:number; variant?:number; style?:string; palace?:boolean; faction?:string; imperfection?:number; terrainHeightPx?:number; castleSizePx?: number }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateCastle(options) {
  const seed = options.seed >>> 0;
  const variant = options.variant ?? 0;
  const effectiveSeed = mixFantasySeed(seed, variant);
  const palace = !!options.palace;
  const imperfection = options.imperfection ?? 0.55;
  const rng = createRng(effectiveSeed);
  const faction = /** @type {import('./loader-fantasy-castle-factions.js').CastleFaction} */ (
    options.faction ?? pickFaction(rng, palace)
  );
  const profile = getFactionProfile(faction);

  if (faction === "elf") {
    const elfRng = createRng(effectiveSeed);
    const style = options.style ?? pickStyle(elfRng, palace);
    return generateElfCastleFromGraph(
      {
        seed,
        variant,
        palace,
        style,
        imperfection,
        terrainHeightPx: options.terrainHeightPx,
        castleSizePx: options.castleSizePx,
      },
      elfRng,
    );
  }

  const style = options.style ?? pickStyle(rng, palace);
  /** @type {'battlement'|'dome'|'dome_battlement'|null} */
  const humanCastleCrown = profile.remateMode === "human_mixed"
    ? pickHumanCastleCrown(rng, palace)
    : null;
  /** @type {ParapetMixStyle|null} */
  const humanParapetMix = humanCastleCrown === "dome_battlement"
    ? /** @type {ParapetMixStyle} */ (randPick(rng, ["triple", "flank_dome", "split"]))
    : null;

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
  const axisShift = (rng() - 0.5) * 2 * (asym * 4);
  const axis = 50 + axisShift;
  const plinW = baseW * randRange(rng, 1.5, 2.0);
  const envLeft = axis - plinW / 2;
  const envRight = axis + plinW / 2;
  const envelopeHalf = plinW / 2;

  const baseTop = baseH;
  let stackTop = baseTop;
  const baseTaper = profile.useTrapezoidBodies ? sampleTrapezoidTaper(rng) : 0;
  let baseOuter = profile.useTrapezoidBodies
    ? trapezoidTopChamfer(axis, 0, baseW, baseTop, baseTaper, profile.chamfer)
    : bodyShell(axis, 0, baseW, baseTop, profile, rng);
  baseOuter = jitterRing(baseOuter, rng, jitterAmt, { lockY: [0, baseTop], freezeSeams: true });

  /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
  const baseHoles = [];

  // Puerta principal (arco grande, posición asimétrica)
  const doorW = baseW * randRange(rng, 0.14, 0.2);
  const doorH = baseH * randRange(rng, 0.46, 0.62);
  const doorCx = axis;
  baseHoles.push(doorVano(profile, doorCx, 0, doorW, doorH, archDominant));
  if (!profile.useChamferApertures) arches[archDominant] += 1;
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
    baseHoles.push(windowVano(profile, wx, winY, winW, winH, winKind));
    if (!profile.useChamferApertures && arches[winKind] !== undefined) arches[winKind] += 1;
    windowCount += 1;
  }
  // Garantiza al menos una ventana aunque el filtro anterior las descarte
  if (windowCount === 0) {
    const wx = axis - baseW * 0.32;
    baseHoles.push(windowVano(profile, wx, winY, winW, winH, winKind));
    if (!profile.useChamferApertures && arches[winKind] !== undefined) arches[winKind] += 1;
    windowCount += 1;
  }

  asm.addPart("base", baseOuter, baseHoles);

  // Niveles apilados (enanos: 2–4 niveles; cada uno más estrecho)
  let dwarfTierCount = 0;
  let castleLevelCount = 1;
  /** @type {{ baseY: number; w: number; topW: number }[]} */
  const levelBands = [{ baseY: 0, w: baseW, topW: trapezoidTopW(baseW, baseTaper) }];
  const useStackedTiers = profile.useTrapezoidBodies || profile.useStackedLevels;
  if (useStackedTiers) {
    castleLevelCount = pickCastleLevelCount(rng, profile);
    const extraTiers = castleLevelCount - 1;
    let tierW = baseW;
    for (let t = 0; t < extraTiers; t += 1) {
      tierW *= randRange(rng, 0.58, 0.78);
      tierW = Math.min(tierW, plinW * 0.9);
      const tierH = baseH * randRange(rng, 0.45, 0.68);
      const tierTaper = profile.useTrapezoidBodies ? sampleTrapezoidTaper(rng) : 0;
      let tierOuter = profile.useTrapezoidBodies
        ? trapezoidTopChamfer(
          axis,
          stackTop - SEAM,
          tierW,
          tierH + SEAM,
          tierTaper,
          profile.chamfer,
        )
        : bodyShell(axis, stackTop - SEAM, tierW, tierH + SEAM, profile, rng);
      tierOuter = jitterRing(tierOuter, rng, jitterAmt * 0.35, {
        lockY: [stackTop - SEAM, stackTop + tierH],
        freezeSeams: true,
      });
      /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
      const tierHoles = [];
      if (rng() > 0.2) {
        const winSide = /** @type {-1|1} */ (rng() < 0.5 ? -1 : 1);
        const winCx = axis + winSide * tierW * randRange(rng, 0.22, 0.32);
        tierHoles.push(
          windowVano(profile, winCx, stackTop + tierH * 0.35, tierW * 0.2, tierH * 0.24, "flat"),
        );
        windowCount += 1;
      }
      asm.addPart("block", tierOuter, tierHoles);
      levelBands.push({
        baseY: stackTop,
        w: tierW,
        topW: profile.useTrapezoidBodies ? trapezoidTopW(tierW, tierTaper) : tierW,
      });
      stackTop += tierH;
      dwarfTierCount += 1;
    }
  }

  if (humanCastleCrown) {
    const topBand = levelBands[levelBands.length - 1];
    const centralWallH = stackTop - topBand.baseY;
    applyCentralCrown(
      asm, humanCastleCrown, axis, stackTop, topBand.w, centralWallH,
      rng, jitterAmt, profile, humanParapetMix,
    );
  }

  /** @type {number[]} */
  let dolmenXs = [];
  // Columnas tipo dolmen (enanos: siempre al menos un grupo)
  if (profile.useTrapezoidBodies) {
    dolmenXs = addDolmenColumns(asm, rng, axis, baseW, baseH, profile, doorCx, doorW, true);
  } else if (profile.dolmenChance > 0 && rng() < profile.dolmenChance) {
    dolmenXs = addDolmenColumns(asm, rng, axis, baseW, baseH, profile, doorCx, doorW);
  }

  // Contrafuertes (enanos; humanos sin columnas laterales flotantes)
  if (profile.buttressChance > 0 && rng() < profile.buttressChance) {
    const bCount = 2 + Math.floor(rng() * 2);
    const bH = baseH * randRange(rng, 0.42, 0.72);
    const bW = Math.min(baseW * randRange(rng, 0.06, 0.1), plinW * 0.12);
    for (let i = 0; i < bCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const wallEdge = profile.remateMode === "human_mixed"
        ? pickTierFlankTowerX(rng, /** @type {-1|1} */ (side), axis, baseW, bW, doorCx, doorW)
        : clampCenterInEnvelope(axis + side * (plinW / 2 - bW * 0.2), bW, envLeft, envRight);
      let butt = buttress(axis, wallEdge, 0, bW, bH);
      butt = jitterRing(butt, rng, jitterAmt * 0.35, { lockY: [0], freezeSeams: true });
      asm.addPart("decoration", butt);
    }
  }

  // Fachada élfica: arcadas orgánicas y arcos cruzados
  if (profile.remateMode === "elf_cap" && profile.arcadeRows > 0) {
    const clusterH = baseH * randRange(rng, 0.52, 0.72);
    const clusterW = baseW * randRange(rng, 0.78, 0.96);
    const clusterY = baseH * randRange(rng, 0.18, 0.28);
    for (const ring of elfArcadeCluster(axis, clusterY, clusterW, clusterH, profile.arcadeRows)) {
      asm.addPart("decoration", jitterRing(ring, rng, jitterAmt * 0.22));
    }
    const bridgeW = baseW * randRange(rng, 0.58, 0.82);
    const bridgeH = baseH * randRange(rng, 0.4, 0.55);
    const bridgeCount = 2 + Math.floor(rng() * 2);
    for (const ring of elfBridgeArcade(doorCx, 0, bridgeW, bridgeH, bridgeCount)) {
      asm.addPart("decoration", jitterRing(ring, rng, jitterAmt * 0.2));
    }
    arches.gothic += bridgeCount;
  } else if (rng() < profile.crossingArchChance) {
    const decoH = baseH * randRange(rng, 0.42, 0.58);
    const decoW = baseW * randRange(rng, 0.38, 0.52);
    const decoY = baseH * randRange(rng, 0.38, 0.48);
    for (const ring of crossingArches(axis, decoY, decoW, decoH)) {
      asm.addPart("decoration", jitterRing(ring, rng, jitterAmt * 0.35));
    }
  }

  // Pinchos opcionales en cornisa (perfil con spikeChance > 0)
  if (profile.spikeChance > 0 && rng() < profile.spikeChance) {
    const spikeN = profile.spikeDensity[0]
      + Math.floor(rng() * (profile.spikeDensity[1] - profile.spikeDensity[0] + 1));
    const spikeH = baseH * randRange(rng, 0.12, 0.22);
    for (const spike of spikeRow(axis, stackTop - SEAM, plinW * 0.96, spikeN, spikeH + SEAM)) {
      asm.addPart("decoration", spike);
    }
  }

  // ── Bloques laterales (alas) ──────────────────────────────────────────────
  const blockCount = Math.floor(rng() * (profile.blockMax + 1));
  for (let b = 0; b < blockCount; b++) {
    const side = b % 2 === 0 ? -1 : 1;
    const isElf = profile.remateMode === "elf_cap";
    const blockW = Math.min(
      baseW * randRange(rng, isElf ? 0.18 : 0.22, isElf ? 0.28 : 0.34),
      plinW * 0.38,
    );
    const blockH = baseH * randRange(rng, isElf ? 0.55 : 0.5, isElf ? 0.9 : 0.82);
    // Humanos: alas asomadas hacia dentro (sin columnas flotantes).
    // Resto de facciones: alas ancladas al borde del zócalo (como históricamente).
    const blockCx = profile.remateMode === "human_mixed"
      ? pickTierFlankTowerX(rng, /** @type {-1|1} */ (side), axis, baseW, blockW, doorCx, doorW)
      : clampCenterInEnvelope(axis + side * (plinW / 2 - blockW / 2 - 1), blockW, envLeft, envRight);
    const blockTop = blockH;
    let blockOuter = bodyShell(blockCx, 0, blockW, blockTop, profile, rng);
    blockOuter = jitterRing(blockOuter, rng, jitterAmt, { lockY: [0, blockTop], freezeSeams: true });

    /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
    const blockHoles = [];
    if (isElf) {
      const archN = 2 + Math.floor(rng() * 2);
      for (let a = 0; a < archN; a++) {
        const ax = blockCx + (a - (archN - 1) / 2) * blockW * 0.26;
        blockHoles.push(aperture(ax, blockH * 0.32, blockW * 0.2, blockH * 0.5, "gothic"));
        arches.gothic += 1;
        windowCount += 1;
      }
    } else if (rng() > 0.4) {
      blockHoles.push(windowVano(profile, blockCx, blockH * 0.45, blockW * 0.3, blockH * 0.26, winKind));
      if (!profile.useChamferApertures && arches[winKind] !== undefined) arches[winKind] += 1;
      windowCount += 1;
    }
    const blockTilt = (rng() - 0.5) * 2.4 * imperfection * profile.tiltScale;
    asm.addPart("block", blockOuter, blockHoles, { tiltDeg: blockTilt });

    if (isElf) {
      const broofH = blockH * randRange(rng, 0.58, 0.85);
      let broof = gableRoof(blockCx, blockTop - SEAM, blockW * 0.86, broofH + SEAM);
      broof = jitterRing(broof, rng, jitterAmt * 0.45, { lockY: [blockTop - SEAM], freezeSeams: true });
      asm.addPart("roof", broof, [], { tiltDeg: blockTilt });
      for (const ring of finial(blockCx, blockTop + broofH - SEAM, broofH * 0.5, "needle")) {
        asm.addPart("decoration", ring);
      }
      for (const ring of elfArcadeCluster(blockCx, blockH * 0.18, blockW * 0.88, blockH * 0.5, 2)) {
        asm.addPart("decoration", jitterRing(ring, rng, jitterAmt * 0.18));
      }
    } else if (profile.blockRoof) {
      const broofH = blockH * randRange(rng, 0.32, 0.5);
      let broof = gableRoof(blockCx, blockTop - SEAM, blockW * 1.06, broofH + SEAM);
      broof = jitterRing(broof, rng, jitterAmt * 0.7, { lockY: [blockTop - SEAM], freezeSeams: true });
      asm.addPart("roof", broof);
    }
  }

  // ── Torres (solo flancos del nivel que las sostiene; nunca sobre la puerta) ─
  const maxTowerW = profile.towerW[1];
  /** @type {{ tcx: number; baseY: number; levelW: number; supportTopW: number; towerW: number }[]} */
  const towerPlans = [];

  const baseTowerW = randRange(rng, profile.towerW[0], profile.towerW[1]);
  towerPlans.push({
    tcx: dwarfTowerOnPlinth(profile, 0)
      ? pickPlinthFlankTowerX(rng, -1, axis, plinW, baseTowerW, envLeft, envRight, doorCx, doorW)
      : pickFlankTowerX(rng, -1, axis, baseW, baseTowerW, doorCx, doorW, profile, envelopeHalf),
    baseY: 0,
    levelW: baseW,
    supportTopW: baseW,
    towerW: baseTowerW,
  });
  const baseTowerW2 = randRange(rng, profile.towerW[0], profile.towerW[1]);
  towerPlans.push({
    tcx: dwarfTowerOnPlinth(profile, 0)
      ? pickPlinthFlankTowerX(rng, 1, axis, plinW, baseTowerW2, envLeft, envRight, doorCx, doorW)
      : pickFlankTowerX(rng, 1, axis, baseW, baseTowerW2, doorCx, doorW, profile, envelopeHalf),
    baseY: 0,
    levelW: baseW,
    supportTopW: baseW,
    towerW: baseTowerW2,
  });

  if (useStackedTiers) {
    for (let li = 1; li < levelBands.length; li += 1) {
      if (profile.remateMode === "human_mixed") continue;
      const band = levelBands[li];
      const support = levelBands[li - 1];
      if (rng() > 0.55) continue;
      const side = /** @type {-1|1} */ (rng() < 0.5 ? -1 : 1);
      const tw = Math.min(
        randRange(rng, profile.towerW[0], profile.towerW[1]),
        support.topW * 0.88,
      );
      const tcx = pickFlankTowerX(rng, side, axis, support.topW, tw, doorCx, doorW, profile, envelopeHalf);
      if (!towerClearsDoor(tcx, tw, doorCx, doorW)) continue;
      towerPlans.push({
        tcx,
        baseY: band.baseY,
        levelW: band.w,
        supportTopW: support.topW,
        towerW: tw,
      });
    }
  } else {
    const extraTowers = 2 + Math.floor(rng() * 3);
    for (let t = 2; t < extraTowers; t++) {
      const side = /** @type {-1|1} */ (rng() < 0.5 ? -1 : 1);
      const tw = maxTowerW;
      let tcx = pickFlankTowerX(rng, side, axis, baseW, tw, doorCx, doorW, profile, envelopeHalf);
      if (!towerClearsDoor(tcx, tw, doorCx, doorW)) continue;
      towerPlans.push({
        tcx,
        baseY: 0,
        levelW: baseW,
        supportTopW: baseW,
        towerW: tw,
      });
    }
  }

  const towerCount = towerPlans.length;
  /** @type {number[]} */
  const towerHeights = [];
  /** @type {number[]} */
  const towerXs = [];

  const elfCapKind = profile.remateMode === "elf_cap" ? pickElfTowerCap(rng) : null;
  const towerRemate = profile.remateMode === "uniform" ? pickRemateForFaction(rng, profile) : null;
  const centralTowerIdx = Math.floor(towerCount / 2);

  /** @type {number[]} */
  const towerWidths = [];

  towerPlans.forEach((plan, idx) => {
    const supportTopW = plan.supportTopW ?? baseW;
    let towerW = plan.towerW ?? randRange(rng, profile.towerW[0], profile.towerW[1]);
    if (plan.baseY > 0) {
      towerW = Math.min(towerW, supportTopW * 0.88);
    }
    const supportHalf = supportTopW / 2;
    const onPlinth = dwarfTowerOnPlinth(profile, plan.baseY);
    const clampLeft = profile.remateMode === "human_mixed" || onPlinth
      ? envLeft
      : axis - supportHalf;
    const clampRight = profile.remateMode === "human_mixed" || onPlinth
      ? envRight
      : axis + supportHalf;
    let tcx = clampCenterInEnvelope(
      plan.tcx,
      towerW,
      clampLeft,
      clampRight,
    );
    if (!towerClearsDoor(tcx, towerW, doorCx, doorW)) {
      const side = /** @type {-1|1} */ (tcx < axis ? -1 : 1);
      tcx = onPlinth
        ? pickPlinthFlankTowerX(rng, side, axis, plinW, towerW, envLeft, envRight, doorCx, doorW)
        : pickFlankTowerX(rng, side, axis, supportTopW, towerW, doorCx, doorW, profile, envelopeHalf);
      tcx = clampCenterInEnvelope(tcx, towerW, clampLeft, clampRight);
    }
    const towerBaseY = plan.baseY;
    let towerH;
    if (plan.baseY > 0) {
      towerH = plan.levelW * randRange(rng, 0.5, 0.95);
    } else if (profile.towerHByWidth) {
      const [tMin, tMax] = profile.towerHByWidth;
      towerH = towerW * randRange(rng, tMin, tMax);
      towerH = Math.max(towerH, baseH * randRange(rng, 1.08, 1.52));
    } else {
      let hMul = randRange(rng, profile.hMul[0], profile.hMul[1]);
      if (profile.remateMode === "elf_cap" && idx === centralTowerIdx) {
        hMul *= randRange(rng, 1.12, 1.22);
      }
      towerH = baseH * hMul;
    }
    if (ruined && idx === towerCount - 1) towerH *= 0.55;
    const towerTop = towerBaseY + towerH;
    towerHeights.push(towerTop);
    towerXs.push(tcx);
    towerWidths.push(towerW);

    let towerOuter = bodyShell(tcx, towerBaseY, towerW, towerH, profile, rng);
    towerOuter = jitterRing(towerOuter, rng, jitterAmt, {
      lockY: [towerBaseY, towerTop],
      freezeSeams: true,
    });

    /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
    const towerHoles = [];
    if (profile.remateMode === "elf_cap") {
      const lancets = 2 + Math.floor(rng() * 2);
      for (let s = 0; s < lancets; s++) {
        const sy = towerBaseY + towerH * (0.32 + s * 0.2);
        if (sy + towerH * 0.22 > towerBaseY + towerH * 0.88) break;
        towerHoles.push(aperture(tcx, sy, towerW * 0.2, towerH * 0.26, "gothic"));
        arches.gothic += 1;
        windowCount += 1;
      }
      const belfryY = towerBaseY + towerH * randRange(rng, 0.72, 0.8);
      towerHoles.push(aperture(tcx, belfryY, towerW * 0.78, towerH * 0.14, "gothic"));
      arches.gothic += 1;
    } else {
      const slits = 1 + Math.floor(rng() * 2);
      for (let s = 0; s < slits; s++) {
        const sy = towerBaseY + towerH * (0.4 + s * 0.25);
        if (sy + towerW * 0.5 > towerTop) break;
        towerHoles.push(windowVano(profile, tcx, sy, towerW * 0.16, towerH * 0.14, "flat"));
        if (!profile.useChamferApertures) arches.flat += 1;
        slitCount += 1;
      }
      if (rng() > 0.5) {
        const wy = towerBaseY + towerH * 0.68;
        towerHoles.push(windowVano(profile, tcx, wy, towerW * 0.34, towerH * 0.12, winKind));
        if (!profile.useChamferApertures && arches[winKind] !== undefined) arches[winKind] += 1;
        windowCount += 1;
      }
    }

    const tilt = (rng() - 0.5) * 3 * imperfection * profile.tiltScale;
    asm.addPart("tower", towerOuter, towerHoles, { tiltDeg: tilt });

    /** @type {string} */
    let remate;
    if (profile.remateMode === "human_mixed") {
      remate = /** @type {string} */ (humanCastleCrown);
    } else if (profile.remateMode === "elf_cap") {
      remate = /** @type {'gothic_arch'|'inverted_arrow'} */ (elfCapKind);
    } else if (profile.remateMode === "none") {
      remate = "carved";
    } else {
      remate = /** @type {string} */ (towerRemate);
    }
    towersMeta.push({ remate, baseY: towerBaseY });

    applyTowerCrown(asm, {
      profile,
      elfCapKind,
      remate,
      tcx,
      towerTop,
      towerW,
      towerH,
      tilt,
      rng,
      jitterAmt,
      isCentral: idx === centralTowerIdx,
      parapetMix: humanParapetMix,
    });

    if (profile.remateMode === "elf_cap" && rng() < 0.78) {
      const midY = towerBaseY + towerH * randRange(rng, 0.44, 0.56);
      const petalH = towerW * randRange(rng, 0.85, 1.35);
      for (const petal of elfPetalFlare(tcx, midY, towerW, petalH)) {
        asm.addPart("decoration", jitterRing(petal, rng, jitterAmt * 0.25), [], { tiltDeg: tilt });
      }
    }
  });

  // Arbotantes élficos (torre ↔ muro)
  if (profile.flyingButtressChance > 0 && rng() < profile.flyingButtressChance) {
    towerXs.forEach((tcx, ti) => {
      const side = tcx < axis ? -1 : 1;
      const wallX = clampCenterInEnvelope(axis + side * (plinW / 2 - 1), 2, envLeft, envRight);
      const y0 = baseH * randRange(rng, 0.48, 0.66);
      const apex = towerHeights[ti];
      const tBase = towersMeta[ti]?.baseY ?? 0;
      const y1 = tBase + (apex - tBase) * randRange(rng, 0.42, 0.58);
      const thick = 0.9 + rng() * 0.9;
      const butt = profile.remateMode === "elf_cap"
        ? elfFlyingButtress(wallX, y0, tcx, y1, thick)
        : flyingButtress(wallX, y0, tcx, y1, thick);
      asm.addPart("decoration", butt);
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

  clampPartsToEnvelope(asm._parts, envLeft, envRight);

  const heightAbove = asm._parts.reduce(
    (maxY, p) => Math.max(maxY, ...p.outer.map((pt) => pt.y)),
    0,
  );
  const plinH =
    computePlinthLocalHeight(
      heightAbove,
      options.terrainHeightPx,
      options.castleSizePx,
    ) * (profile.plinthHeightFactor ?? 1);
  asm._parts.unshift({
    role: "plinth",
    outer: rect(axis, -plinH, plinW, plinH + SEAM),
    holes: [],
  });

  const localBounds = localBoundsFromParts(asm._parts);

  const meta = {
    style,
    palace,
    faction,
    variant,
    factionLabel: profile.label,
    towerCount,
    blockCount,
    towers: towersMeta,
    towerXs,
    towerSupportTopW: towerPlans.map((p) => p.supportTopW),
    towerWs: towerWidths,
    dolmenXs,
    levelBandTops: levelBands.map((b) => b.topW),
    baseW,
    axis,
    doorW,
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
    dwarfTierCount,
    castleLevelCount,
    humanCastleCrown,
    humanParapetMix,
    plinthLocalH: plinH,
    plinthTerrainPx: options.terrainHeightPx ?? DEFAULT_TERRAIN_HEIGHT_PX,
    heightAboveGround: heightAbove,
    envelopeW: plinW,
    envelopeLeft: envLeft,
    envelopeRight: envRight,
    localMinX: localBounds.minX,
    localMaxX: localBounds.maxX,
    normalizeScaleBy: "height",
  };

  return asm.build(palace ? "palace" : "castle", seed, style, meta);
}
