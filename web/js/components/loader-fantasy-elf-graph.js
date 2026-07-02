/**
 * Planificador de grafos de construcción para castillos élficos.
 *
 * Reconstrucción incremental (fase 5): zócalo + arco + arcadas + tejados + torres sobre tejados.
 *
 * @module loader-fantasy-elf-graph
 */

import {
  addNode,
  createGraph,
  executeGraph,
} from "./loader-fantasy-compose.js";
import { ElementAssembler } from "./loader-fantasy-element.js";
import { getFactionProfile } from "./loader-fantasy-castle-factions.js";
import { ensureModulesRegistered } from "./loader-fantasy-modules.js";
import {
  clampPartsToEnvelope,
  computePlinthLocalHeight,
  DEFAULT_TERRAIN_HEIGHT_PX,
  localBoundsFromParts,
  planElfRoofTowerPlacements,
  rect,
  scaleFantasyPartsLocal,
} from "./loader-fantasy-geom.js";
import { createRng, hashSeed, mixFantasySeed, randRange } from "./loader-ship-rng.js";

const SEAM = 1.4;
/** Arco central élfico: escala respecto a los rangos base (−30 %). */
export const ELF_DOOR_SIZE_FACTOR = 0.7;
/** Zócalo élfico: altura respecto al cálculo estándar (factor ajustado; +10 % sobre 0.3375). */
export const ELF_PLINTH_HEIGHT_FACTOR = 0.37125;
/** Arcos laterales: altura respecto al arco central. */
export const ELF_FLANK_ARCH_HEIGHT = { min: 0.48, max: 0.62 };
/** Arcos entrecruzados por flanco (zócalo ↔ arco central). */
export const ELF_FLANK_INTERLACE_COUNT = 5;
/** Tejado lateral: altura del trapecio regular (fracción de `flankArchH`). */
export const ELF_FLANK_ROOF_HEIGHT = { min: 0.28, max: 0.38 };
/** Estrechamiento de la cumbrera respecto al ancho de arcadas. */
export const ELF_FLANK_ROOF_TOP_TAPER = 0.12;
/** Filas de tejas en escama de pez por tejado. */
export const ELF_FLANK_ROOF_ROWS = 3;
/** Torres sobre tejados: anchura como fracción de la cumbrera del trapecio. */
export const ELF_ROOF_TOWER_WIDTH = { min: 0.24, max: 0.42 };
/** Par de torres en el mismo tejado: anchura individual más estrecha. */
export const ELF_ROOF_TOWER_PAIR_WIDTH = { min: 0.2, max: 0.34 };
/** Tres torres en el mismo tejado: anchura aún más estrecha. */
export const ELF_ROOF_TOWER_TRIPLE_WIDTH = { min: 0.14, max: 0.22 };
/** Torres sobre tejados: altura como múltiplo de la altura del tejado. */
export const ELF_ROOF_TOWER_HEIGHT = { min: 2.8, max: 5.2 };
/** Arcos entrecruzados en la coronación de cada torre. */
export const ELF_ROOF_TOWER_CROWN_ARCHES = 3;
/** Escala del castillo élfico (ancho y arcos); la altura del zócalo se conserva aparte. */
export const ELF_CASTLE_DISPLAY_SCALE = 0.5;
/** Anchura objetivo en viewBox (0–100), alineada con castillos enanos (~70–75 u.). */
export const ELF_TARGET_FOOTPRINT = 72;

/** Sub-stream RNG para torres: semilla mezclada + geometría del tejado. */
export function createElfRoofTowerRng(seed, geometry = {}, variant = 0) {
  const {
    axis = 0,
    doorW = 0,
    envLeft = 0,
    envRight = 0,
    roofHRatio = 0,
  } = geometry;
  const key = [
    "elf-towers",
    mixFantasySeed(seed, variant),
    axis.toFixed(2),
    doorW.toFixed(2),
    envLeft.toFixed(2),
    envRight.toFixed(2),
    roofHRatio.toFixed(3),
  ].join(":");
  return createRng(hashSeed(key));
}

