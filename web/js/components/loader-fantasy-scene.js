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
import { planCliffSides } from "./loader-fantasy-cliffs.js";
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

// Muros laterales (~50 % del tamaño anterior; costura en x 0 % / 100 %).
const CLIFF_HEIGHT_FRAC_MIN = 0.17;
const CLIFF_HEIGHT_FRAC_MAX = 0.28;
const CLIFF_MIN_HEIGHT_PX = 30;
const CLIFF_MAX_HEIGHT_PX = 94;

let _sessionSeedCounter = Date.now() & 0x7fffffff;

function sessionSeed() {
  _sessionSeedCounter = (_sessionSeedCounter * 1664525 + 1013904223) & 0x7fffffff;
  return _sessionSeedCounter;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   reducedMotion?: boolean;
 *   terrainHeightPx?: number;
 *   devKind?: string;
 *   devFaction?: import('./loader-fantasy-castle-factions.js').CastleFaction;
 *   devSeed?: number;
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
  } = opts;

  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--fantasy-scene";
  layer.setAttribute("aria-hidden", "true");
  container.appendChild(layer);

  let destroyed = false;
  let currentTeardown = /** @type {{ destroy: () => void } | null} */ (null);
  /** @type {{ destroy: () => void }[]} */
  let cliffTeardowns = [];
  /** @type {{ left: boolean; right: boolean }} */
  const cliffActive = { left: false, right: false };
  let nextTimer = 0;
  let cycleRng = createRng(sessionSeed());
  let spawnVariant = 0;
  let wallSessionSeed = sessionSeed();

  function destroy() {
    destroyed = true;
    clearTimeout(nextTimer);
    if (currentTeardown) {
      currentTeardown.destroy();
      currentTeardown = null;
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
    const fracMin = isCastle
      ? CASTLE_HEIGHT_FRAC_MIN
      : isCliff
        ? CLIFF_HEIGHT_FRAC_MIN
        : HEIGHT_FRACTION_MIN;
    const fracMax = isCastle
      ? CASTLE_HEIGHT_FRAC_MAX
      : isCliff
        ? CLIFF_HEIGHT_FRAC_MAX
        : HEIGHT_FRACTION_MAX;
    const frac = randRange(cycleRng, fracMin, fracMax);
    const raw = layerH * frac;
    const minPx = isCliff ? CLIFF_MIN_HEIGHT_PX : MIN_ELEMENT_HEIGHT_PX;
    const maxPx = isCastle
      ? CASTLE_MAX_HEIGHT_PX
      : isCliff
        ? CLIFF_MAX_HEIGHT_PX
        : MAX_ELEMENT_HEIGHT_PX;
    return Math.max(minPx, Math.min(maxPx, raw));
  }

  /**
   * Una sola formación por extremo; no respawn si ya hay muro activo en ese lado.
   * @param {'left' | 'right'} side
   * @param {number} [cycleSeed]
   */
  function spawnCliffWall(side, cycleSeed = wallSessionSeed) {
    if (destroyed || cliffActive[side]) return;

    const cliffSeed = mixFantasySeed(cycleSeed, side === "left" ? 0x10 : 0x20);
    const sizePx = computeSizePx("cliffs");
    const element = generateFantasyElement("cliffs", {
      seed: cliffSeed,
      side,
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
      timing: devTiming,
      onGone: () => {
        cliffActive[side] = false;
        cliffTeardowns = cliffTeardowns.filter((t) => t !== teardown);
        if (devKind === "cliffs") {
          if (!cliffActive.left && !cliffActive.right) scheduleNext(devTiming.gapMs);
          return;
        }
        spawnCliffWall(side, sessionSeed());
      },
    });
    cliffTeardowns.push(teardown);
  }

  /** Mantiene exactamente un muro por borde cuando procede. */
  function ensureEdgeWalls(cycleSeed = wallSessionSeed) {
    if (devKind === "cliffs") return;
    for (const side of planCliffSides(cycleSeed).sides) {
      spawnCliffWall(side, cycleSeed);
    }
  }

  function scheduleNext(gapMs = 0) {
    if (destroyed) return;
    nextTimer = setTimeout(runCycle, gapMs);
  }

  function runCycle() {
    if (destroyed) return;

    if (currentTeardown) {
      currentTeardown.destroy();
      currentTeardown = null;
    }

    const kind = /** @type {import('./loader-fantasy-element.js').FantasyKind} */ (
      devKind || (cycleRng() < 0.32 ? "palace" : "castle")
    );
    const seed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();

    if (kind === "cliffs") {
      wallSessionSeed = seed;
      for (const side of planCliffSides(seed).sides) {
        spawnCliffWall(side, seed);
      }
      if (!cliffActive.left && !cliffActive.right) scheduleNext(2000);
      return;
    }

    const faction = devFaction ?? pickFaction(cycleRng, kind === "palace");
    const variant = spawnVariant;
    spawnVariant += 1;
    const sizePx = computeSizePx(kind);
    const element = generateFantasyElement(kind, {
      seed,
      variant,
      faction,
      terrainHeightPx,
      castleSizePx: sizePx,
    });
    if (!element) {
      scheduleNext(2000);
      return;
    }

    const baseTiming = planLifecycleTiming(seed, kind, element.parts.length);
    const timing = devKind || devFaction
      ? { ...baseTiming, holdMs: 2200, gapMs: 500 }
      : baseTiming;

    const xPercent = randRange(cycleRng, PLACE_LEFT_MIN, PLACE_LEFT_MAX);

    currentTeardown = mountFantasyElement(layer, element, {
      reducedMotion,
      xPercent,
      sizePx,
      terrainHeightPx,
      timing,
      onGone: () => {
        currentTeardown = null;
        scheduleNext(timing.gapMs);
      },
    });
  }

  wallSessionSeed = sessionSeed();
  ensureEdgeWalls(wallSessionSeed);
  scheduleNext(devKind || devFaction ? 200 : 900);

  return { destroy };
}
