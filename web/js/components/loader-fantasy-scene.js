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
  /** @type {{ destroy: () => void }[]} */
  let cliffTeardowns = [];
  /** @type {{ left: boolean; right: boolean }} */
  const cliffActive = { left: false, right: false };
  let forestTimer = 0;
  let buildingTimer = 0;
  let cycleRng = createRng(sessionSeed());
  let forestSpawnVariant = 0;
  let buildingSpawnVariant = 0;
  let wallSessionSeed = sessionSeed();
  /** @type {import('./loader-fantasy-cliffs.js').CliffFormationType | undefined} */
  let wallFormationType;

  const centerDevEnabled = {
    forest: !devKind || devKind === "forest",
    building: !devKind || devKind === "castle" || devKind === "palace",
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
    if (forestTeardown) {
      forestTeardown.destroy();
      forestTeardown = null;
    }
    if (buildingTeardown) {
      buildingTeardown.destroy();
      buildingTeardown = null;
    }
    for (const td of cliffTeardowns) td.destroy();
    cliffTeardowns = [];
    cliffActive.left = false;
    cliffActive.right = false;
    layer.remove();
  }

  function computeSizePx(kind) {
    const layerH = layer.clientHeight || 200;
    const isCastle = kind === "castle" || kind === "palace";
    const isCliff = kind === "cliffs";
    const isForest = kind === "forest";
    const fracMin = isCastle
      ? CASTLE_HEIGHT_FRAC_MIN
      : isCliff
        ? CLIFF_HEIGHT_FRAC_MIN
        : isForest
          ? FOREST_HEIGHT_FRAC_MIN
          : HEIGHT_FRACTION_MIN;
    const fracMax = isCastle
      ? CASTLE_HEIGHT_FRAC_MAX
      : isCliff
        ? CLIFF_HEIGHT_FRAC_MAX
        : isForest
          ? FOREST_HEIGHT_FRAC_MAX
          : HEIGHT_FRACTION_MAX;
    const frac = randRange(cycleRng, fracMin, fracMax);
    const raw = layerH * frac;
    const minPx = isCliff ? CLIFF_MIN_HEIGHT_PX : isForest ? FOREST_MIN_HEIGHT_PX : MIN_ELEMENT_HEIGHT_PX;
    const maxPx = isCastle
      ? CASTLE_MAX_HEIGHT_PX
      : isCliff
        ? CLIFF_MAX_HEIGHT_PX
        : isForest
          ? FOREST_MAX_HEIGHT_PX
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

  function spawnForest() {
    if (destroyed || !centerDevEnabled.forest || forestTeardown) return;

    const variant = forestSpawnVariant;
    forestSpawnVariant += 1;
    const sizePx = computeSizePx("forest");
    const xPercent = randRange(cycleRng, PLACE_LEFT_MIN, PLACE_LEFT_MAX);
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
    const xPercent = randRange(cycleRng, PLACE_LEFT_MIN, PLACE_LEFT_MAX);
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
        scheduleBuildingSpawn(timing.gapMs);
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