/**
 * @param {{ seed: number; variant?: number; palace?: boolean; imperfection?: number; style?: string; ruined?: boolean }} options
 * @param {() => number} rng
 * @returns {import('./loader-fantasy-compose.js').ConstructionGraph}
 */
export function planElfCastleGraph(options, rng) {
  const profile = getFactionProfile("elf");
  const axis = 50 + (rng() - 0.5) * 3;

  const spanW = randRange(rng, 28, 36);
  const plinW = spanW * randRange(rng, 1.08, 1.22);
  const envLeft = axis - plinW / 2;
  const envRight = axis + plinW / 2;
  const doorW = spanW * randRange(rng, 0.36, 0.46) * ELF_DOOR_SIZE_FACTOR;
  const doorH = randRange(rng, 24, 32) * ELF_DOOR_SIZE_FACTOR;
  const flankArchH = doorH * randRange(rng, ELF_FLANK_ARCH_HEIGHT.min, ELF_FLANK_ARCH_HEIGHT.max);

  const graph = createGraph({
    composeMode: "graph",
    faction: "elf",
    factionLabel: profile.label,
    towerRemate: null,
    archDominant: "gothic",
    normalizeScaleBy: "height",
    normalizeBottomInset: 0,
    elfRebuildPhase: 5,
  });

  addNode(graph, {
    id: "door",
    module: "elf.door_outline",
    cx: axis,
    baseY: 0,
    params: { w: doorW, h: doorH },
    order: 10,
  });

  addNode(graph, {
    id: "flank_arcades",
    module: "elf.flank_arcades",
    cx: axis,
    baseY: 0,
    params: {
      doorW,
      doorH,
      archH: flankArchH,
      archCount: ELF_FLANK_INTERLACE_COUNT,
      envLeft,
      envRight,
    },
    order: 15,
    after: ["door"],
  });

  const roofHRatio = randRange(rng, ELF_FLANK_ROOF_HEIGHT.min, ELF_FLANK_ROOF_HEIGHT.max);

  addNode(graph, {
    id: "flank_roofs",
    module: "elf.flank_roofs",
    cx: axis,
    baseY: 0,
    params: {
      doorW,
      archH: flankArchH,
      envLeft,
      envRight,
      roofHRatio,
      topInsetRatio: ELF_FLANK_ROOF_TOP_TAPER,
      rows: ELF_FLANK_ROOF_ROWS,
    },
    order: 20,
    after: ["flank_arcades"],
  });

  const towerRng = createElfRoofTowerRng(options.seed, {
    axis,
    doorW,
    envLeft,
    envRight,
    roofHRatio,
  }, options.variant ?? 0);
  const roofTowers = planElfRoofTowerPlacements(
    axis, 0, doorW, flankArchH, envLeft, envRight, roofHRatio, ELF_FLANK_ROOF_TOP_TAPER, towerRng,
    { widthFrac: ELF_ROOF_TOWER_WIDTH, heightFrac: ELF_ROOF_TOWER_HEIGHT, pairWidthFrac: ELF_ROOF_TOWER_PAIR_WIDTH, tripleWidthFrac: ELF_ROOF_TOWER_TRIPLE_WIDTH },
  );

  addNode(graph, {
    id: "roof_towers",
    module: "elf.roof_towers",
    cx: axis,
    baseY: 0,
    params: {
      towers: roofTowers,
      crownArchCount: ELF_ROOF_TOWER_CROWN_ARCHES,
    },
    order: 25,
    after: ["flank_roofs"],
  });

  Object.assign(graph.meta, {
    towerCount: roofTowers.length,
    blockCount: 0,
    towers: roofTowers.map((t, i) => ({
      id: `roof_tower_${i}`,
      cx: t.cx,
      w: t.w,
      h: t.h,
      remate: "gothic_arch",
    })),
    towerXs: roofTowers.map((t) => t.cx),
    towerWs: roofTowers.map((t) => t.w),
    towerSupportTopW: roofTowers.map((t) => t.w),
    doorCount: 1,
    windowCount: 0,
    slitCount: 0,
    localTowerMean: roofTowers.length
      ? roofTowers.reduce((s, t) => s + t.h, 0) / roofTowers.length
      : doorH,
    localTowerHeights: roofTowers.map((t) => t.h),
    asymmetry: Math.min(1, Math.abs(axis - 50) / 8 + (options.ruined ? 0.1 : 0)),
    deckW: spanW,
    plinW,
    envelopeW: plinW,
    envelopeLeft: envLeft,
    envelopeRight: envRight,
    deckH: 0,
    axis,
    doorW,
    doorH,
    flankArchH,
    roofHRatio,
    roofTowers,
    normalizeBottomInset: 0,
  });

  return graph;
}

