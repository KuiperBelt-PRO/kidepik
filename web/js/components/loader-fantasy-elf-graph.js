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
import { randRange } from "./loader-ship-rng.js";

/**
 * @param {number} cx
 * @param {number} spanW
 * @param {number} count
 * @returns {number[]}
 */
function planTowerXs(cx, spanW, count) {
  const span = spanW * 0.88;
  if (count <= 1) return [cx];
  const step = span / (count - 1);
  /** @type {number[]} */
  const xs = [];
  for (let i = 0; i < count; i++) {
    xs.push(cx - span / 2 + i * step);
  }
  return xs;
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
  const stiltH = randRange(rng, 14, 18);
  const slabH = randRange(rng, 5, 7);
  const podiumTop = stiltH + slabH;

  const towerCount = 3;
  const capKind = pickElfTowerCap(rng);
  const centralIdx = 1;
  const flankH = randRange(rng, 48, 58);
  const centralH = flankH * randRange(rng, 1.35, 1.55);
  const towerW = spanW * randRange(rng, 0.1, 0.13);

  const graph = createGraph({
    composeMode: "graph",
    faction: "elf",
    factionLabel: profile.label,
    towerRemate: capKind,
    archDominant: "gothic",
    normalizeScaleBy: "max",
    normalizeBottomInset: 10,
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

  const towerXs = planTowerXs(axis, spanW, towerCount);
  /** @type {{ remate: string }[]} */
  const towersMeta = [];
  /** @type {number[]} */
  const towerHeights = [];
  /** @type {number[]} */
  const shaftHeights = [];

  towerXs.forEach((tcx, idx) => {
    const isCentral = idx === centralIdx;
    let towerH = isCentral ? centralH : flankH * randRange(rng, 0.92, 1.02);
    if (options.ruined && idx === towerCount - 1) towerH *= 0.5;
    shaftHeights.push(towerH);
    towerHeights.push(podiumTop + towerH);
    towersMeta.push({ remate: capKind });

    addNode(graph, {
      id: `tower_${idx}`,
      module: isCentral ? "elf.tower_central" : "elf.tower_flank",
      cx: tcx,
      baseY: podiumTop,
      params: { w: towerW, h: towerH, capKind },
      order: 20 + idx,
      after: ["podium"],
    });
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
    doorCount: 0,
    windowCount: 0,
    slitCount: 0,
    localTowerMean: meanH,
    localTowerHeights: towerHeights,
    asymmetry: Math.min(1, std / (podiumTop * 0.9) + (options.ruined ? 0.15 : 0)),
    deckW: spanW,
    deckH: podiumTop,
    axis,
    normalizeBottomInset: 10,
  });

  return graph;
}

/**
 * @param {{
 *   seed: number;
 *   palace?: boolean;
 *   style?: string;
 *   imperfection?: number;
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

  const meta = {
    ...graph.meta,
    style: options.style ?? "white",
    palace,
    arches,
    archDominant: arches.gothic >= arches.romanesque ? "gothic" : "romanesque",
    doorCount: counters.doorCount,
    windowCount: counters.windowCount,
    slitCount: counters.slitCount,
    normalizeScaleBy: "max",
    normalizeBottomInset: 10,
  };

  return asm.build(palace ? "palace" : "castle", seed, meta.style, meta);
}
