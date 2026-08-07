/**
 * Escala de layout para la franja espacial (loader vs legal compacto).
 * @module loader-space-layout
 */

/** Fracción de altura del viewport que ocupa la banda espacial en el loader. */
export const LOADER_SPACE_BAND_FRACTION = 0.48;

/** Fracción de banda espacial en legal (comprimida). */
export const LEGAL_SPACE_BAND_FRACTION = 0.24;

/** Ancla orbital por defecto (fracción de la altura de la banda). */
const DEFAULT_ORBIT_ANCHOR_FRAC = 0.62;

/** Ancla en legal: borde inferior de la franja (encima del logo). */
const LEGAL_ORBIT_ANCHOR_FRAC = 0.92;

/** Centro vertical por defecto del logo respecto a la escena (loader home/auth). */
const DEFAULT_SCENE_ANCHOR_FRAC = 0.5;

/**
 * @param {HTMLElement} layer
 * @param {'loader' | 'legal'} [layout]
 * @returns {number}
 */
export function computeSpaceLayoutScale(layer, layout = "loader") {
  if (layout !== "legal") return 1;
  const scene = layer.closest(".scene-loader, .scene-legal");
  const sceneH = scene?.clientHeight ?? window.innerHeight;
  const styleH = parseFloat(getComputedStyle(layer).height);
  const layerH = Number.isFinite(styleH) && styleH > 0 ? styleH : layer.clientHeight;
  const refH = sceneH * LOADER_SPACE_BAND_FRACTION;
  if (!layerH || !refH) return 1;
  return layerH / refH;
}

/**
 * @param {Record<string, unknown>} spec
 * @param {number} scale
 * @param {{ planetMultiplier?: number }} [options]
 * @returns {Record<string, unknown>}
 */
export function scaleOrbitSystemSpec(spec, scale, { planetMultiplier = 1 } = {}) {
  if (scale >= 0.999 && planetMultiplier <= 1.001) return spec;

  /** @type {Record<string, unknown>} */
  const out = { ...spec };
  const pxFields = [
    "entryAboveLogo",
    "exitAboveLogo",
    "blockRaisePx",
    "edgePad",
    "entryY",
    "exitY",
    "entryXPad",
    "exitXPad",
    "blockOffsetY",
    "bulgeY",
  ];

  for (const key of pxFields) {
    if (typeof out[key] === "number") {
      out[key] = /** @type {number} */ (out[key]) * scale;
    }
  }

  if (typeof out.planet === "number") {
    out.planet = /** @type {number} */ (out.planet) * scale * planetMultiplier;
  }

  if (Array.isArray(out.moonBands)) {
    const clusterScale = scale * planetMultiplier;
    out.moonBands = out.moonBands.map((band) => {
      const row = /** @type {{ orbitR: number; dur: number; moons: { size: number; phase: number }[] }} */ (band);
      return {
        ...row,
        orbitR: row.orbitR * clusterScale,
        moons: row.moons.map((moon) => ({
          ...moon,
          size: moon.size * clusterScale,
        })),
      };
    });
  }

  return out;
}

/**
 * @param {{ size: number; parallelOffset: number } & Record<string, unknown>} spec
 * @param {number} scale
 */
export function scaleShipFlightSpec(spec, scale) {
  if (scale >= 0.999) return spec;
  return {
    ...spec,
    size: spec.size * scale,
    parallelOffset: spec.parallelOffset * scale,
  };
}

/**
 * @param {HTMLElement} scene
 * @param {DOMRect} layerRect
 * @returns {number | null}
 */
function measureLiveAnchorY(scene, layerRect) {
  if (scene.classList.contains("is-section-compact")) return null;

  const anchorEl = scene.querySelector(
    ".loader-auth-brand .loader-logo-wrap, .loader-focal .loader-logo-wrap, .loader-focal",
  );
  if (!(anchorEl instanceof HTMLElement)) return null;

  const anchorRect = anchorEl.getBoundingClientRect();
  if (anchorRect.width <= 0 && anchorRect.height <= 0) return null;

  const y = anchorRect.top + anchorRect.height / 2 - layerRect.top;
  return y > 0 ? y : null;
}

