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

/** Margen de hueco compartido por bosque, castillo y cristales en modo triple. */
export const TRIO_CENTER_MIN_GAP_FACTOR = 1.58;
/** Padding adicional (% ancho) entre formaciones centrales activas. */
export const SCENE_OCCUPIED_EXTRA_PADDING_PCT = 4.5;
/** @deprecated alias histórico */
const CRYSTAL_OCCUPIED_EXTRA_PADDING_PCT = SCENE_OCCUPIED_EXTRA_PADDING_PCT;
/** Inflado de la caja de castillo al calcular ocupación (más ancho visual). */
const SCENE_BUILDING_OCCUPIED_INFLATE = 1.16;
/** @deprecated alias histórico */
const CRYSTAL_BUILDING_OCCUPIED_INFLATE = SCENE_BUILDING_OCCUPIED_INFLATE;
/** Inflado de la caja de bosque al calcular ocupación. */
const SCENE_FOREST_OCCUPIED_INFLATE = 1.22;
/** Margen extra al buscar hueco libre para un bosque. */
export const SCENE_FOREST_PLACEMENT_INFLATE = 1.26;
/** Colchón sobre el ancho normalizado del bosque (viewBox). */
export const FOREST_FOOTPRINT_PAD = 1.06;
/** @deprecated alias histórico */
const CRYSTAL_FOREST_OCCUPIED_INFLATE = SCENE_FOREST_OCCUPIED_INFLATE;
/** Inflado de la caja de racimo de cristales al calcular ocupación. */
const SCENE_CRYSTAL_OCCUPIED_INFLATE = 1.14;
/** Inflado de la caja de portal al calcular ocupación. */
const SCENE_PORTAL_OCCUPIED_INFLATE = 1.13;
/** @deprecated alias histórico */
const CRYSTAL_CLUSTER_OCCUPIED_INFLATE = SCENE_CRYSTAL_OCCUPIED_INFLATE;

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

const FOREST_HEIGHT_FRAC_MIN = 0.28;
const FOREST_HEIGHT_FRAC_MAX = 0.42;
const FOREST_MIN_HEIGHT_PX = 74;
const FOREST_MAX_HEIGHT_PX = 144;

// Muros laterales (costura en x 0 % / 100 %).
const CLIFF_HEIGHT_FRAC_MIN = 0.26;
const CLIFF_HEIGHT_FRAC_MAX = 0.42;
const CLIFF_MIN_HEIGHT_PX = 46;
const CLIFF_MAX_HEIGHT_PX = 142;

const CRYSTAL_HEIGHT_FRAC_MIN = 0.18;
const CRYSTAL_HEIGHT_FRAC_MAX = 0.30;
const CRYSTAL_MIN_HEIGHT_PX = 52;
const CRYSTAL_MAX_HEIGHT_PX = 115;

const PORTAL_HEIGHT_FRAC_MIN = 0.15;
const PORTAL_HEIGHT_FRAC_MAX = 0.40;
const PORTAL_MIN_HEIGHT_PX = 46;
const PORTAL_MAX_HEIGHT_PX = 145;

let _sessionSeedCounter = Date.now() & 0x7fffffff;

function sessionSeed() {
  _sessionSeedCounter = (_sessionSeedCounter * 1664525 + 1013904223) & 0x7fffffff;
  return _sessionSeedCounter;
}

/** @typedef {'forest' | 'building' | 'crystals' | 'portal'} CenterSceneSlot */

/** Ranuras centrales del loader (no incluye riscos laterales). */
export const CENTER_SCENE_SLOTS = /** @type {const} */ ([
  "forest",
  "building",
  "crystals",
  "portal",
]);

/** Máximo de elementos centrales visibles a la vez en el loader general. */
export const CENTER_SCENE_MAX_CONCURRENT = 3;

/** Peso relativo al elegir el siguiente tipo (más bosques en escena). */
export const CENTER_SCENE_SLOT_WEIGHTS = /** @type {const} */ ({
  forest: 2.4,
  building: 1,
  crystals: 1,
  portal: 1,
});

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
 * Hemisferio con más ocupación registrada (bosque, castillo o cristales).
 * @param {OccupiedZone[]} occupiedZones
 * @returns {'left' | 'right' | null}
 */
export function dominantHemisphereFromOccupiedZones(occupiedZones) {
  if (!occupiedZones.length) return null;
  let leftWeight = 0;
  let rightWeight = 0;
  for (const zone of occupiedZones) {
    const leftEdge = zone.center - zone.halfWidth;
    const rightEdge = zone.center + zone.halfWidth;
    if (leftEdge < CENTER_LEFT_ZONE_MAX) {
      leftWeight += Math.min(zone.halfWidth, CENTER_LEFT_ZONE_MAX - leftEdge);
    }
    if (rightEdge > CENTER_RIGHT_ZONE_MIN) {
      rightWeight += Math.min(zone.halfWidth, rightEdge - CENTER_RIGHT_ZONE_MIN);
    }
  }
  if (leftWeight > rightWeight + 0.35) return "left";
  if (rightWeight > leftWeight + 0.35) return "right";
  return null;
}

/**
 * Hemisferio(s) preferidos para bosque o edificio (opuestos entre sí).
 * @param {CenterSceneSlot} slot
 * @param {number | null} otherXPercent
 * @param {() => number} rng
 * @param {boolean} bothSlotsEnabled
 * @param {OccupiedZone[]} [occupiedZones]
 * @returns {readonly ('left' | 'right')[] | null}
 */
