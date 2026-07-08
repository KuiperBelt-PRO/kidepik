/**
 * Director de la escena de elementos de fantasía.
 *
 * Phase 0: monta únicamente elementos 'block' en secuencia continua.
 * El director respeta el tope de altura (§7.1): los elementos no superan
 * el borde inferior del anillo central del logo.
 *
 * @module loader-fantasy-scene
 */

import { generateFantasyElement, planLifecycleTiming } from "./loader-fantasy-element.js";
import { planCliffFormation, planCliffSides } from "./loader-fantasy-cliffs.js";
import { mountFantasyElement } from "./loader-fantasy-render.js";
import { pickFaction } from "./loader-fantasy-castle-factions.js";
import { createRng, mixFantasySeed, randRange } from "./loader-ship-rng.js";

// Zona horizontal prohibida (% del ancho) para evitar el logo central.
const PLACE_LEFT_MIN = 8;
const PLACE_LEFT_MAX = 92;

/** Separación mínima alrededor del 50 % (logo). */
export const CENTER_LOGO_GAP = 16;
/** Límite superior de la franja izquierda (%). */
export const CENTER_LEFT_ZONE_MAX = 50 - CENTER_LOGO_GAP / 2;
/** Límite inferior de la franja derecha (%). */
export const CENTER_RIGHT_ZONE_MIN = 50 + CENTER_LOGO_GAP / 2;

/** Probabilidad de intento de spawn de cristales por ciclo (modo normal). */
export const CRYSTAL_SPAWN_CHANCE = 0.38;

/** Tamaño máximo usado solo para calcular huecos (no escala el SVG final). */
const CRYSTAL_GAP_PROBE_MAX_PX = 70;
/** Margen extra alrededor de bosque/castillo al colocar cristales. */
const CRYSTAL_GAP_ZONE_MARGIN_FRAC = 0.62;
/** Padding adicional (% ancho) sobre la silueta de bosque/castillo. */
const CRYSTAL_OCCUPIED_EXTRA_PADDING_PCT = 3.5;
/** Inflado de la caja de castillo al calcular ocupación (más ancho visual). */
const CRYSTAL_BUILDING_OCCUPIED_INFLATE = 1.14;
/** Inflado de la caja de bosque al calcular ocupación. */
const CRYSTAL_FOREST_OCCUPIED_INFLATE = 1.08;

const CENTER_ZONE_MIN_WIDTH_PX = 36;
/** Margen entre zonas ocupadas al buscar huecos (% del ancho). */
const GAP_ZONE_MARGIN_FRAC = 0.35;

/**
 * Rango seguro (centro del elemento) evitando riscos laterales y el propio ancho.
 * Con `preferSide`, solo reserva el margen del borde opuesto al que se va a usar.
 * @param {number} layerWidthPx
 * @param {number} selfSizePx
 * @param {number} [cliffLeftPx]
 * @param {number} [cliffRightPx]
 * @param {'left' | 'right' | null} [preferSide]
 * @returns {{ min: number; max: number }}
 */
export function computeSafeCenterRange(
  layerWidthPx,
  selfSizePx,
  cliffLeftPx = 0,
  cliffRightPx = 0,
  preferSide = null,
) {
  if (layerWidthPx <= 0) {
    return { min: PLACE_LEFT_MIN, max: PLACE_LEFT_MAX };
  }
  const halfPct = (selfSizePx / 2 / layerWidthPx) * 100;
  const leftPct = (cliffLeftPx / layerWidthPx) * 100;
  const rightPct = (cliffRightPx / layerWidthPx) * 100;

  if (preferSide === "left") {
    return {
      min: Math.max(PLACE_LEFT_MIN, leftPct + halfPct),
      max: PLACE_LEFT_MAX,
    };
  }
  if (preferSide === "right") {
    return {
      min: PLACE_LEFT_MIN,
      max: Math.min(PLACE_LEFT_MAX, 100 - rightPct - halfPct),
    };
  }

  const min = Math.max(PLACE_LEFT_MIN, leftPct + halfPct);
  const max = Math.min(PLACE_LEFT_MAX, 100 - rightPct - halfPct);
  return { min, max };
}

/**
 * @param {{ min: number; max: number }} a
 * @param {{ min: number; max: number }} b
 * @returns {{ min: number; max: number } | null}
 */
function intersectPlacementRange(a, b) {
  const min = Math.max(a.min, b.min);
  const max = Math.min(a.max, b.max);
  if (min >= max) return null;
  return { min, max };
}

const HEIGHT_FRACTION_MIN = 0.18;
const HEIGHT_FRACTION_MAX = 0.34;

