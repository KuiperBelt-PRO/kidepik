/**
 * Utilidades compartidas para montar capas del mundo (loader + legal).
 * @module loader-world-utils
 */

import { parseDevFaction } from "./loader-fantasy-castle-factions.js";
import { parseBackdropKind } from "./loader-fantasy-backdrop.js";
import { assetUrl } from "../lib/assets.manifest.js";

/**
 * @param {string} src
 * @returns {Promise<boolean>}
 */
export function probeImage(src) {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(true);
    probe.onerror = () => resolve(false);
    probe.src = src;
  });
}

/**
 * @param {HTMLElement} layer
 * @param {string} slotId
 * @param {{ fit?: "cover" | "contain"; onLoad?: () => void; onError?: () => void }} [options]
 * @returns {Promise<boolean>}
 */
export async function mountOptionalImage(layer, slotId, options = {}) {
  const { fit = "cover", onLoad, onError } = options;
  const src = assetUrl(slotId);
  if (!src) return false;

  const img = document.createElement("img");
  img.className = "loader-layer__img";
  img.alt = "";
  img.decoding = "async";
  img.style.objectFit = fit;

  const loaded = await new Promise((resolve) => {
    img.addEventListener("load", () => { onLoad?.(); resolve(true); }, { once: true });
    img.addEventListener("error", () => { onError?.(); resolve(false); }, { once: true });
    img.src = src;
  });

  if (!loaded) return false;
  layer.appendChild(img);
  return true;
}

/**
 * Lee flags de depuración compartidos por loader-chrome y world-layers.
 * @param {URLSearchParams} [query]
 */
export function parseWorldLayerQuery(query = new URLSearchParams()) {
  const meteorDemo = query.get("meteorDemo") === "1";
  const cloudDemo = query.get("cloudDemo") === "1";
  const celestialDemo = query.get("celestialDemo") === "1";
  const backdropKind = parseBackdropKind(query.get("backdropKind"));
  const fantasyDev = query.get("fantasyDev") || undefined;
  const fantasyFaction = parseDevFaction(query.get("fantasyFaction"));
  const fantasySeedRaw = query.get("fantasySeed");
  const fantasySeed = fantasySeedRaw != null && fantasySeedRaw !== ""
    ? Number.parseInt(fantasySeedRaw, 10)
    : undefined;
  const fantasyFormationRaw = query.get("fantasyFormation");
  const fantasyFormation = fantasyFormationRaw === "cliff" || fantasyFormationRaw === "rocks"
    ? fantasyFormationRaw
    : undefined;
  const fxIntensityRaw = query.get("fxIntensity");
  const fxIntensityParsed = fxIntensityRaw != null && fxIntensityRaw !== ""
    ? Number.parseFloat(fxIntensityRaw)
    : NaN;
  const fxIntensity = Number.isFinite(fxIntensityParsed) ? fxIntensityParsed : 1;
  const fxEnabled = query.get("fxDev") !== "0";

  return {
    meteorDemo,
    cloudDemo,
    celestialDemo,
    backdropKind,
    fantasyDev,
    fantasyFaction,
    fantasySeed: Number.isFinite(fantasySeed) ? fantasySeed : undefined,
    fantasyFormation,
    fxIntensity,
    fxEnabled,
  };
}