export function resolveCenterPlacementHemispheres(
  slot,
  otherXPercent,
  rng,
  bothSlotsEnabled,
  occupiedZones = [],
) {
  if (!bothSlotsEnabled) return null;
  /** @type {'left' | 'right'} */
  let targetSide;
  if (otherXPercent != null) {
    targetSide = otherXPercent < 50 ? "right" : "left";
  } else {
    const dominant = dominantHemisphereFromOccupiedZones(occupiedZones);
    if (dominant != null) {
      targetSide = dominant === "left" ? "right" : "left";
    } else {
      const forestOnLeft = rng() < 0.5;
      const selfOnLeft = slot === "forest" ? forestOnLeft : !forestOnLeft;
      targetSide = selfOnLeft ? "left" : "right";
    }
  }
  return [targetSide];
}

/**
 * Coloca bosque o edificio en un hueco libre sin solapar otros elementos activos.
 * @param {{
 *   rng: () => number;
 *   slot: CenterSceneSlot;
 *   otherXPercent?: number | null;
 *   layerWidthPx?: number;
 *   selfSizePx?: number;
 *   bothSlotsEnabled?: boolean;
 *   occupiedZones?: OccupiedZone[];
 *   cliffLeftPx?: number;
 *   cliffRightPx?: number;
 *   avoidEdgeCliffs?: boolean;
 *   minGapFactor?: number;
 *   zoneMarginFrac?: number;
 *   occupiedExtraPaddingPct?: number;
 * }} options
 * @returns {number | null}
 */
export function pickCenterGapPlacementX(options) {
  const {
    rng,
    slot,
    otherXPercent = null,
    layerWidthPx = 390,
    selfSizePx = 96,
    bothSlotsEnabled = true,
    occupiedZones = [],
    cliffLeftPx = 0,
    cliffRightPx = 0,
    avoidEdgeCliffs = false,
    minGapFactor = 1.65,
    zoneMarginFrac = GAP_ZONE_MARGIN_FRAC,
    occupiedExtraPaddingPct = SCENE_OCCUPIED_EXTRA_PADDING_PCT,
  } = options;

  const allowedHemispheres = resolveCenterPlacementHemispheres(
    slot,
    otherXPercent,
    rng,
    bothSlotsEnabled,
    occupiedZones,
  );

  const gapOpts = {
    rng,
    layerWidthPx,
    selfSizePx,
    occupiedZones,
    cliffLeftPx,
    cliffRightPx,
    avoidEdgeCliffs,
    minGapFactor,
    zoneMarginFrac,
    occupiedExtraPaddingPct,
    allowedHemispheres: allowedHemispheres ?? undefined,
  };

  let x = pickGapPlacementX(gapOpts);
  if (x == null && avoidEdgeCliffs) {
    x = pickGapPlacementX({ ...gapOpts, avoidEdgeCliffs: false });
  }
  if (x == null && allowedHemispheres?.length === 1) {
    const opposite = allowedHemispheres[0] === "left" ? "right" : "left";
    x = pickGapPlacementX({
      ...gapOpts,
      avoidEdgeCliffs: false,
      allowedHemispheres: [opposite],
    });
  }
  if (x == null) return null;
  if (placementOverlapsOccupants(
    x,
    selfSizePx,
    layerWidthPx,
    occupiedZones,
    occupiedExtraPaddingPct,
  )) {
    return null;
  }
  return x;
}

/**
 * Los tres tipos centrales (bosque, castillo, cristales) están activos.
 * @param {{ forest?: boolean; building?: boolean; crystals?: boolean }} enabled
 * @returns {boolean}
 */
export function isTrioCenterMode(enabled) {
  return Boolean(enabled?.forest && enabled?.building && enabled?.crystals);
}

/**
 * @param {{ forest?: boolean; building?: boolean; crystals?: boolean; portal?: boolean }} enabled
 * @returns {CenterSceneSlot[]}
 */
export function listEnabledCenterSlots(enabled) {
  return CENTER_SCENE_SLOTS.filter((slot) => Boolean(enabled?.[slot]));
}

/**
 * Loader general: elige al azar entre tipos habilitados (máx. 3 en escena).
 * @param {string | undefined} devKind
 * @param {{ forest?: boolean; building?: boolean; crystals?: boolean; portal?: boolean }} enabled
 * @returns {boolean}
 */
export function isCenterDirectorMode(devKind, enabled) {
  if (devKind) return false;
  return listEnabledCenterSlots(enabled).length > 1;
}

/**
 * @param {{ forest?: boolean; building?: boolean; crystals?: boolean; portal?: boolean }} active
 * @returns {number}
 */
export function countActiveCenterSlots(active) {
  return CENTER_SCENE_SLOTS.reduce((n, slot) => n + (active?.[slot] ? 1 : 0), 0);
}

/**
 * Elige la siguiente ranura central al azar (evita repetir la última si hay alternativas).
 * @param {() => number} rng
 * @param {{ forest?: boolean; building?: boolean; crystals?: boolean; portal?: boolean }} enabled
 * @param {{ forest?: boolean; building?: boolean; crystals?: boolean; portal?: boolean }} active
 * @param {CenterSceneSlot | null} [lastSlot]
 * @returns {CenterSceneSlot | null}
 */
