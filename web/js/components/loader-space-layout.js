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
 * Centro Y del ancla orbital en coords de la capa (px desde arriba).
 * Interpola suavemente al comprimir la banda en legal (evita salto de la órbita «main»).
 * @param {HTMLElement} layer
 */
export function measureOrbitLogoCenterY(layer) {
  const layerRect = layer.getBoundingClientRect();
  const layerH = layerRect.height;
  if (!layerH) return 0;

  const scene = layer.closest(".scene-loader, .scene-legal");
  if (!scene) return layerH * DEFAULT_ORBIT_ANCHOR_FRAC;

  if (!layer.dataset.orbitAnchorFrac) {
    const focal = scene.querySelector(".loader-focal");
    if (focal instanceof HTMLElement) {
      const focalRect = focal.getBoundingClientRect();
      const y = focalRect.top + focalRect.height / 2 - layerRect.top;
      if (y > 0) {
        layer.dataset.orbitAnchorFrac = String(y / layerH);
      }
    }
  }

  const loaderAnchorFrac = Number.parseFloat(
    layer.dataset.orbitAnchorFrac || String(DEFAULT_ORBIT_ANCHOR_FRAC),
  );

  if (!scene.classList.contains("scene-legal")) {
    return layerH * loaderAnchorFrac;
  }

  const bandFracRaw = getComputedStyle(scene).getPropertyValue("--legal-space-band-frac").trim();
  const bandFrac = Number.parseFloat(bandFracRaw) || LOADER_SPACE_BAND_FRACTION;
  const span = LOADER_SPACE_BAND_FRACTION - LEGAL_SPACE_BAND_FRACTION;
  const t = span > 0
    ? Math.min(1, Math.max(0, (LOADER_SPACE_BAND_FRACTION - bandFrac) / span))
    : 0;
  const anchorFrac = loaderAnchorFrac + (LEGAL_ORBIT_ANCHOR_FRAC - loaderAnchorFrac) * t;
  return layerH * anchorFrac;
}
