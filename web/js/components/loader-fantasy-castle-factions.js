/**
 * Perfiles de facción para castillos y palacios de fantasía.
 *
 * Arquetipos genéricos (humanos, elfos, enanos) que sesgan
 * proporciones, formas, arcos y decoración sin usar IP de terceros.
 *
 * @module loader-fantasy-castle-factions
 */

import { randPick } from "./loader-ship-rng.js";

/** @typedef {'human'|'elf'|'dwarf'} CastleFaction */

/** Zócalo humano: 40 % más bajo que el cálculo base terreno/pantalla. */
export const HUMAN_PLINTH_HEIGHT_FACTOR = 0.6;

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
 *   useChamferApertures: boolean;
 *   useCroppedDome: boolean;
 *   dolmenChance: number;
 *   useTrapezoidBodies: boolean;
 *   useStackedLevels: boolean;
 *   stackedLevelRange?: [number, number];
 *   towerHByWidth: [number, number] | null;
 *   plinthHeightFactor?: number;
 * }} FactionProfile */

/** @type {CastleFaction[]} */
const PALACE_FACTION_POOL = ["human", "human", "human", "elf", "human"];

/** @type {CastleFaction[]} */
const CASTLE_FACTION_POOL = ["human", "elf", "dwarf"];

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
    remateWeights: { battlement: 0.65, roof: 0, dome: 0.35 },
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
    buttressChance: 0,
    flyingButtressChance: 0,
    centralCrownChance: 0.92,
    blockRoof: false,
    arcadeRows: 0,
    useChamferApertures: false,
    useCroppedDome: true,
    dolmenChance: 0,
    useTrapezoidBodies: false,
    useStackedLevels: true,
    stackedLevelRange: [1, 3],
    towerHByWidth: null,
    plinthHeightFactor: HUMAN_PLINTH_HEIGHT_FACTOR,
  },
  elf: {
    id: "elf",
    label: "Elf",
    baseW: [30, 44],
    baseH: [34, 50],
    towerW: [4.5, 7.5],
    hMul: [4.5, 6.5],
    jitterScale: 0.95,
    archBias: { gothic: 0.95, romanesque: 0.05 },
    winKinds: ["gothic", "trefoil", "gothic"],
    remateWeights: { battlement: 0, roof: 0, dome: 0 },
    blockMax: 2,
    bodyShape: "rect",
    chamfer: 1.5,
    crossingArchChance: 1,
    spikeChance: 0,
    spikeDensity: [0, 0],
    finialKinds: ["needle"],
    finialChance: 0.85,
    tiltScale: 0.45,
    remateMode: "elf_cap",
    buttressChance: 0,
    flyingButtressChance: 0.92,
    centralCrownChance: 0,
    blockRoof: false,
    arcadeRows: 4,
    useChamferApertures: false,
    useCroppedDome: false,
    dolmenChance: 0,
    useTrapezoidBodies: false,
    useStackedLevels: false,
    towerHByWidth: null,
  },
  dwarf: {
    id: "dwarf",
    label: "Dwarf",
    baseW: [58, 72],
    baseH: [42, 62],
    towerW: [11, 16],
    hMul: [1.05, 1.55],
    jitterScale: 0.28,
    archBias: { gothic: 0, romanesque: 0 },
    winKinds: ["flat"],
    remateWeights: { battlement: 0, roof: 0, dome: 0 },
    blockMax: 2,
    bodyShape: "chamfer",
    chamfer: 5,
    crossingArchChance: 0,
    spikeChance: 0,
    spikeDensity: [0, 0],
    finialKinds: ["ball"],
    finialChance: 0,
    tiltScale: 0.35,
    remateMode: "none",
    buttressChance: 0,
    flyingButtressChance: 0,
    centralCrownChance: 0,
    blockRoof: false,
    arcadeRows: 0,
    useChamferApertures: true,
    useCroppedDome: false,
    dolmenChance: 1,
    useTrapezoidBodies: true,
    useStackedLevels: false,
    towerHByWidth: [1.05, 1.75],
  },
};

export const CASTLE_FACTIONS = /** @type {const} */ (["human", "elf", "dwarf"]);

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
    return "dome_battlement";
  }
  const r = rng();
  if (r < 0.58) return "battlement";
  return "dome_battlement";
}

/**
 * Corona central del cuerpo humano.
 * @param {() => number} rng
 * @returns {'battlement'|'dome'|'dome_battlement'}
 */
export function pickHumanCentralCrown(rng) {
  const r = rng();
  if (r < 0.42) return "battlement";
  return "dome_battlement";
}

/**
 * Remate único para todo el castillo humano (torres + cuerpo central + alas).
 * @param {() => number} rng
 * @param {boolean} palace
 * @returns {'battlement'|'dome'|'dome_battlement'}
 */
export function pickHumanCastleCrown(rng, palace) {
  if (palace && rng() < 0.72) {
    return rng() < 0.38 ? "battlement" : "dome_battlement";
  }
  return pickHumanCentralCrown(rng);
}

/**
 * @typedef {'gothic_arch'|'inverted_arrow'|'rib_crown'|'spire_cluster'} ElfCapKind
 */

/**
 * @param {() => number} rng
 * @returns {ElfCapKind}
 */
export function pickElfTowerCap(rng) {
  const r = rng();
  if (r < 0.28) return "rib_crown";
  if (r < 0.5) return "spire_cluster";
  if (r < 0.74) return "gothic_arch";
  return "inverted_arrow";
}