export function pickRandomCenterSlot(rng, enabled, active, lastSlot = null) {
  let pool = listEnabledCenterSlots(enabled).filter((slot) => !active?.[slot]);
  if (pool.length === 0) return null;
  if (lastSlot && pool.length > 1) {
    const without = pool.filter((s) => s !== lastSlot);
    if (without.length > 0) pool = without;
  }
  const weights = pool.map((slot) => CENTER_SCENE_SLOT_WEIGHTS[slot] ?? 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Colocación por huecos libres (director o modo triple legacy).
 * @param {string | undefined} devKind
 * @param {{ forest?: boolean; building?: boolean; crystals?: boolean; portal?: boolean }} enabled
 * @returns {boolean}
 */
export function usesFairGapPlacement(devKind, enabled) {
  return isCenterDirectorMode(devKind, enabled) || isTrioCenterMode(enabled);
}

/**
 * Ancho horizontal efectivo del bosque en px (respeta viewBox 0–100 con overflow recortado).
 * @param {number} sizePx
 * @param {import('./loader-fantasy-element.js').FantasyElement | null | undefined} [element]
 * @returns {number}
 */
export function forestFootprintWidthPx(sizePx, element) {
  if (sizePx <= 0) return 0;
  if (!element?.width) return sizePx * SCENE_FOREST_OCCUPIED_INFLATE;
  const spanNorm = Math.min(220, element.width * FOREST_FOOTPRINT_PAD);
  return (sizePx * spanNorm) / 100;
}

/**
 * Ancho de colocación para huecos (ligeramente mayor que la huella visible).
 * @param {number} sizePx
 * @param {import('./loader-fantasy-element.js').FantasyElement | null | undefined} [element]
 * @returns {number}
 */
export function forestPlacementWidthPx(sizePx, element) {
  return forestFootprintWidthPx(sizePx, element) * (SCENE_FOREST_PLACEMENT_INFLATE / SCENE_FOREST_OCCUPIED_INFLATE);
}

/**
 * @param {number} sizePx
 * @param {import('./loader-fantasy-element.js').FantasyElement | null | undefined} element
 * @param {number} layerWidthPx
 * @returns {number}
 */
export function forestFootprintHalfWidthPercent(sizePx, element, layerWidthPx) {
  if (layerWidthPx <= 0) return 0;
  return (forestFootprintWidthPx(sizePx, element) / 2 / layerWidthPx) * 100;
}

/**
 * Bosque demasiado ancho para un hemisferio (logo + acantilados).
 * @param {number} spanPx
 * @param {number} layerWidthPx
 * @returns {boolean}
 */
export function forestNeedsWidePlacement(spanPx, layerWidthPx) {
  if (layerWidthPx <= 0 || spanPx <= 0) return false;
  const footprintPct = (spanPx / layerWidthPx) * 100;
  const hemisphereSpan = Math.min(
    CENTER_LEFT_ZONE_MAX - PLACE_LEFT_MIN,
    PLACE_LEFT_MAX - CENTER_RIGHT_ZONE_MIN,
  );
  return footprintPct > hemisphereSpan - CENTER_LOGO_GAP * 0.25;
}

/**
 * Coloca bosques anchos centrados, solapando el hueco del logo si hace falta.
 * @param {{
 *   rng: () => number;
 *   layerWidthPx?: number;
 *   spanPx: number;
 *   occupiedZones?: OccupiedZone[];
 *   occupiedExtraPaddingPct?: number;
 * }} options
 * @returns {number | null}
 */
export function pickWideForestCenterX(options) {
  const {
    rng,
    layerWidthPx = 390,
    spanPx,
    occupiedZones = [],
    occupiedExtraPaddingPct = SCENE_OCCUPIED_EXTRA_PADDING_PCT + 1.5,
  } = options;
  if (spanPx <= 0) return null;

  const safe = computeSafeCenterRange(layerWidthPx, spanPx, 0, 0, null);
  if (safe.min >= safe.max) return 50;

  /** @type {number[]} */
  const candidates = [50];
  for (let i = 0; i < 8; i += 1) {
    candidates.push(randRange(rng, safe.min, safe.max));
  }

  for (const x of candidates) {
    if (!placementOverlapsOccupants(
      x,
      spanPx,
      layerWidthPx,
      occupiedZones,
      occupiedExtraPaddingPct,
    )) {
      return x;
    }
  }

  for (const x of candidates) {
    if (!placementOverlapsOccupants(
      x,
      spanPx,
      layerWidthPx,
      occupiedZones,
      SCENE_OCCUPIED_EXTRA_PADDING_PCT,
    )) {
      return x;
    }
  }

  return randRange(rng, safe.min, safe.max);
}

/**
 * Colocación por hueco libre sin priorizar hemisferio ni tipo.
 * @param {{
 *   rng: () => number;
 *   layerWidthPx?: number;
 *   selfSizePx?: number;
 *   occupiedZones?: OccupiedZone[];
 *   cliffLeftPx?: number;
 *   cliffRightPx?: number;
 *   minGapFactor?: number;
 *   zoneMarginFrac?: number;
 *   occupiedExtraPaddingPct?: number;
 * }} options
 * @returns {number | null}
 */
export function pickFairGapPlacementX(options) {
  const {
    rng,
    layerWidthPx = 390,
    selfSizePx = 80,
    occupiedZones = [],
    cliffLeftPx = 0,
    cliffRightPx = 0,
    minGapFactor = TRIO_CENTER_MIN_GAP_FACTOR,
    zoneMarginFrac = GAP_ZONE_MARGIN_FRAC,
    occupiedExtraPaddingPct = SCENE_OCCUPIED_EXTRA_PADDING_PCT,
  } = options;

  const gapOpts = {
    rng,
    layerWidthPx,
    selfSizePx,
    occupiedZones,
    cliffLeftPx,
    cliffRightPx,
    minGapFactor,
    zoneMarginFrac,
    occupiedExtraPaddingPct,
  };

  let x = pickGapPlacementX({ ...gapOpts, avoidEdgeCliffs: true });
  if (x == null) {
    x = pickGapPlacementX({ ...gapOpts, avoidEdgeCliffs: false });
  }
  if (x == null) return null;
  if (placementOverlapsOccupants(
    x,
    selfSizePx,
    layerWidthPx,
    occupiedZones,
    occupiedExtraPaddingPct,
  )) {
    return null;
  }
  return x;
}

/**
 * Colocación en modo triple: si ya hay un elemento, intenta empaquetar en el
 * mismo hemisferio antes de ocupar el lado opuesto (deja hueco para el tercero).
 * @param {{
 *   rng: () => number;
 *   layerWidthPx?: number;
 *   selfSizePx?: number;
 *   occupiedZones?: OccupiedZone[];
 *   cliffLeftPx?: number;
 *   cliffRightPx?: number;
 *   minGapFactor?: number;
 *   zoneMarginFrac?: number;
 *   occupiedExtraPaddingPct?: number;
 * }} options
 * @returns {number | null}
 */
export function pickTrioScenePlacementX(options) {
  const {
    rng,
    layerWidthPx = 390,
    selfSizePx = 80,
    occupiedZones = [],
    cliffLeftPx = 0,
    cliffRightPx = 0,
    minGapFactor = TRIO_CENTER_MIN_GAP_FACTOR,
    zoneMarginFrac = GAP_ZONE_MARGIN_FRAC,
    occupiedExtraPaddingPct = SCENE_OCCUPIED_EXTRA_PADDING_PCT,
  } = options;

  const gapBase = {
    rng,
    layerWidthPx,
    selfSizePx,
    occupiedZones,
    cliffLeftPx,
    cliffRightPx,
    minGapFactor,
    zoneMarginFrac,
    occupiedExtraPaddingPct,
  };

  if (occupiedZones.length === 0) {
    for (const preferSide of ["left", "right"]) {
      const safe = computeSafeCenterRange(
        layerWidthPx,
        selfSizePx,
        cliffLeftPx,
        cliffRightPx,
        preferSide,
      );
      const zoneMin = preferSide === "left" ? PLACE_LEFT_MIN : CENTER_RIGHT_ZONE_MIN;
      const zoneMax = preferSide === "left" ? CENTER_LEFT_ZONE_MAX : PLACE_LEFT_MAX;
      const placeMin = Math.max(zoneMin, safe.min);
      const placeMax = Math.min(zoneMax, safe.max);
      if (placeMin >= placeMax) continue;

      const span = placeMax - placeMin;
      const edgeSlice = span * 0.42;
      const edgeMin = preferSide === "left" ? placeMin : placeMax - edgeSlice;
      const edgeMax = preferSide === "left" ? placeMin + edgeSlice : placeMax;
      const x = randRange(rng, edgeMin, edgeMax);
      if (!placementOverlapsOccupants(
        x,
        selfSizePx,
        layerWidthPx,
        occupiedZones,
        occupiedExtraPaddingPct,
      )) {
        return x;
      }
    }
    return pickFairGapPlacementX(options);
  }

  if (occupiedZones.length === 1) {
    const existing = occupiedZones[0];
    const existingOnLeft = existing.center <= CENTER_LEFT_ZONE_MAX;
    /** @type {readonly ('left' | 'right')[]} */
    const sameHemi = existingOnLeft ? ["left"] : ["right"];
    /** @type {readonly ('left' | 'right')[]} */
    const oppHemi = existingOnLeft ? ["right"] : ["left"];

    for (const hemis of [sameHemi, oppHemi]) {
      let x = pickGapPlacementX({
        ...gapBase,
        allowedHemispheres: hemis,
        avoidEdgeCliffs: true,
      });
      if (x == null) {
        x = pickGapPlacementX({
          ...gapBase,
          allowedHemispheres: hemis,
          avoidEdgeCliffs: false,
        });
      }
      if (x != null && !placementOverlapsOccupants(
        x,
        selfSizePx,
        layerWidthPx,
        occupiedZones,
        occupiedExtraPaddingPct,
      )) {
        return x;
      }
    }
    return null;
  }

  return pickFairGapPlacementX(options);
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
 * Zonas horizontales ocupadas por bosque, castillo/palacio, cristales y portal.
 * @param {{
 *   forestX?: number | null;
 *   forestSizePx?: number;
 *   buildingX?: number | null;
 *   buildingSizePx?: number;
 *   crystalsX?: number | null;
 *   crystalsSizePx?: number;
 *   portalX?: number | null;
 *   portalSizePx?: number;
 *   forestHalfWidthPct?: number | null;
 *   layerWidthPx?: number;
 * }} params
 * @returns {OccupiedZone[]}
 */
export function buildSceneOccupiedZones(params) {
  const {
    forestX = null,
    forestSizePx = 0,
    buildingX = null,
    buildingSizePx = 0,
    crystalsX = null,
    crystalsSizePx = 0,
    portalX = null,
    portalSizePx = 0,
    forestHalfWidthPct = null,
    layerWidthPx = 390,
  } = params;
  /** @type {OccupiedZone[]} */
  const zones = [];
  if (forestX != null) {
    zones.push({
      center: forestX,
      halfWidth: forestHalfWidthPct ?? elementHalfWidthPercent(
        forestSizePx * SCENE_FOREST_OCCUPIED_INFLATE,
        layerWidthPx,
      ),
    });
  }
  if (buildingX != null) {
    zones.push({
      center: buildingX,
      halfWidth: elementHalfWidthPercent(buildingSizePx * SCENE_BUILDING_OCCUPIED_INFLATE, layerWidthPx),
    });
  }
  if (crystalsX != null) {
    zones.push({
      center: crystalsX,
      halfWidth: elementHalfWidthPercent(crystalsSizePx * SCENE_CRYSTAL_OCCUPIED_INFLATE, layerWidthPx),
    });
  }
  if (portalX != null) {
    zones.push({
      center: portalX,
      halfWidth: elementHalfWidthPercent(portalSizePx * SCENE_PORTAL_OCCUPIED_INFLATE, layerWidthPx),
    });
  }
  return zones;
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
  return buildSceneOccupiedZones(params);
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
  extraPaddingPct = SCENE_OCCUPIED_EXTRA_PADDING_PCT,
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
 *   fxEnabled?: boolean;
 *   fxIntensity?: number;
 * }} [opts]
 * @returns {{ destroy: () => void; relayout?: () => void }}
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
    fxEnabled = true,
    fxIntensity = 1,
  } = opts;

  /** @param {Record<string, unknown>} [extra] */
  function baseElementMountOpts(extra = {}) {
    return {
      reducedMotion,
      terrainHeightPx,
      terrainProfile,
      fxEnabled,
      fxIntensity,
      ...extra,
    };
  }

  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--fantasy-scene";
  layer.setAttribute("aria-hidden", "true");
  container.appendChild(layer);

  let destroyed = false;
  /** @type {{ destroy: () => void; relayoutGround?: () => void } | null} */
  let forestTeardown = null;
  /** @type {{ destroy: () => void; relayoutGround?: () => void } | null} */
  let buildingTeardown = null;
  /** @type {{ destroy: () => void; relayoutGround?: () => void } | null} */
  let crystalsTeardown = null;
  /** @type {{ destroy: () => void; relayoutGround?: () => void } | null} */
  let portalTeardown = null;
  /** @type {{ destroy: () => void; relayoutGround?: () => void }[]} */
  let cliffTeardowns = [];
  /** @type {{ left: boolean; right: boolean }} */
  const cliffActive = { left: false, right: false };
  /** @type {{ left: number; right: number }} */
  const cliffSizePx = { left: 0, right: 0 };
  let forestTimer = 0;
  let buildingTimer = 0;
  let crystalsTimer = 0;
  let portalTimer = 0;
  let cycleRng = createRng(sessionSeed());
  let forestSpawnVariant = 0;
  let buildingSpawnVariant = 0;
  let crystalsSpawnVariant = 0;
  let portalSpawnVariant = 0;
  /** @type {number | null} */
  let activeForestX = null;
  let activeForestSizePx = 0;
  /** @type {number | null} */
  let activeBuildingX = null;
  let activeBuildingSizePx = 0;
  /** @type {number | null} */
  let activeCrystalsX = null;
  let activeCrystalsSizePx = 0;
  /** @type {number | null} */
  let activePortalX = null;
  let activePortalSizePx = 0;
  /** @type {number | null} */
  let activeForestHalfWidthPct = null;
  let wallSessionSeed = sessionSeed();
  /** @type {import('./loader-fantasy-cliffs.js').CliffFormationType | undefined} */
  let wallFormationType;

  const centerDevEnabled = {
    forest: !devKind || devKind === "forest",
    building: !devKind || devKind === "castle" || devKind === "palace",
    crystals: !devKind || devKind === "crystals",
    portal: !devKind || devKind === "portal",
  };

  const centerDirectorMode = isCenterDirectorMode(devKind, centerDevEnabled);
  const gapPlacementMode = usesFairGapPlacement(devKind, centerDevEnabled);
  let directorTimer = 0;
  /** @type {CenterSceneSlot | null} */
  let lastSpawnedSlot = null;

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
    clearTimeout(portalTimer);
    clearTimeout(directorTimer);
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
    if (portalTeardown) {
      portalTeardown.destroy();
      portalTeardown = null;
    }
    activeForestX = null;
    activeForestSizePx = 0;
    activeForestHalfWidthPct = null;
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
    const isPortal = kind === "portal";
    const fracMin = isCastle
      ? CASTLE_HEIGHT_FRAC_MIN
      : isCliff
        ? CLIFF_HEIGHT_FRAC_MIN
        : isForest
          ? FOREST_HEIGHT_FRAC_MIN
          : isCrystals
            ? CRYSTAL_HEIGHT_FRAC_MIN
            : isPortal
              ? PORTAL_HEIGHT_FRAC_MIN
              : HEIGHT_FRACTION_MIN;
    const fracMax = isCastle
      ? CASTLE_HEIGHT_FRAC_MAX
      : isCliff
        ? CLIFF_HEIGHT_FRAC_MAX
        : isForest
          ? FOREST_HEIGHT_FRAC_MAX
          : isCrystals
            ? CRYSTAL_HEIGHT_FRAC_MAX
            : isPortal
              ? PORTAL_HEIGHT_FRAC_MAX
              : HEIGHT_FRACTION_MAX;
    const frac = randRange(cycleRng, fracMin, fracMax);
    const raw = layerH * frac;
    const minPx = isCliff
      ? CLIFF_MIN_HEIGHT_PX
      : isForest
        ? FOREST_MIN_HEIGHT_PX
        : isCrystals
          ? CRYSTAL_MIN_HEIGHT_PX
          : isPortal
            ? PORTAL_MIN_HEIGHT_PX
            : MIN_ELEMENT_HEIGHT_PX;
    const maxPx = isCastle
      ? CASTLE_MAX_HEIGHT_PX
      : isCliff
        ? CLIFF_MAX_HEIGHT_PX
        : isForest
          ? FOREST_MAX_HEIGHT_PX
          : isCrystals
            ? CRYSTAL_MAX_HEIGHT_PX
            : isPortal
              ? PORTAL_MAX_HEIGHT_PX
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
    const teardown = mountFantasyElement(layer, element, baseElementMountOpts({
      xPercent,
      anchor: side,
      sizePx,
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
    }));
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

  function activeCenterSlotState() {
    return {
      forest: Boolean(forestTeardown),
      building: Boolean(buildingTeardown),
      crystals: Boolean(crystalsTeardown),
      portal: Boolean(portalTeardown),
    };
  }

  function countLiveCenterElements() {
    return countActiveCenterSlots(activeCenterSlotState());
  }

  function scheduleDirectorSpawn(gapMs = 0) {
    if (destroyed || !centerDirectorMode) return;
    clearTimeout(directorTimer);
    directorTimer = setTimeout(tryDirectorSpawn, gapMs);
  }

  function tryDirectorSpawn() {
    if (destroyed || !centerDirectorMode) return;
    if (countLiveCenterElements() >= CENTER_SCENE_MAX_CONCURRENT) return;

    const active = activeCenterSlotState();
    const next = pickRandomCenterSlot(cycleRng, centerDevEnabled, active, lastSpawnedSlot);
    if (!next) {
      scheduleDirectorSpawn(randRange(cycleRng, 700, 1600));
      return;
    }

    const spawned = spawnCenterSlot(next);
    if (spawned) {
      lastSpawnedSlot = next;
      if (countLiveCenterElements() < CENTER_SCENE_MAX_CONCURRENT) {
        scheduleDirectorSpawn(randRange(cycleRng, 350, 1000));
      }
      return;
    }
    scheduleDirectorSpawn(randRange(cycleRng, 800, 1800));
  }

  /**
   * @param {CenterSceneSlot} slot
   * @returns {boolean}
   */
  function spawnCenterSlot(slot) {
    switch (slot) {
      case "forest":
        return spawnForest();
      case "building":
        return spawnBuilding();
      case "crystals":
        return spawnCrystals();
      case "portal":
        return spawnPortal();
      default:
        return false;
    }
  }

  /**
   * @param {CenterSceneSlot} slot
   * @param {number} gapMs
   */
  function onCenterElementGone(slot, gapMs) {
    if (centerDirectorMode) {
      scheduleDirectorSpawn(gapMs);
      return;
    }
    switch (slot) {
      case "forest":
        scheduleForestSpawn(gapMs);
        break;
      case "building":
        scheduleBuildingSpawn(gapMs);
        break;
      case "crystals":
        scheduleCrystalsSpawn(gapMs);
        break;
      case "portal":
        schedulePortalSpawn(gapMs);
        break;
      default:
        break;
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
    return buildSceneOccupiedZones({
      forestX: activeForestX,
      forestSizePx: activeForestSizePx,
      forestHalfWidthPct: activeForestHalfWidthPct,
      buildingX: activeBuildingX,
      buildingSizePx: activeBuildingSizePx,
      crystalsX: activeCrystalsX,
      crystalsSizePx: activeCrystalsSizePx,
      portalX: activePortalX,
      portalSizePx: activePortalSizePx,
      layerWidthPx,
    });
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

  const trioCenterMode = gapPlacementMode;

  /**
   * @returns {boolean}
   */
  function spawnForest() {
    if (destroyed || !centerDevEnabled.forest || forestTeardown) return false;

    const variant = forestSpawnVariant;
    forestSpawnVariant += 1;
    const sizePx = computeSizePx("forest");
    const layerWidthPx = layer.clientWidth || 390;
    const occupiedZones = occupiedZonesForGaps(layerWidthPx);
    const cliffMargins = cliffMarginsForPlacement();
    const placementSpanPx = sizePx * SCENE_FOREST_OCCUPIED_INFLATE;
    const baseSeed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    const seed = mixFantasySeed(baseSeed, variant);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const roomy = occupiedZones.length === 0 && countLiveCenterElements() === 0;
      const spacious = !roomy
        && occupiedZones.length <= 2
        && countLiveCenterElements() <= 2;

      const element = generateFantasyElement("forest", {
        seed: mixFantasySeed(seed, attempt),
        roomy,
        spacious,
        terrainProfile,
        forestCenterXNorm: 0.5,
        terrainHeightPx,
      });
      if (!element) continue;

      const spanPx = forestFootprintWidthPx(sizePx, element);
      const wideForest = roomy || spacious || forestNeedsWidePlacement(spanPx, layerWidthPx);

      const xPercent = wideForest
        ? pickWideForestCenterX({
          rng: cycleRng,
          layerWidthPx,
          spanPx,
          occupiedZones,
        })
        : trioCenterMode
          ? pickTrioScenePlacementX({
            rng: cycleRng,
            layerWidthPx,
            selfSizePx: placementSpanPx,
            occupiedZones,
            minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
            ...cliffMargins,
          })
          : pickCenterGapPlacementX({
            rng: cycleRng,
            slot: "forest",
            otherXPercent: activeBuildingX,
            layerWidthPx,
            selfSizePx: placementSpanPx,
            bothSlotsEnabled: centerDevEnabled.forest && centerDevEnabled.building,
            occupiedZones,
            avoidEdgeCliffs: true,
            minGapFactor: 1.85,
            ...cliffMargins,
          });
      if (xPercent == null) continue;

      const forestCenterXNorm = xPercent / 100;
      const mountedElement = Math.abs(forestCenterXNorm - 0.5) < 0.015
        ? element
        : generateFantasyElement("forest", {
          seed: mixFantasySeed(seed, attempt),
          roomy,
          spacious,
          terrainProfile,
          forestCenterXNorm,
          terrainHeightPx,
        });
      if (!mountedElement) continue;

      if (placementOverlapsOccupants(
        xPercent,
        spanPx,
        layerWidthPx,
        occupiedZones,
        SCENE_OCCUPIED_EXTRA_PADDING_PCT + 1.5,
      )) {
        continue;
      }

      activeForestX = xPercent;
      activeForestSizePx = sizePx;
      activeForestHalfWidthPct = forestFootprintHalfWidthPercent(sizePx, mountedElement, layerWidthPx);

      const baseTiming = planLifecycleTiming(mountedElement.seed, "forest", mountedElement.parts.length);
      const timing = devKind || devFaction
        ? { ...baseTiming, holdMs: 3200, gapMs: 500 }
        : baseTiming;

      forestTeardown = mountFantasyElement(layer, mountedElement, baseElementMountOpts({
        xPercent,
        sizePx,
        timing,
        onGone: () => {
          forestTeardown = null;
          activeForestX = null;
          activeForestSizePx = 0;
          activeForestHalfWidthPct = null;
          onCenterElementGone("forest", timing.gapMs);
        },
      }));
      return true;
    }

    if (!centerDirectorMode) scheduleForestSpawn(randRange(cycleRng, 800, 1800));
    return false;
  }

  /**
   * @returns {boolean}
   */
  function spawnBuilding() {
    if (destroyed || !centerDevEnabled.building || buildingTeardown) return false;

    const kind = planBuildingKind(cycleRng, devKind);
    const variant = buildingSpawnVariant;
    buildingSpawnVariant += 1;
    const sizePx = computeSizePx(kind);
    const layerWidthPx = layer.clientWidth || 390;
    const occupiedZones = occupiedZonesForGaps(layerWidthPx);
    const cliffMargins = cliffMarginsForPlacement();
    const xPercent = trioCenterMode
      ? pickTrioScenePlacementX({
        rng: cycleRng,
        layerWidthPx,
        selfSizePx: sizePx,
        occupiedZones,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
        ...cliffMargins,
      })
      : pickCenterGapPlacementX({
        rng: cycleRng,
        slot: "building",
        otherXPercent: activeForestX,
        layerWidthPx,
        selfSizePx: sizePx,
        bothSlotsEnabled: centerDevEnabled.forest && centerDevEnabled.building,
        occupiedZones,
        avoidEdgeCliffs: true,
        minGapFactor: 1.62,
        ...cliffMargins,
      });
    if (xPercent == null) {
      if (!centerDirectorMode) scheduleBuildingSpawn(randRange(cycleRng, 800, 1800));
      return false;
    }
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
      activeBuildingX = null;
      activeBuildingSizePx = 0;
      if (!centerDirectorMode) scheduleBuildingSpawn(2000);
      return false;
    }

    const baseTiming = planLifecycleTiming(seed, kind, element.parts.length);
    const timing = devKind || devFaction
      ? { ...baseTiming, holdMs: 2200, gapMs: 500 }
      : baseTiming;

    buildingTeardown = mountFantasyElement(layer, element, baseElementMountOpts({
      xPercent,
      sizePx,
      timing,
      onGone: () => {
        buildingTeardown = null;
        activeBuildingX = null;
        activeBuildingSizePx = 0;
        onCenterElementGone("building", timing.gapMs);
      },
    }));
    return true;
  }

  function occupiedZonesForCrystalGaps(layerWidthPx) {
    return occupiedZonesForGaps(layerWidthPx);
  }

  function pickCrystalsPlacementX(layerWidthPx, sizePx) {
    const occupiedZones = occupiedZonesForCrystalGaps(layerWidthPx);
    const cliffMargins = cliffMarginsForPlacement();

    if (trioCenterMode) {
      return pickTrioScenePlacementX({
        rng: cycleRng,
        layerWidthPx,
        selfSizePx: sizePx,
        occupiedZones,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
        ...cliffMargins,
      });
    }

    const preferred = preferredCrystalHemispheres(activeForestX, activeBuildingX);
    const gapOpts = {
      rng: cycleRng,
      layerWidthPx,
      selfSizePx: sizePx,
      occupiedZones,
      minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      zoneMarginFrac: GAP_ZONE_MARGIN_FRAC,
      occupiedExtraPaddingPct: SCENE_OCCUPIED_EXTRA_PADDING_PCT,
      allowedHemispheres: preferred,
      ...cliffMargins,
    };

    let xPercent = pickGapPlacementX({ ...gapOpts, avoidEdgeCliffs: true });
    if (xPercent == null) {
      xPercent = pickGapPlacementX({ ...gapOpts, avoidEdgeCliffs: false });
    }
    if (xPercent == null) return null;
    if (placementOverlapsOccupants(xPercent, sizePx, layerWidthPx, occupiedZones)) {
      return null;
    }
    return xPercent;
  }

  /**
   * @returns {boolean}
   */
  function spawnCrystals() {
    if (destroyed || !centerDevEnabled.crystals || crystalsTeardown) return false;

    const crystalsDev = devKind === "crystals";
    const variant = crystalsSpawnVariant;
    crystalsSpawnVariant += 1;
    const sizePx = computeSizePx("crystals");
    const layerWidthPx = layer.clientWidth || 390;
    const xPercent = pickCrystalsPlacementX(layerWidthPx, sizePx);

    if (xPercent == null) {
      if (!centerDirectorMode) scheduleCrystalsSpawn(randRange(cycleRng, 800, 1800));
      return false;
    }

    activeCrystalsX = xPercent;
    activeCrystalsSizePx = sizePx;
    const baseSeed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    const seed = mixFantasySeed(baseSeed, variant);

    const element = generateFantasyElement("crystals", { seed });
    if (!element) {
      activeCrystalsX = null;
      activeCrystalsSizePx = 0;
      if (!centerDirectorMode) scheduleCrystalsSpawn(2000);
      return false;
    }

    const baseTiming = planLifecycleTiming(seed, "crystals", element.parts.length);
    const timing = crystalsDev
      ? { ...baseTiming, holdMs: 8000, erodeMs: 3200, gapMs: 600 }
      : baseTiming;

    crystalsTeardown = mountFantasyElement(layer, element, baseElementMountOpts({
      xPercent,
      sizePx,
      timing,
      onGone: () => {
        crystalsTeardown = null;
        activeCrystalsX = null;
        activeCrystalsSizePx = 0;
        onCenterElementGone("crystals", timing.gapMs);
      },
    }));
    return true;
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

  function pickPortalPlacementX(layerWidthPx, sizePx) {
    if (gapPlacementMode) {
      const occupiedZones = occupiedZonesForGaps(layerWidthPx);
      const cliffMargins = cliffMarginsForPlacement();
      let xPercent = pickTrioScenePlacementX({
        rng: cycleRng,
        layerWidthPx,
        selfSizePx: sizePx,
        occupiedZones,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
        ...cliffMargins,
      });
      if (xPercent == null) {
        xPercent = pickFairGapPlacementX({
          rng: cycleRng,
          layerWidthPx,
          selfSizePx: sizePx,
          occupiedZones,
          minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
          ...cliffMargins,
        });
      }
      return xPercent;
    }

    const cliffMargins = cliffMarginsForPlacement();
    const safe = computeSafeCenterRange(
      layerWidthPx,
      sizePx,
      cliffMargins.cliffLeftPx,
      cliffMargins.cliffRightPx,
      null,
    );
    const r = intersectPlacementRange(safe, { min: PLACE_LEFT_MIN, max: PLACE_LEFT_MAX });
    if (!r) return randRange(cycleRng, 22, 78);
    return randRange(cycleRng, r.min, r.max);
  }

  function schedulePortalSpawn(gapMs = 900) {
    if (destroyed || !centerDevEnabled.portal) return;
    clearTimeout(portalTimer);
    portalTimer = setTimeout(spawnPortal, gapMs);
  }

  /**
   * @returns {boolean}
   */
  function spawnPortal() {
    if (destroyed || !centerDevEnabled.portal || portalTeardown) return false;

    const variant = portalSpawnVariant;
    portalSpawnVariant += 1;
    const baseSeed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    const seed = mixFantasySeed(baseSeed, variant);
    const sizePx = computeSizePx("portal");
    const layerWidthPx = layer.clientWidth || 390;
    const xPercent = pickPortalPlacementX(layerWidthPx, sizePx);

    if (xPercent == null) {
      if (!centerDirectorMode) schedulePortalSpawn(randRange(cycleRng, 800, 1800));
      return false;
    }

    activePortalX = xPercent;
    activePortalSizePx = sizePx;

    const element = generateFantasyElement("portal", { seed });
    if (!element) {
      activePortalX = null;
      activePortalSizePx = 0;
      if (!centerDirectorMode) schedulePortalSpawn(2000);
      return false;
    }

    const baseTiming = planLifecycleTiming(seed, "portal", element.parts.length);
    const timing = devKind === "portal"
      ? { ...baseTiming, holdMs: 16000, erodeMs: 3200, gapMs: 900 }
      : baseTiming;

    portalTeardown = mountFantasyElement(layer, element, baseElementMountOpts({
      xPercent,
      sizePx,
      timing,
      onGone: () => {
        portalTeardown = null;
        activePortalX = null;
        activePortalSizePx = 0;
        onCenterElementGone("portal", timing.gapMs);
      },
    }));
    return true;
  }

  function bootstrapCenterSpawns() {
    if (centerDirectorMode) {
      const initialCount = randRange(cycleRng, 1, CENTER_SCENE_MAX_CONCURRENT);
      const baseGap = 900;
      for (let i = 0; i < initialCount; i += 1) {
        scheduleDirectorSpawn(baseGap + randRange(cycleRng, i * 180, i * 180 + 520));
      }
      return;
    }

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
    if (centerDevEnabled.portal) {
      schedulePortalSpawn(quick ? 0 : 400);
    }
  }

  wallSessionSeed = sessionSeed();
  ensureEdgeWalls(wallSessionSeed);
  if (devKind === "cliffs") {
    const cliffSeed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    startCliffDevMode(cliffSeed);
  } else if (devKind === "portal") {
    spawnPortal();
  } else {
    bootstrapCenterSpawns();
  }

  return {
    relayout() {
      if (destroyed) return;
      forestTeardown?.relayoutGround?.();
      buildingTeardown?.relayoutGround?.();
      crystalsTeardown?.relayoutGround?.();
      portalTeardown?.relayoutGround?.();
      for (const cliff of cliffTeardowns) cliff.relayoutGround?.();
    },
    destroy,
  };
}