const MIN_ELEMENT_HEIGHT_PX = 60;
const MAX_ELEMENT_HEIGHT_PX = 150;

const CASTLE_HEIGHT_FRAC_MIN = 0.23;
const CASTLE_HEIGHT_FRAC_MAX = 0.4;
const CASTLE_MAX_HEIGHT_PX = 168;

const FOREST_HEIGHT_FRAC_MIN = 0.12;
const FOREST_HEIGHT_FRAC_MAX = 0.22;
const FOREST_MIN_HEIGHT_PX = 40;
const FOREST_MAX_HEIGHT_PX = 96;

// Muros laterales (costura en x 0 % / 100 %).
const CLIFF_HEIGHT_FRAC_MIN = 0.26;
const CLIFF_HEIGHT_FRAC_MAX = 0.42;
const CLIFF_MIN_HEIGHT_PX = 46;
const CLIFF_MAX_HEIGHT_PX = 142;

const CRYSTAL_HEIGHT_FRAC_MIN = 0.18;
const CRYSTAL_HEIGHT_FRAC_MAX = 0.30;
const CRYSTAL_MIN_HEIGHT_PX = 52;
const CRYSTAL_MAX_HEIGHT_PX = 115;

let _sessionSeedCounter = Date.now() & 0x7fffffff;

function sessionSeed() {
  _sessionSeedCounter = (_sessionSeedCounter * 1664525 + 1013904223) & 0x7fffffff;
  return _sessionSeedCounter;
}

/** @typedef {'forest' | 'building'} CenterSceneSlot */

/**
 * Ranura del centro que corresponde a un kind de fantasía.
 * @param {import('./loader-fantasy-element.js').FantasyKind} kind
 * @returns {CenterSceneSlot | null}
 */
export function centerSlotForKind(kind) {
  if (kind === "forest") return "forest";
  if (kind === "castle" || kind === "palace") return "building";
  return null;
}

/**
 * Elige castillo o palacio para la ranura de edificio.
 * @param {() => number} rng
 * @param {string | undefined} devKind
 * @returns {'castle' | 'palace'}
 */
export function planBuildingKind(rng, devKind) {
  if (devKind === "castle" || devKind === "palace") return devKind;
  return rng() < 0.42 ? "palace" : "castle";
}

/**
 * Elige la posición horizontal de bosque o edificio intentando no mezclarlos.
 * Si no hay espacio suficiente en pantalla, cae al rango completo.
 *
 * @param {{
 *   rng: () => number;
 *   slot: CenterSceneSlot;
 *   otherXPercent?: number | null;
 *   layerWidthPx?: number;
 *   selfSizePx?: number;
 *   bothSlotsEnabled?: boolean;
 *   cliffLeftPx?: number;
 *   cliffRightPx?: number;
 *   avoidEdgeCliffs?: boolean;
 * }} options
 * @returns {number}
 */
export function pickCenterPlacementX(options) {
  const {
    rng,
    slot,
    otherXPercent = null,
    layerWidthPx = 390,
    selfSizePx = 96,
    bothSlotsEnabled = true,
    cliffLeftPx = 0,
    cliffRightPx = 0,
    avoidEdgeCliffs = false,
  } = options;

  const cliffLeft = avoidEdgeCliffs ? cliffLeftPx : 0;
  const cliffRight = avoidEdgeCliffs ? cliffRightPx : 0;

  const pickIn = (min, max) => randRange(rng, min, max);

  const pickFromSafe = (preferSide) => {
    const safe = computeSafeCenterRange(
      layerWidthPx, selfSizePx, cliffLeft, cliffRight, preferSide,
    );
    const r = intersectPlacementRange(safe, { min: PLACE_LEFT_MIN, max: PLACE_LEFT_MAX });
    if (!r) return pickIn(PLACE_LEFT_MIN, PLACE_LEFT_MAX);
    return pickIn(r.min, r.max);
  };

  if (!bothSlotsEnabled) {
    return avoidEdgeCliffs ? pickFromSafe(null) : pickIn(PLACE_LEFT_MIN, PLACE_LEFT_MAX);
  }

  const minZonePx = Math.max(selfSizePx * 0.5, CENTER_ZONE_MIN_WIDTH_PX);
  const leftZonePx = layerWidthPx * (CENTER_LEFT_ZONE_MAX - PLACE_LEFT_MIN) / 100;
  const rightZonePx = layerWidthPx * (PLACE_LEFT_MAX - CENTER_RIGHT_ZONE_MIN) / 100;
  if (leftZonePx < minZonePx || rightZonePx < minZonePx) {
    return avoidEdgeCliffs ? pickFromSafe(null) : pickIn(PLACE_LEFT_MIN, PLACE_LEFT_MAX);
  }

  /** @type {'left' | 'right'} */
  let targetSide;
  if (otherXPercent != null) {
    targetSide = otherXPercent < 50 ? "right" : "left";
  } else {
    const forestOnLeft = rng() < 0.5;
    const selfOnLeft = slot === "forest" ? forestOnLeft : !forestOnLeft;
    targetSide = selfOnLeft ? "left" : "right";
  }

  const targetRange = targetSide === "left"
    ? { min: PLACE_LEFT_MIN, max: CENTER_LEFT_ZONE_MAX }
    : { min: CENTER_RIGHT_ZONE_MIN, max: PLACE_LEFT_MAX };

  const safe = computeSafeCenterRange(
    layerWidthPx, selfSizePx, cliffLeft, cliffRight,
    avoidEdgeCliffs ? targetSide : null,
  );

  const finalRange = intersectPlacementRange(targetRange, safe);
  if (!finalRange) {
    return avoidEdgeCliffs ? pickFromSafe(targetSide) : pickIn(PLACE_LEFT_MIN, PLACE_LEFT_MAX);
  }
  return pickIn(finalRange.min, finalRange.max);
}