/**
 * @param {{
 *   seed: number;
 *   variant?: number;
 *   palace?: boolean;
 *   style?: string;
 *   imperfection?: number;
 *   terrainHeightPx?: number;
 *   castleSizePx?: number;
 * }} options
 * @param {() => number} rng
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generateElfCastleFromGraph(options, rng) {
  ensureModulesRegistered();

  const seed = options.seed >>> 0;
  const palace = !!options.palace;
  const profile = getFactionProfile("elf");
  const imperfection = options.imperfection ?? 0.55;
  const ruined = options.style === "ruinedKeep";
  const jitterAmt = (0.18 + imperfection * 0.55) * profile.jitterScale;

  const graph = planElfCastleGraph({ ...options, ruined }, rng);
  const asm = new ElementAssembler();

  /** @type {{ gothic: number; romanesque: number; flat: number; trefoil: number }} */
  const arches = { gothic: 0, romanesque: 0, flat: 0, trefoil: 0 };
  const counters = { doorCount: 0, windowCount: 0, slitCount: 0 };

  executeGraph(graph, {
    rng,
    profile,
    imperfection,
    jitterAmt,
    ruined,
    palace,
    asm,
    arches,
    counters,
  });

  const axis = graph.meta.axis ?? 50;
  const plinW = graph.meta.plinW ?? graph.meta.deckW * 1.6;
  const envLeft = graph.meta.envelopeLeft ?? axis - plinW / 2;
  const envRight = graph.meta.envelopeRight ?? axis + plinW / 2;

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
    ) * ELF_PLINTH_HEIGHT_FACTOR;

  scaleFantasyPartsLocal(asm._parts, axis, ELF_CASTLE_DISPLAY_SCALE);
  const scaledHeightAbove = heightAbove * ELF_CASTLE_DISPLAY_SCALE;
  const scaledPlinW = plinW * ELF_CASTLE_DISPLAY_SCALE;

  asm._parts.unshift({
    role: "plinth",
    outer: rect(axis, -plinH, scaledPlinW, plinH + SEAM),
    holes: [],
    buildSequence: 0,
  });

  const localBounds = localBoundsFromParts(asm._parts);
  const contentH = plinH + scaledHeightAbove + SEAM;
  const normalizeHeightFloor = Math.max(
    contentH,
    (scaledPlinW * 100) / ELF_TARGET_FOOTPRINT,
  );

  const meta = {
    ...graph.meta,
    variant: options.variant ?? 0,
    style: options.style ?? "white",
    palace,
    arches,
    archDominant: arches.gothic >= arches.romanesque ? "gothic" : "romanesque",
    doorCount: counters.doorCount,
    windowCount: counters.windowCount,
    slitCount: counters.slitCount,
    plinthLocalH: plinH,
    plinthTerrainPx: options.terrainHeightPx ?? DEFAULT_TERRAIN_HEIGHT_PX,
    heightAboveGround: scaledHeightAbove,
    plinW: scaledPlinW,
    localMinX: localBounds.minX,
    localMaxX: localBounds.maxX,
    normalizeScaleBy: "height",
    normalizeBottomInset: 0,
    normalizeHeightFloor,
  };

  return asm.build(palace ? "palace" : "castle", seed, meta.style, meta);
}
