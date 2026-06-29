/**
 * Perfiles de facción para castillos y palacios de fantasía.
 *
 * Arquetipos genéricos (humanos, elfos, enanos, fuerzas malignas) que sesgan
 * proporciones, formas, arcos y decoración sin usar IP de terceros.
 *
 * @module loader-fantasy-castle-factions
 */

import { randPick } from "./loader-ship-rng.js";

/** @typedef {'human'|'elf'|'dwarf'|'evil'} CastleFaction */

/** @typedef {{
 *   id: CastleFaction;
 *   label: string;
 *   baseW: [number, number];
 *   baseH: [number, number];
 *   towerW: [number, number];
 *   hMul: [number, number];
 *   jitterScale: number;
 *   archBias: { gothic: number; romanesque: number };
 *   winKinds: string[];
 *   remateWeights: { battlement: number; roof: number; dome: number };
 *   blockMax: number;
 *   bodyShape: 'rect' | 'chamfer';
 *   chamfer: number;
 *   crossingArchChance: number;
 *   spikeChance: number;
 *   spikeDensity: [number, number];
 *   finialKinds: ('ball'|'needle')[];
 *   finialChance: number;
 *   tiltScale: number;
 *   remateMode: 'uniform' | 'human_mixed' | 'elf_cap' | 'none';
 *   buttressChance: number;
 *   flyingButtressChance: number;
 *   centralCrownChance: number;
 *   blockRoof: boolean;
 *   arcadeRows: number;
 * }} FactionProfile */

/** @type {CastleFaction[]} */
const PALACE_FACTION_POOL = ["human", "human", "human", "elf", "human"];

/** @type {CastleFaction[]} */
const CASTLE_FACTION_POOL = ["human", "human", "human", "elf", "elf", "dwarf", "dwarf", "evil", "evil", "evil"];

/** @type {Record<CastleFaction, FactionProfile>} */
export const FACTION_PROFILES = {
  human: {
    id: "human",
    label: "Human",
    baseW: [52, 68],
    baseH: [30, 46],
    towerW: [11, 16],
    hMul: [1.35, 2.1],
    jitterScale: 0.72,
    archBias: { gothic: 0.48, romanesque: 0.52 },
    winKinds: ["romanesque", "gothic", "romanesque"],
    remateWeights: { battlement: 0.55, roof: 0.1, dome: 0.35 },
    blockMax: 3,
    bodyShape: "rect",
    chamfer: 2,
    crossingArchChance: 0,
    spikeChance: 0,
    spikeDensity: [0, 0],
    finialKinds: ["ball", "needle"],
    finialChance: 0.35,
    tiltScale: 1,
    remateMode: "human_mixed",
    buttressChance: 0.88,
    flyingButtressChance: 0,
    centralCrownChance: 0.92,
    blockRoof: true,
    arcadeRows: 0,
  },
  elf: {
    id: "elf",
    label: "Elf",
    baseW: [38, 52],
    baseH: [36, 54],
    towerW: [6, 10],
    hMul: [2.15, 2.9],
    jitterScale: 1.12,
    archBias: { gothic: 0.88, romanesque: 0.12 },
    winKinds: ["gothic", "trefoil", "gothic"],
    remateWeights: { battlement: 0, roof: 0, dome: 0 },
    blockMax: 2,
    bodyShape: "rect",
    chamfer: 1.5,
    crossingArchChance: 1,
    spikeChance: 0,
    spikeDensity: [0, 0],
    finialKinds: ["needle"],
    finialChance: 0.2,
    tiltScale: 0.65,
    remateMode: "elf_cap",
    buttressChance: 0,
    flyingButtressChance: 0.78,
    centralCrownChance: 0,
    blockRoof: false,
    arcadeRows: 3,
  },
  dwarf: {
    id: "dwarf",
    label: "Dwarf",
    baseW: [58, 72],
    baseH: [32, 48],
    towerW: [12, 17],
    hMul: [1.58, 2.12],
    jitterScale: 0.28,
    archBias: { gothic: 0.12, romanesque: 0.88 },
    winKinds: ["flat", "romanesque", "flat"],
    remateWeights: { battlement: 0, roof: 0, dome: 0 },
    blockMax: 2,
    bodyShape: "chamfer",
    chamfer: 6,
    crossingArchChance: 0,
    spikeChance: 0,
    spikeDensity: [0, 0],
    finialKinds: ["ball"],
    finialChance: 0,
    tiltScale: 0.35,
    remateMode: "none",
    buttressChance: 0.45,
    flyingButtressChance: 0,
    centralCrownChance: 0,
    blockRoof: false,
    arcadeRows: 0,
  },
  evil: {
    id: "evil",
    label: "Evil",
    baseW: [48, 62],
    baseH: [28, 42],
    towerW: [9, 14],
    hMul: [1.25, 2.0],
    jitterScale: 0.95,
    archBias: { gothic: 0.68, romanesque: 0.32 },
    winKinds: ["flat", "gothic", "flat"],
    remateWeights: { battlement: 0.22, roof: 0.58, dome: 0.2 },
    blockMax: 2,
    bodyShape: "chamfer",
    chamfer: 3.2,
    crossingArchChance: 0,
    spikeChance: 0.78,
    spikeDensity: [3, 6],
    finialKinds: ["needle"],
    finialChance: 0.85,
    tiltScale: 1.35,
    remateMode: "uniform",
    buttressChance: 0,
    flyingButtressChance: 0,
    centralCrownChance: 0,
    blockRoof: true,
    arcadeRows: 0,
  },
};

