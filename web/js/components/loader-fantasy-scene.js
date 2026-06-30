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
import { mountFantasyElement } from "./loader-fantasy-render.js";
import { createRng, randRange } from "./loader-ship-rng.js";

// Zona horizontal prohibida (% del ancho) para evitar el logo central.
// En Phase 0 no aplicamos exclusión central porque los elementos no llegan tan alto.
const PLACE_LEFT_MIN = 8;
const PLACE_LEFT_MAX = 92;

// Fracción de la altura del contenedor de la escena que puede ocupar un elemento.
// Mantiene los elementos pequeños y lejos del anillo del logo.
const HEIGHT_FRACTION_MIN = 0.18;
const HEIGHT_FRACTION_MAX = 0.34;

// Límites de altura del elemento en px.
const MIN_ELEMENT_HEIGHT_PX = 60;
const MAX_ELEMENT_HEIGHT_PX = 150;

// Castillos/palacios: perspectiva un poco más lejana (todas las facciones).
const CASTLE_HEIGHT_FRAC_MIN = 0.23;
const CASTLE_HEIGHT_FRAC_MAX = 0.4;
const CASTLE_MAX_HEIGHT_PX = 168;

// Semilla de sesión para posiciones aleatorias distintas en cada carga.
let _sessionSeedCounter = Date.now() & 0x7fffffff;

function sessionSeed() {
  _sessionSeedCounter = (_sessionSeedCounter * 1664525 + 1013904223) & 0x7fffffff;
  return _sessionSeedCounter;
}

/**
 * Monta el director de escena de fantasía dentro del `container`.
 *
 * @param {HTMLElement} container  elemento padre (loader-layers o similar)
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
  let nextTimer = 0;
  let cycleRng = createRng(sessionSeed());

  function destroy() {
    destroyed = true;
    clearTimeout(nextTimer);
    if (currentTeardown) {
      currentTeardown.destroy();
      currentTeardown = null;
    }
    layer.remove();
  }

  function computeSizePx(kind) {
    const layerH = layer.clientHeight || 200;
    const isCastle = kind === "castle" || kind === "palace";
    const fracMin = isCastle ? CASTLE_HEIGHT_FRAC_MIN : HEIGHT_FRACTION_MIN;
    const fracMax = isCastle ? CASTLE_HEIGHT_FRAC_MAX : HEIGHT_FRACTION_MAX;
    const frac = randRange(cycleRng, fracMin, fracMax);
    const raw = layerH * frac;
    const maxPx = isCastle ? CASTLE_MAX_HEIGHT_PX : MAX_ELEMENT_HEIGHT_PX;
    return Math.max(MIN_ELEMENT_HEIGHT_PX, Math.min(maxPx, raw));
  }

  function scheduleNext(gapMs = 0) {
    if (destroyed) return;
    nextTimer = setTimeout(runCycle, gapMs);
  }

  function runCycle() {
    if (destroyed) return;

    // Phase 1: castillos y palacios. devKind (?fantasyDev=) fuerza un tipo.
    const kind = /** @type {import('./loader-fantasy-element.js').FantasyKind} */ (
      devKind || (cycleRng() < 0.32 ? "palace" : "castle")
    );
    const seed = Number.isFinite(devSeed) ? (devSeed >>> 0) : sessionSeed();
    const sizePx = computeSizePx(kind);
    const element = generateFantasyElement(kind, {
      seed,
      faction: devFaction,
      terrainHeightPx,
      castleSizePx: sizePx,
    });
    if (!element) {
      scheduleNext(2000);
      return;
    }

    // Tiempos: en devMode acelera el hold para ciclar rápido
    const baseTiming = planLifecycleTiming(seed, kind, element.parts.length);
    const timing = devKind || devFaction
      ? { ...baseTiming, holdMs: 2200, gapMs: 500 }
      : baseTiming;

    // Posición horizontal aleatoria (evitando el centro con margen si hay muchos elementos)
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

  // Arranca tras una breve pausa inicial para que el loader esté visible
  scheduleNext(devKind || devFaction ? 200 : 900);

  return { destroy };
}