/**
 * @param {number} selfSizePx
 * @param {number} layerWidthPx
 */
export function elementHalfWidthPercent(selfSizePx, layerWidthPx) {
  if (layerWidthPx <= 0) return 0;
  return (selfSizePx / 2 / layerWidthPx) * 100;
}

/**
 * @typedef {{ center: number; halfWidth: number }} OccupiedZone
 */

/**
 * @param {{ min: number; max: number }[]} intervals
 */
export function mergeBlockedIntervals(intervals) {
  const sorted = intervals
    .filter((iv) => iv.max > iv.min)
    .sort((a, b) => a.min - b.min);
  /** @type {{ min: number; max: number }[]} */
  const merged = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.min <= last.max) {
      last.max = Math.max(last.max, iv.max);
    } else {
      merged.push({ min: iv.min, max: iv.max });
    }
  }
  return merged;
}

/**
 * @param {{ min: number; max: number }[]} blocked merged
 * @param {number} min
 * @param {number} max
 */
export function findFreeIntervals(blocked, min, max) {
  /** @type {{ min: number; max: number }[]} */
  const free = [];
  let cursor = min;
  for (const iv of blocked) {
    if (iv.min > cursor) free.push({ min: cursor, max: iv.min });
    cursor = Math.max(cursor, iv.max);
  }
  if (cursor < max) free.push({ min: cursor, max: max });
  return free.filter((iv) => iv.max > iv.min);
}

/**
 * Hemisferios libres de bosque/castillo para cristales.
 * @param {number | null} forestX
 * @param {number | null} buildingX
 * @returns {readonly ('left' | 'right')[]}
 */
export function preferredCrystalHemispheres(forestX, buildingX) {
  /** @type {('left' | 'right')[]} */
  const hemis = [];
  const forestOnLeft = forestX != null && forestX <= CENTER_LEFT_ZONE_MAX;
  const forestOnRight = forestX != null && forestX >= CENTER_RIGHT_ZONE_MIN;
  const buildingOnLeft = buildingX != null && buildingX <= CENTER_LEFT_ZONE_MAX;
  const buildingOnRight = buildingX != null && buildingX >= CENTER_RIGHT_ZONE_MIN;

  const leftTaken = forestOnLeft || buildingOnLeft;
  const rightTaken = forestOnRight || buildingOnRight;

  if (!leftTaken) hemis.push("left");
  if (!rightTaken) hemis.push("right");
  if (leftTaken && rightTaken) return ["left", "right"];
  return hemis.length > 0 ? hemis : ["left", "right"];
}

/**
 * @param {{
 *   forestX?: number | null;
 *   forestSizePx?: number;
 *   buildingX?: number | null;
 *   buildingSizePx?: number;
 *   layerWidthPx?: number;
 * }} params
 * @returns {OccupiedZone[]}
 */
export function buildCrystalOccupiedZones(params) {
  const {
    forestX = null,
    forestSizePx = 0,
    buildingX = null,
    buildingSizePx = 0,
    layerWidthPx = 390,
  } = params;
  /** @type {OccupiedZone[]} */
  const zones = [];
  if (forestX != null) {
    zones.push({
      center: forestX,
      halfWidth: elementHalfWidthPercent(forestSizePx * CRYSTAL_FOREST_OCCUPIED_INFLATE, layerWidthPx),
    });
  }
  if (buildingX != null) {
    zones.push({
      center: buildingX,
      halfWidth: elementHalfWidthPercent(buildingSizePx * CRYSTAL_BUILDING_OCCUPIED_INFLATE, layerWidthPx),
    });
  }
  return zones;
}