export const CASTLE_FACTIONS = /** @type {const} */ (["human", "elf", "dwarf", "evil"]);

/**
 * @param {CastleFaction | string} faction
 * @returns {FactionProfile}
 */
export function getFactionProfile(faction) {
  return FACTION_PROFILES[/** @type {CastleFaction} */ (faction)] ?? FACTION_PROFILES.human;
}

/**
 * @param {() => number} rng
 * @param {boolean} palace
 * @returns {CastleFaction}
 */
export function pickFaction(rng, palace) {
  return randPick(rng, palace ? PALACE_FACTION_POOL : CASTLE_FACTION_POOL);
}

/**
 * Valida un valor de query string `?fantasyFaction=`.
 * @param {string | null | undefined} raw
 * @returns {CastleFaction | undefined}
 */
export function parseDevFaction(raw) {
  if (!raw) return undefined;
  const id = String(raw).toLowerCase().trim();
  return CASTLE_FACTIONS.includes(/** @type {CastleFaction} */ (id))
    ? /** @type {CastleFaction} */ (id)
    : undefined;
}

/**
 * @param {() => number} rng
 * @param {FactionProfile} profile
 * @returns {'gothic'|'romanesque'}
 */
export function pickArchForFaction(rng, profile) {
  return rng() < profile.archBias.gothic ? "gothic" : "romanesque";
}

/**
 * @param {() => number} rng
 * @param {FactionProfile} profile
 * @returns {'roof'|'battlement'|'dome'}
 */
export function pickRemateForFaction(rng, profile) {
  if (profile.remateMode === "none" || profile.remateMode === "elf_cap") return "battlement";
  const { battlement, roof, dome } = profile.remateWeights;
  const r = rng();
  if (r < battlement) return "battlement";
  if (r < battlement + roof) return "roof";
  return "dome";
}

/**
 * Remate de torre humana (mezcla almenas, cúpula y cúpula+almenas).
 * @param {() => number} rng
 * @param {number} towerIndex
 * @param {number} towerCount
 * @returns {'battlement'|'dome'|'dome_battlement'}
 */
export function pickHumanTowerCap(rng, towerIndex, towerCount) {
  if (towerIndex === Math.floor(towerCount / 2) && rng() < 0.55) {
    return rng() < 0.5 ? "dome_battlement" : "dome";
  }
  const r = rng();
  if (r < 0.62) return "battlement";
  if (r < 0.82) return "dome_battlement";
  return "dome";
}

/**
 * Corona central del cuerpo humano.
 * @param {() => number} rng
 * @returns {'battlement'|'dome'|'dome_battlement'}
 */
export function pickHumanCentralCrown(rng) {
  const r = rng();
  if (r < 0.4) return "battlement";
  if (r < 0.7) return "dome_battlement";
  return "dome";
}

/**
 * @param {() => number} rng
 * @returns {'gothic_arch'|'inverted_arrow'}
 */
export function pickElfTowerCap(rng) {
  return rng() < 0.55 ? "gothic_arch" : "inverted_arrow";
}