/**
 * Referencia estable del ancla en coords de capa (px), medida con bandas expandidas.
 * @param {HTMLElement} layer
 * @param {HTMLElement} scene
 * @param {number | null} liveY
 */
function cacheExpandedAnchorY(layer, scene, liveY) {
  if (
    liveY == null
    || !scene.classList.contains("is-world-band-loader")
    || scene.classList.contains("is-section-compact")
  ) {
    return;
  }
  layer.dataset.orbitAnchorExpandedY = String(liveY);
}

/**
 * @param {HTMLElement} layer
 * @param {HTMLElement} scene
 * @returns {number}
 */
function readExpandedAnchorY(layer, scene) {
  const cached = Number.parseFloat(layer.dataset.orbitAnchorExpandedY || "");
  if (Number.isFinite(cached) && cached > 0) return cached;

  // Migrar caché antigua (fracción de banda) si parece válida.
  const legacyFrac = Number.parseFloat(layer.dataset.orbitAnchorFrac || "");
  if (Number.isFinite(legacyFrac) && legacyFrac > 0) {
    const sceneH = scene.clientHeight || window.innerHeight;
    const legacyY = sceneH * LOADER_SPACE_BAND_FRACTION * legacyFrac;
    const sceneFrac = legacyY / Math.max(sceneH, 1);
    if (sceneFrac >= 0.35 && sceneFrac <= 0.65) {
      layer.dataset.orbitAnchorExpandedY = String(legacyY);
      delete layer.dataset.orbitAnchorFrac;
      return legacyY;
    }
    delete layer.dataset.orbitAnchorFrac;
  }

  const sceneH = scene.clientHeight || window.innerHeight;
  return sceneH * DEFAULT_SCENE_ANCHOR_FRAC;
}

/**
 * Centro Y del ancla orbital en coords de la capa (px desde arriba).
 * El logo vive en el centro de la escena; al comprimir/expandir bandas su Y en
 * viewport es estable y no debe escalarse como fracción de la altura actual de capa.
 * @param {HTMLElement} layer
 */
export function measureOrbitLogoCenterY(layer) {
  const layerRect = layer.getBoundingClientRect();
  const layerH = layerRect.height;
  if (!layerH) return 0;

  const scene = layer.closest(".scene-loader, .scene-legal");
  if (!scene) return layerH * DEFAULT_ORBIT_ANCHOR_FRAC;

  const liveY = measureLiveAnchorY(scene, layerRect);
  cacheExpandedAnchorY(layer, scene, liveY);
  const expandedY = readExpandedAnchorY(layer, scene);

  if (!scene.classList.contains("scene-legal")) {
    if (liveY != null) return liveY;
    return expandedY;
  }

  const bandFracRaw = getComputedStyle(scene).getPropertyValue("--legal-space-band-frac").trim();
  const bandFrac = Number.parseFloat(bandFracRaw) || LOADER_SPACE_BAND_FRACTION;
  const span = LOADER_SPACE_BAND_FRACTION - LEGAL_SPACE_BAND_FRACTION;
  const t = span > 0
    ? Math.min(1, Math.max(0, (LOADER_SPACE_BAND_FRACTION - bandFrac) / span))
    : 0;
  const legalY = layerH * LEGAL_ORBIT_ANCHOR_FRAC;
  return expandedY + (legalY - expandedY) * t;
}

/**
 * Altura coherente de la capa orbital (CSS + fallback) para viewBox y posicionamiento.
 * @param {HTMLElement} layer
 */
export function resolveOrbitLayerHeight(layer) {
  const styleH = parseFloat(getComputedStyle(layer).height);
  const rect = layer.getBoundingClientRect();
  return Number.isFinite(styleH) && styleH > 0 ? styleH : rect.height;
}