/**
 * @param {number} xPercent
 * @param {number} selfSizePx
 * @param {number} layerWidthPx
 * @param {OccupiedZone[]} occupiedZones
 * @param {number} [extraPaddingPct]
 */
export function placementOverlapsOccupants(
  xPercent,
  selfSizePx,
  layerWidthPx,
  occupiedZones,
  extraPaddingPct = CRYSTAL_OCCUPIED_EXTRA_PADDING_PCT,
) {
  const hw = elementHalfWidthPercent(selfSizePx, layerWidthPx);
  for (const zone of occupiedZones) {
    const gap = Math.abs(xPercent - zone.center) - zone.halfWidth - hw - extraPaddingPct;
    if (gap < 0) return true;
  }
  return false;
}

/**
 * @param {{ min: number; max: number }} interval
 * @param {number} hw
 * @param {OccupiedZone[]} occupiedZones
 */
function gapSeparationScore(interval, hw, occupiedZones) {
  const mid = (interval.min + interval.max) / 2;
  let minClear = interval.max - interval.min;
  for (const zone of occupiedZones) {
    const clear = Math.abs(mid - zone.center) - zone.halfWidth - hw;
    if (clear < minClear) minClear = clear;
  }
  return minClear;
}

/**
 * Coloca un elemento en el hueco libre más amplio (bosque/castillo/logo/riscos).
 * @param {{
 *   rng: () => number;
 *   layerWidthPx?: number;
 *   selfSizePx?: number;
 *   occupiedZones?: OccupiedZone[];
 *   cliffLeftPx?: number;
 *   cliffRightPx?: number;
 *   avoidEdgeCliffs?: boolean;
 *   minGapFactor?: number;
 *   zoneMarginFrac?: number;
 *   occupiedExtraPaddingPct?: number;
 *   allowedHemispheres?: readonly ('left' | 'right')[];
 * }} options
 * @returns {number | null} centro en % o null si no cabe
 */
export function pickGapPlacementX(options) {
  const {
    rng,
    layerWidthPx = 390,
    selfSizePx = 80,
    occupiedZones = [],
    cliffLeftPx = 0,
    cliffRightPx = 0,
    avoidEdgeCliffs = true,
    minGapFactor = 2.1,
    zoneMarginFrac = GAP_ZONE_MARGIN_FRAC,
    occupiedExtraPaddingPct = 0,
    allowedHemispheres = null,
  } = options;

  const hw = elementHalfWidthPercent(selfSizePx, layerWidthPx);
  const margin = hw * zoneMarginFrac;
  const minGap = hw * minGapFactor;

  const blocked = mergeBlockedIntervals([
    { min: CENTER_LEFT_ZONE_MAX, max: CENTER_RIGHT_ZONE_MIN },
    ...occupiedZones.map((z) => ({
      min: z.center - z.halfWidth - margin - occupiedExtraPaddingPct,
      max: z.center + z.halfWidth + margin + occupiedExtraPaddingPct,
    })),
  ]);

  /** @type {{ min: number; max: number }[]} */
  const candidates = [];
  /** @type {readonly { preferSide: 'left' | 'right'; zoneMin: number; zoneMax: number }[]} */
  const allHemispheres = [
    { preferSide: "left", zoneMin: PLACE_LEFT_MIN, zoneMax: CENTER_LEFT_ZONE_MAX },
    { preferSide: "right", zoneMin: CENTER_RIGHT_ZONE_MIN, zoneMax: PLACE_LEFT_MAX },
  ];
  const hemispheres = allowedHemispheres?.length
    ? allHemispheres.filter((h) => allowedHemispheres.includes(h.preferSide))
    : allHemispheres;

  for (const { preferSide, zoneMin, zoneMax } of hemispheres) {
    const safe = computeSafeCenterRange(
      layerWidthPx,
      selfSizePx,
      avoidEdgeCliffs ? cliffLeftPx : 0,
      avoidEdgeCliffs ? cliffRightPx : 0,
      avoidEdgeCliffs ? preferSide : null,
    );
    const placeMin = Math.max(zoneMin, safe.min);
    const placeMax = Math.min(zoneMax, safe.max);
    if (placeMin >= placeMax) continue;

    const free = findFreeIntervals(blocked, placeMin, placeMax)
      .filter((iv) => iv.max - iv.min >= minGap);
    candidates.push(...free);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const sepA = gapSeparationScore(a, hw, occupiedZones);
    const sepB = gapSeparationScore(b, hw, occupiedZones);
    if (Math.abs(sepB - sepA) > 0.5) return sepB - sepA;
    return (b.max - b.min) - (a.max - a.min);
  });
  const pickIdx = Math.min(candidates.length - 1, Math.floor(rng() * Math.min(3, candidates.length)));
  const gap = candidates[pickIdx];
  return randRange(rng, gap.min + hw, gap.max - hw);
}

