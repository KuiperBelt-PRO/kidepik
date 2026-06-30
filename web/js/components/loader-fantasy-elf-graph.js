/**
 * Planificador de grafos de construcción para castillos élficos.
 *
 * Silueta tipo referencias: podio elevado con arcadas, tres torres
 * (cúpula de costillas central + agujas laterales), arcadas de unión.
 *
 * @module loader-fantasy-elf-graph
 */

import {
  addNode,
  createGraph,
  executeGraph,
} from "./loader-fantasy-compose.js";
import { ElementAssembler } from "./loader-fantasy-element.js";
import {
  getFactionProfile,
  pickElfTowerCap,
} from "./loader-fantasy-castle-factions.js";
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

/**
 * Torres en flancos del podio (nunca sobre el vano central de la puerta).
 * @param {number} cx
 * @param {number} spanW
 * @param {number} doorW
 * @returns {number[]}
 */
function planFlankTowerXs(cx, spanW, doorW) {
  const half = spanW * 0.44;
  const dead = doorW / 2 + 2;
  const inset = spanW * 0.06;
  return [cx - Math.max(inset, half - dead), cx + Math.max(inset, half - dead)];
}

/**
 * @param {{ seed: number; palace?: boolean; imperfection?: number; style?: string; ruined?: boolean }} options
 * @param {() => number} rng
 * @returns {import('./loader-fantasy-compose.js').ConstructionGraph}
 */
export function planElfCastleGraph(options, rng) {
  const profile = getFactionProfile("elf");
  const axis = 50 + (rng() - 0.5) * 4;

  const spanW = randRange(rng, 70, 80);
  const plinW = spanW * randRange(rng, 1.5, 2.0);
  const envLeft = axis - plinW / 2;
  const envRight = axis + plinW / 2;
  const doorW = spanW * randRange(rng, 0.14, 0.2);
  const stiltH = randRange(rng, 14, 18);
  const slabH = randRange(rng, 5, 7);
  const podiumTop = stiltH + slabH;

  const towerCount = 2;
  const capKind = pickElfTowerCap(rng);
  const flankH = randRange(rng, 48, 58);
  const centralCrownH = flankH * randRange(rng, 1.35, 1.55);
  const towerW = spanW * randRange(rng, 0.1, 0.13);

  const graph = createGraph({
    composeMode: "graph",
    faction: "elf",
    factionLabel: profile.label,
    towerRemate: capKind,
    archDominant: "gothic",
    normalizeScaleBy: "height",
    normalizeBottomInset: 0,
  });

  addNode(graph, {
    id: "podium",
    module: "elf.podium",
    cx: axis,
    baseY: 0,
    params: {
      w: spanW,
      stiltH,
      slabH,
      archCount: 4 + Math.floor(rng() * 2),
    },
    order: 0,
  });

  const towerXs = planFlankTowerXs(axis, spanW, doorW);
  /** @type {{ remate: string }[]} */
  const towersMeta = [];
  /** @type {number[]} */
  const towerHeights = [];
  /** @type {number[]} */
  const shaftHeights = [];

  /** @type {number[]} */
  const towerWidths = [];

  towerXs.forEach((tcx, idx) => {
    let towerH = flankH * randRange(rng, 0.92, 1.02);
    if (options.ruined && idx === towerCount - 1) towerH *= 0.5;
    shaftHeights.push(towerH);
    towerHeights.push(podiumTop + towerH);
    towersMeta.push({ remate: capKind, baseY: podiumTop });
    towerWidths.push(towerW);

    addNode(graph, {
      id: `tower_${idx}`,
      module: "elf.tower_flank",
      cx: tcx,
      baseY: podiumTop,
      params: { w: towerW, h: towerH, capKind },
      order: 20 + idx,
      after: ["podium"],
    });
  });

  addNode(graph, {
    id: "slab_crown",
    module: "elf.slab_crown",
    cx: axis,
    baseY: podiumTop,
    params: { w: towerW * 2.8, h: centralCrownH * 0.38, capKind },
    order: 24,
    after: ["podium"],
  });

  for (let i = 0; i < towerXs.length - 1; i++) {
    const maxShaft = Math.max(shaftHeights[i], shaftHeights[i + 1]);
    addNode(graph, {
      id: `span_${i}`,
      module: "elf.span_arch",
      cx: (towerXs[i] + towerXs[i + 1]) / 2,
      baseY: podiumTop + maxShaft * randRange(rng, 0.38, 0.46),
      params: {
        x1: towerXs[i],
        x2: towerXs[i + 1],
        h: maxShaft * randRange(rng, 0.22, 0.3),
      },
      order: 30 + i,
      after: [`tower_${i}`, `tower_${i + 1}`],
    });
  }

  if (rng() < 0.45) {
    addNode(graph, {
      id: "entry_bridge",
      module: "elf.bridge",
      cx: axis,
      baseY: 0,
      params: {
        w: spanW * randRange(rng, 0.38, 0.52),
        h: stiltH * randRange(rng, 0.88, 1.02),
        count: 2 + Math.floor(rng() * 2),
      },
      order: 8,
      after: ["podium"],
    });
  }

  const meanH = towerHeights.reduce((s, h) => s + h, 0) / (towerHeights.length || 1);
  const std = Math.sqrt(
    towerHeights.reduce((s, h) => s + (h - meanH) ** 2, 0) / (towerHeights.length || 1),
  );

  Object.assign(graph.meta, {
    towerCount,
    blockCount: 0,
    towers: towersMeta,
    towerXs,
    towerWs: towerWidths,
    towerSupportTopW: towerWidths.map(() => spanW),
    doorCount: 0,
    windowCount: 0,
    slitCount: 0,
    localTowerMean: meanH,
    localTowerHeights: towerHeights,
    asymmetry: Math.min(1, std / (podiumTop * 0.9) + (options.ruined ? 0.15 : 0)),
    deckW: spanW,
    plinW,
    envelopeW: plinW,
    envelopeLeft: envLeft,
    envelopeRight: envRight,
    deckH: podiumTop,
    axis,
    doorW,
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
  const plinH = computePlinthLocalHeight(
    heightAbove,
    options.terrainHeightPx,
    options.castleSizePx,
  );
  asm._parts.unshift({
    role: "plinth",
    outer: rect(axis, -plinH, plinW, plinH + SEAM),
    holes: [],
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
