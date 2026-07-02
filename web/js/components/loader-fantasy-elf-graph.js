/**
 * Planificador de grafos de construcción para castillos élficos.
 *
 * Reconstrucción incremental (fase 2): zócalo + arco gótico central en trazo.
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
  rect,
} from "./loader-fantasy-geom.js";
import { randRange } from "./loader-ship-rng.js";

const SEAM = 1.4;
/** Arco central élfico: escala respecto a los rangos base (−30 %). */
export const ELF_DOOR_SIZE_FACTOR = 0.7;
/** Zócalo élfico: altura respecto al cálculo estándar (−25 %). */
export const ELF_PLINTH_HEIGHT_FACTOR = 0.75;

/**
 * @param {{ seed: number; palace?: boolean; imperfection?: number; style?: string; ruined?: boolean }} options
 * @param {() => number} rng
 * @returns {import('./loader-fantasy-compose.js').ConstructionGraph}
 */
export function planElfCastleGraph(options, rng) {
  const profile = getFactionProfile("elf");
  const axis = 50 + (rng() - 0.5) * 3;

  const spanW = randRange(rng, 36, 44);
  const plinW = spanW * randRange(rng, 1.08, 1.22);
  const envLeft = axis - plinW / 2;
  const envRight = axis + plinW / 2;
  const doorW = spanW * randRange(rng, 0.36, 0.46) * ELF_DOOR_SIZE_FACTOR;
  const doorH = randRange(rng, 24, 32) * ELF_DOOR_SIZE_FACTOR;

  const graph = createGraph({
    composeMode: "graph",
    faction: "elf",
    factionLabel: profile.label,
    towerRemate: null,
    archDominant: "gothic",
    normalizeScaleBy: "height",
    normalizeBottomInset: 0,
    elfRebuildPhase: 2,
  });

  addNode(graph, {
    id: "door",
    module: "elf.door_outline",
    cx: axis,
    baseY: 0,
    params: { w: doorW, h: doorH },
    order: 10,
  });

  Object.assign(graph.meta, {
    towerCount: 0,
    blockCount: 0,
    towers: [],
    towerXs: [],
    towerWs: [],
    towerSupportTopW: [],
    doorCount: 1,
    windowCount: 0,
    slitCount: 0,
    localTowerMean: doorH,
    localTowerHeights: [],
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
    normalizeBottomInset: 0,
  });

  return graph;
}

/**
 * @param {{
 *   seed: number;
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
  asm._parts.unshift({
    role: "plinth",
    outer: rect(axis, -plinH, plinW, plinH + SEAM),
    holes: [],
    buildSequence: 0,
  });

  const localBounds = localBoundsFromParts(asm._parts);

  const meta = {
    ...graph.meta,
    style: options.style ?? "white",
    palace,
    arches,
    archDominant: arches.gothic >= arches.romanesque ? "gothic" : "romanesque",
    doorCount: counters.doorCount,
    windowCount: counters.windowCount,
    slitCount: counters.slitCount,
    plinthLocalH: plinH,
    plinthTerrainPx: options.terrainHeightPx ?? DEFAULT_TERRAIN_HEIGHT_PX,
    heightAboveGround: heightAbove,
    localMinX: localBounds.minX,
    localMaxX: localBounds.maxX,
    normalizeScaleBy: "height",
    normalizeBottomInset: 0,
  };

  return asm.build(palace ? "palace" : "castle", seed, meta.style, meta);
}
