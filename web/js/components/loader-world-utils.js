/**
 * Utilidades compartidas para montar capas del mundo (loader + legal).
 * @module loader-world-utils
 */

import { parseDevFaction } from "./loader-fantasy-castle-factions.js";
import { parseBackdropKind } from "./loader-fantasy-backdrop.js";
import { assetUrl } from "../lib/assets.manifest.js";

/**
 * Lee query params del loader desde `?…` o desde `#/loader?…` (ambos formatos).
 * @returns {URLSearchParams}
 */
export function getLoaderQueryParams() {
  const fromSearch = new URLSearchParams(window.location.search);
  if ([...fromSearch.keys()].length > 0) return fromSearch;
  const hash = window.location.hash || "";
  const q = hash.indexOf("?");
  if (q >= 0) return new URLSearchParams(hash.slice(q + 1));
  return fromSearch;
}

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
 * Flags de depuración del loader / world layers.
 *
 * | Param | Efecto |
 * | --- | --- |
 * | `gateDemo=1` | Anillo de progreso acelerado (~800 ms) |
 * | `meteorDemo=1` | Ráfaga de meteoritos inmediata |
 * | `cloudDemo=1` / `celestialDemo=1` | Nubes / cielo en modo rápido |
 * | `backdropKind=` | Tipo de horizonte (ver `parseBackdropKind`) |
 * | `fantasyDev=` | Fuerza un kind de elemento fantasy |
 * | `fantasyFaction=` | human \| elf \| dwarf |
 * | `fantasySeed=` | Seed entera |
 * | `fantasyFormation=` | cliff \| rocks |
 * | `fxDev=0` | Desactiva FX anclados |
 * | `fxIntensity=` | Escala 0–n de intensidad FX |
 *
 * @param {URLSearchParams} [query]
 */
export function parseWorldLayerQuery(query = new URLSearchParams()) {
  const gateDemo = query.get("gateDemo") === "1";
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
    gateDemo,
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