/**
 * @param {OccupiedZone[]} zones
 * @param {number | null | undefined} center
 * @param {number} sizePx
 * @param {number} layerWidthPx
 */
export function occupiedZoneFromActive(zones, center, sizePx, layerWidthPx) {
  if (center == null) return zones;
  return [
    ...zones,
    { center, halfWidth: elementHalfWidthPercent(sizePx, layerWidthPx) },
  ];
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   reducedMotion?: boolean;
 *   terrainHeightPx?: number;
 *   devKind?: string;
 *   devFaction?: import('./loader-fantasy-castle-factions.js').CastleFaction;
 *   devSeed?: number;
 *   devFormation?: import('./loader-fantasy-cliffs.js').CliffFormationType;
 *   terrainProfile?: import('./loader-fantasy-terrain.js').TerrainProfile;
 * }} [opts]
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyScene(container, opts = {}) {
  const {
    reducedMotion = false,
    terrainHeightPx = 48,
    devKind,
    devFaction,
    devSeed,
    devFormation,
    terrainProfile,
  } = opts;

  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--fantasy-scene";
  layer.setAttribute("aria-hidden", "true");
  container.appendChild(layer);

  let destroyed = false;
  /** @type {{ destroy: () => void } | null} */
  let forestTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let buildingTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let crystalsTeardown = null;
  /** @type {{ destroy: () => void }[]} */
  let cliffTeardowns = [];
  /** @type {{ left: boolean; right: boolean }} */
  const cliffActive = { left: false, right: false };
  /** @type {{ left: number; right: number }} */
  const cliffSizePx = { left: 0, right: 0 };
  let forestTimer = 0;
  let buildingTimer = 0;
  let crystalsTimer = 0;
  let cycleRng = createRng(sessionSeed());
  let forestSpawnVariant = 0;
  let buildingSpawnVariant = 0;
  let crystalsSpawnVariant = 0;
  /** @type {number | null} */
  let activeForestX = null;
  let activeForestSizePx = 0;
  /** @type {number | null} */
  let activeBuildingX = null;
  let activeBuildingSizePx = 0;
  /** @type {number | null} */
  let activeCrystalsX = null;
  let activeCrystalsSizePx = 0;
  let wallSessionSeed = sessionSeed();
  /** @type {import('./loader-fantasy-cliffs.js').CliffFormationType | undefined} */
  let wallFormationType;

  const centerDevEnabled = {
    forest: !devKind || devKind === "forest",
    building: !devKind || devKind === "castle" || devKind === "palace",
    crystals: !devKind || devKind === "crystals",
  };

  /** @param {number} cycleSeed */
  function resolveWallFormation(cycleSeed) {
    if (devKind === "cliffs") {
      return devFormation ?? "cliff";
    }
    return planCliffFormation(cycleSeed);
  }

  function destroy() {
    destroyed = true;
    clearTimeout(forestTimer);
    clearTimeout(buildingTimer);
    clearTimeout(crystalsTimer);
    if (forestTeardown) {
      forestTeardown.destroy();
      forestTeardown = null;
    }
    if (buildingTeardown) {
      buildingTeardown.destroy();
      buildingTeardown = null;
    }
    if (crystalsTeardown) {
      crystalsTeardown.destroy();
      crystalsTeardown = null;
    }
    activeForestX = null;
    activeForestSizePx = 0;
    activeBuildingX = null;
    activeBuildingSizePx = 0;
    activeCrystalsX = null;
    activeCrystalsSizePx = 0;
    for (const td of cliffTeardowns) td.destroy();
    cliffTeardowns = [];
    cliffActive.left = false;
    cliffActive.right = false;
    cliffSizePx.left = 0;
    cliffSizePx.right = 0;
    layer.remove();
  }

  function computeSizePx(kind) {
    const layerH = layer.clientHeight || 200;
    const isCastle = kind === "castle" || kind === "palace";
    const isCliff = kind === "cliffs";
    const isForest = kind === "forest";
    const isCrystals = kind === "crystals";
    const fracMin = isCastle
      ? CASTLE_HEIGHT_FRAC_MIN
      : isCliff
        ? CLIFF_HEIGHT_FRAC_MIN
        : isForest
          ? FOREST_HEIGHT_FRAC_MIN
          : isCrystals
            ? CRYSTAL_HEIGHT_FRAC_MIN
            : HEIGHT_FRACTION_MIN;
    const fracMax = isCastle
      ? CASTLE_HEIGHT_FRAC_MAX
      : isCliff
        ? CLIFF_HEIGHT_FRAC_MAX
        : isForest
          ? FOREST_HEIGHT_FRAC_MAX
          : isCrystals
            ? CRYSTAL_HEIGHT_FRAC_MAX
            : HEIGHT_FRACTION_MAX;
    const frac = randRange(cycleRng, fracMin, fracMax);
    const raw = layerH * frac;
    const minPx = isCliff
      ? CLIFF_MIN_HEIGHT_PX
      : isForest
        ? FOREST_MIN_HEIGHT_PX
        : isCrystals
          ? CRYSTAL_MIN_HEIGHT_PX
          : MIN_ELEMENT_HEIGHT_PX;
    const maxPx = isCastle
      ? CASTLE_MAX_HEIGHT_PX
      : isCliff
        ? CLIFF_MAX_HEIGHT_PX
        : isForest
          ? FOREST_MAX_HEIGHT_PX
          : isCrystals
            ? CRYSTAL_MAX_HEIGHT_PX
            : MAX_ELEMENT_HEIGHT_PX;
    return Math.max(minPx, Math.min(maxPx, raw));
  }

  /**
   * Una sola formación por extremo; no respawn si ya hay muro activo en ese lado.
   * @param {'left' | 'right'} side
   * @param {number} [cycleSeed]
   * @param {import('./loader-fantasy-cliffs.js').CliffFormationType} [formationType]
   */
  function spawnCliffWall(side, cycleSeed = wallSessionSeed, formationType) {
    if (destroyed || cliffActive[side]) return;

    const type = formationType ?? wallFormationType ?? resolveWallFormation(cycleSeed);
    wallFormationType = type;

    const cliffSeed = mixFantasySeed(cycleSeed, side === "left" ? 0x10 : 0x20);
    const sizePx = computeSizePx("cliffs");
    const element = generateFantasyElement("cliffs", {
      seed: cliffSeed,
      side,
      formationType: type,
      terrainHeightPx,
      cliffSizePx: sizePx,
    });
    if (!element) return;

    const timing = planLifecycleTiming(cliffSeed, "cliffs", element.parts.length);
    const devTiming = devKind === "cliffs"
      ? { ...timing, holdMs: 4000, erodeMs: 6000, gapMs: 800 }
      : timing;
    const xPercent = side === "left" ? 0 : 100;

    cliffActive[side] = true;
    cliffSizePx[side] = sizePx;
    const teardown = mountFantasyElement(layer, element, {
      reducedMotion,
      xPercent,
      anchor: side,
      sizePx,
      terrainHeightPx,
      terrainProfile,
      timing: devTiming,
      onGone: () => {
        cliffActive[side] = false;
        cliffSizePx[side] = 0;
        cliffTeardowns = cliffTeardowns.filter((t) => t !== teardown);
        if (devKind === "cliffs") {
          if (!cliffActive.left && !cliffActive.right) {
            setTimeout(() => startCliffDevMode(sessionSeed()), devTiming.gapMs);
          }
          return;
        }
        spawnCliffWall(side, sessionSeed(), wallFormationType);
      },
    });
    cliffTeardowns.push(teardown);
  }

  /** Mantiene exactamente un muro por borde cuando procede. */
  function ensureEdgeWalls(cycleSeed = wallSessionSeed) {
    if (devKind === "cliffs") return;
    const formation = resolveWallFormation(cycleSeed);
    wallFormationType = formation;
    for (const side of planCliffSides(cycleSeed).sides) {
      spawnCliffWall(side, cycleSeed, formation);
    }
  }

  function scheduleForestSpawn(gapMs = 0) {
    if (destroyed || !centerDevEnabled.forest) return;
    clearTimeout(forestTimer);
    forestTimer = setTimeout(spawnForest, gapMs);
  }

  function scheduleBuildingSpawn(gapMs = 0) {
    if (destroyed || !centerDevEnabled.building) return;
    clearTimeout(buildingTimer);
    buildingTimer = setTimeout(spawnBuilding, gapMs);
  }

  function occupiedZonesForGaps(layerWidthPx) {
    let zones = [];
    zones = occupiedZoneFromActive(zones, activeForestX, activeForestSizePx, layerWidthPx);
    zones = occupiedZoneFromActive(zones, activeBuildingX, activeBuildingSizePx, layerWidthPx);
    zones = occupiedZoneFromActive(zones, activeCrystalsX, activeCrystalsSizePx, layerWidthPx);
    return zones;
  }

  function scheduleCrystalsSpawn(gapMs = 0) {
    if (destroyed || !centerDevEnabled.crystals) return;
    clearTimeout(crystalsTimer);
    crystalsTimer = setTimeout(spawnCrystals, gapMs);
  }

  function cliffMarginsForPlacement() {
    return {
      cliffLeftPx: cliffActive.left ? cliffSizePx.left : 0,
      cliffRightPx: cliffActive.right ? cliffSizePx.right : 0,
    };
  }

  function spawnForest() {
    if (destroyed || !centerDevEnabled.forest || forestTeardown) return;

    const variant = forestSpawnVariant;
    forestSpawnVariant += 1;
    const sizePx = computeSizePx("forest");
    const layerWidthPx = layer.clientWidth || 390;
    const xPercent = pickCenterPlacementX({
      rng: cycleRng,
      slot: "forest",
      otherXPercent: activeBuildingX,
      layerWidthPx,
      selfSizePx: sizePx,
      bothSlotsEnabled: centerDevEnabled.forest && centerDevEnabled.building,
    });
    activeForestX = xPercent;
    activeForestSizePx = sizePx;
    const baseSeed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    const seed = mixFantasySeed(baseSeed, variant);

    const element = generateFantasyElement("forest", {
      seed,
      terrainProfile,
      forestCenterXNorm: xPercent / 100,
      terrainHeightPx,
    });
    if (!element) {
      scheduleForestSpawn(2000);
      return;
    }

    const baseTiming = planLifecycleTiming(seed, "forest", element.parts.length);
    const timing = devKind || devFaction
      ? { ...baseTiming, holdMs: 3200, gapMs: 500 }
      : baseTiming;

    forestTeardown = mountFantasyElement(layer, element, {
      reducedMotion,
      xPercent,
      sizePx,
      terrainHeightPx,
      terrainProfile,
      timing,
      onGone: () => {
        forestTeardown = null;
        activeForestX = null;
        activeForestSizePx = 0;
        scheduleForestSpawn(timing.gapMs);
      },
    });
  }

  function spawnBuilding() {
    if (destroyed || !centerDevEnabled.building || buildingTeardown) return;

    const kind = planBuildingKind(cycleRng, devKind);
    const variant = buildingSpawnVariant;
    buildingSpawnVariant += 1;
    const sizePx = computeSizePx(kind);
    const layerWidthPx = layer.clientWidth || 390;
    const xPercent = pickCenterPlacementX({
      rng: cycleRng,
      slot: "building",
      otherXPercent: activeForestX,
      layerWidthPx,
      selfSizePx: sizePx,
      bothSlotsEnabled: centerDevEnabled.forest && centerDevEnabled.building,
      avoidEdgeCliffs: true,
      ...cliffMarginsForPlacement(),
    });
    activeBuildingX = xPercent;
    activeBuildingSizePx = sizePx;
    const seed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    const faction = devFaction ?? pickFaction(cycleRng, kind === "palace");

    const element = generateFantasyElement(kind, {
      seed,
      variant,
      faction,
      terrainHeightPx,
      castleSizePx: sizePx,
    });
    if (!element) {
      scheduleBuildingSpawn(2000);
      return;
    }

    const baseTiming = planLifecycleTiming(seed, kind, element.parts.length);
    const timing = devKind || devFaction
      ? { ...baseTiming, holdMs: 2200, gapMs: 500 }
      : baseTiming;

    buildingTeardown = mountFantasyElement(layer, element, {
      reducedMotion,
      xPercent,
      sizePx,
      terrainHeightPx,
      terrainProfile,
      timing,
      onGone: () => {
        buildingTeardown = null;
        activeBuildingX = null;
        activeBuildingSizePx = 0;
        scheduleBuildingSpawn(timing.gapMs);
      },
    });
  }

  function occupiedZonesForCrystalGaps(layerWidthPx) {
    return buildCrystalOccupiedZones({
      forestX: activeForestX,
      forestSizePx: activeForestSizePx,
      buildingX: activeBuildingX,
      buildingSizePx: activeBuildingSizePx,
      layerWidthPx,
    });
  }

  function pickCrystalsPlacementX(layerWidthPx, sizePx) {
    const bothOccupied = activeForestX != null && activeBuildingX != null;
    const gapProbePx = Math.min(
      sizePx,
      bothOccupied ? 58 : CRYSTAL_GAP_PROBE_MAX_PX,
    );
    const occupiedZones = occupiedZonesForCrystalGaps(layerWidthPx);
    const cliffMargins = cliffMarginsForPlacement();
    const preferred = preferredCrystalHemispheres(activeForestX, activeBuildingX);
    const gapOpts = {
      rng: cycleRng,
      layerWidthPx,
      selfSizePx: gapProbePx,
      occupiedZones,
      minGapFactor: bothOccupied ? 1.62 : 1.75,
      zoneMarginFrac: CRYSTAL_GAP_ZONE_MARGIN_FRAC,
      occupiedExtraPaddingPct: CRYSTAL_OCCUPIED_EXTRA_PADDING_PCT,
      allowedHemispheres: preferred,
      ...cliffMargins,
    };

    let xPercent = pickGapPlacementX({ ...gapOpts, avoidEdgeCliffs: true });
    if (xPercent == null) {
      xPercent = pickGapPlacementX({ ...gapOpts, avoidEdgeCliffs: false });
    }
    if (xPercent == null && preferred.length === 1) {
      xPercent = pickGapPlacementX({
        ...gapOpts,
        avoidEdgeCliffs: false,
        allowedHemispheres: ["left", "right"],
      });
    }
    if (xPercent == null) return null;
    if (placementOverlapsOccupants(xPercent, gapProbePx, layerWidthPx, occupiedZones)) {
      return null;
    }
    return xPercent;
  }

  function spawnCrystals() {
    if (destroyed || !centerDevEnabled.crystals || crystalsTeardown) {
      scheduleCrystalsSpawn(randRange(cycleRng, 1800, 3600));
      return;
    }

    const crystalsDev = devKind === "crystals";
    if (!crystalsDev && cycleRng() > CRYSTAL_SPAWN_CHANCE) {
      scheduleCrystalsSpawn(randRange(cycleRng, 1600, 3800));
      return;
    }

    const variant = crystalsSpawnVariant;
    crystalsSpawnVariant += 1;
    const sizePx = computeSizePx("crystals");
    const layerWidthPx = layer.clientWidth || 390;
    const xPercent = pickCrystalsPlacementX(layerWidthPx, sizePx);

    if (xPercent == null) {
      scheduleCrystalsSpawn(randRange(cycleRng, 900, 2000));
      return;
    }

    activeCrystalsX = xPercent;
    activeCrystalsSizePx = sizePx;
    const baseSeed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    const seed = mixFantasySeed(baseSeed, variant);

    const element = generateFantasyElement("crystals", { seed });
    if (!element) {
      activeCrystalsX = null;
      activeCrystalsSizePx = 0;
      scheduleCrystalsSpawn(2000);
      return;
    }

    const baseTiming = planLifecycleTiming(seed, "crystals", element.parts.length);
    const timing = crystalsDev
      ? { ...baseTiming, holdMs: 8000, erodeMs: 3200, gapMs: 600 }
      : baseTiming;

    crystalsTeardown = mountFantasyElement(layer, element, {
      reducedMotion,
      xPercent,
      sizePx,
      terrainHeightPx,
      terrainProfile,
      timing,
      onGone: () => {
        crystalsTeardown = null;
        activeCrystalsX = null;
        activeCrystalsSizePx = 0;
        const retryGap = crystalsDev
          ? timing.gapMs
          : timing.gapMs + randRange(cycleRng, 2400, 5600);
        scheduleCrystalsSpawn(retryGap);
      },
    });
  }

  function startCliffDevMode(seed) {
    wallSessionSeed = seed;
    const formation = resolveWallFormation(seed);
    wallFormationType = formation;
    for (const side of planCliffSides(seed).sides) {
      spawnCliffWall(side, seed, formation);
    }
    if (!cliffActive.left && !cliffActive.right) scheduleForestSpawn(2000);
  }

  function bootstrapCenterSpawns() {
    const quick = Boolean(devKind || devFaction);
    const baseGap = quick ? 200 : 900;
    if (centerDevEnabled.forest) {
      const forestDelay = quick ? 0 : randRange(cycleRng, 0, 500);
      scheduleForestSpawn(baseGap + forestDelay);
    }
    if (centerDevEnabled.building) {
      const buildingDelay = quick ? 0 : randRange(cycleRng, 200, 1100);
      scheduleBuildingSpawn(baseGap + buildingDelay);
    }
    if (centerDevEnabled.crystals) {
      const crystalDelay = quick ? 0 : randRange(cycleRng, 250, 1100);
      scheduleCrystalsSpawn(baseGap + crystalDelay);
    }
  }

  wallSessionSeed = sessionSeed();
  ensureEdgeWalls(wallSessionSeed);
  if (devKind === "cliffs") {
    const cliffSeed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    startCliffDevMode(cliffSeed);
  } else {
    bootstrapCenterSpawns();
  }

  return { destroy };
}
