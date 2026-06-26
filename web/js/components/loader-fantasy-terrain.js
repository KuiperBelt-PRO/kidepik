import { createRng, randRange } from "./loader-ship-rng.js";

export const TERRAIN_SEGMENT_MIN = 10;
export const TERRAIN_SEGMENT_MAX = 18;
export const TERRAIN_CREST_MIN = 0.35;
export const TERRAIN_CREST_MAX = 0.65;
export const TERRAIN_ROUGHNESS_MIN = 0.06;
export const TERRAIN_ROUGHNESS_MAX = 0.22;

/**
 * @param {() => number} rng
 * @returns {number}
 */
export function planTerrainSegmentCount(rng) {
  const span = TERRAIN_SEGMENT_MAX - TERRAIN_SEGMENT_MIN + 1;
  return TERRAIN_SEGMENT_MIN + Math.floor(rng() * span);
}

/**
 * @param {number} value
 * @returns {string}
 */
function fmt(value) {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** @typedef {{ x: number; y: number }[]} TerrainProfile */

/**
 * Perfil normalizado (0–1) del borde superior del suelo.
 * @param {() => number} rng
 * @returns {TerrainProfile}
 */
export function buildTerrainProfile(rng) {
  const segments = planTerrainSegmentCount(rng);
  const crestY = randRange(rng, TERRAIN_CREST_MIN, TERRAIN_CREST_MAX);
  const roughness = randRange(rng, TERRAIN_ROUGHNESS_MIN, TERRAIN_ROUGHNESS_MAX);

  /** @type {TerrainProfile} */
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    points.push({
      x: i / segments,
      y: crestY + randRange(rng, -roughness, roughness),
    });
  }
  return points;
}

/**
 * Silueta de suelo llano con borde superior irregular.
 * @param {number} width
 * @param {number} bandHeight
 * @param {TerrainProfile} profile
 * @returns {string}
 */
export function buildTerrainPath(width, bandHeight, profile) {
  if (width <= 0 || bandHeight <= 0 || profile.length === 0) return "";

  const points = profile.map((p) => ({
    x: p.x * width,
    y: p.y * bandHeight,
  }));

  let d = `M 0 ${fmt(bandHeight)} L 0 ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  d += ` L ${fmt(width)} ${fmt(bandHeight)} Z`;
  return d;
}

/**
 * @returns {number}
 */
function sessionTerrainSeed() {
  return ((Date.now() >>> 0) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Suelo procedural blanco en la base de la mitad fantasía.
 * @param {HTMLElement} container
 * @param {{ rng?: () => number }} [options]
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyTerrainLayer(container, { rng } = {}) {
  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--fantasy-terrain";
  layer.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "loader-fantasy-terrain__svg");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "loader-fantasy-terrain__fill");
  svg.appendChild(path);
  layer.appendChild(svg);
  container.appendChild(layer);

  const random = rng ?? createRng(sessionTerrainSeed());
  const profile = buildTerrainProfile(random);
  let destroyed = false;

  function layoutTerrain() {
    if (destroyed) return;
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    if (!w || !h) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    path.setAttribute("d", buildTerrainPath(w, h, profile));
  }

  layoutTerrain();

  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => layoutTerrain())
      : null;
  ro?.observe(layer);

  if (!ro) {
    window.addEventListener("resize", layoutTerrain);
  }

  return {
    destroy() {
      destroyed = true;
      ro?.disconnect();
      if (!ro) window.removeEventListener("resize", layoutTerrain);
      layer.remove();
    },
  };
}
