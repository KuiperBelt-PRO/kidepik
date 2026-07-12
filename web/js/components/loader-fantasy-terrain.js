import { createRng, randRange } from "./loader-ship-rng.js";

export const TERRAIN_SEGMENT_MIN = 10;
export const TERRAIN_SEGMENT_MAX = 18;
export const TERRAIN_CREST_MIN = 0.35;
export const TERRAIN_CREST_MAX = 0.65;
export const TERRAIN_ROUGHNESS_MIN = 0.06;
export const TERRAIN_ROUGHNESS_MAX = 0.22;

/**
 * Cresta máxima del perfil de terreno medida desde el borde inferior del bbox (0..1).
 * @returns {number}
 */
export function maxTerrainCrestFromBottomFrac() {
  return 1 - (TERRAIN_CREST_MIN - TERRAIN_ROUGHNESS_MAX);
}

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
 * Interpola la altura de la cresta del terreno (fracción 0..1 desde el borde superior de la franja).
 * @param {TerrainProfile} profile
 * @param {number} xNorm 0..1
 * @returns {number}
 */
export function sampleTerrainCrestYNorm(profile, xNorm) {
  if (!profile?.length) return 0.5;
  const x = Math.max(0, Math.min(1, xNorm));
  if (x <= profile[0].x) return profile[0].y;
  const last = profile[profile.length - 1];
  if (x >= last.x) return last.y;

  for (let i = 1; i < profile.length; i += 1) {
    const a = profile[i - 1];
    const b = profile[i];
    if (x <= b.x) {
      const t = (x - a.x) / Math.max(1e-6, b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return last.y;
}

/**
 * Offset en px desde el fondo del escenario hasta la cresta del terreno en xPercent.
 * @param {TerrainProfile} profile
 * @param {number} xPercent 0..100
 * @param {number} terrainHeightPx
 * @returns {number}
 */
export function terrainCrestOffsetPx(profile, xPercent, terrainHeightPx) {
  if (!profile?.length || terrainHeightPx <= 0) return 0;
  const yNorm = sampleTerrainCrestYNorm(profile, xPercent / 100);
  return terrainHeightPx * (1 - yNorm);
}

/**
 * X de pantalla (0–100) de un árbol dentro de un bosque centrado en forestXPercent.
 * @param {number} forestXPercent
 * @param {number} pivotXViewBox  0..100 en viewBox del bosque
 * @param {number} forestSizePx
 * @param {number} sceneWidthPx
 * @returns {number}
 */
export function computeTreeScreenXPercent(forestXPercent, pivotXViewBox, forestSizePx, sceneWidthPx) {
  if (!sceneWidthPx) return forestXPercent;
  const offsetPercent = ((pivotXViewBox - 50) / 100) * (forestSizePx / sceneWidthPx) * 100;
  return Math.max(0, Math.min(100, forestXPercent + offsetPercent));
}

/**
 * Desplazamiento SVG (unidades viewBox 0–100) para apoyar el árbol en la cresta del terreno.
 * @param {TerrainProfile} profile
 * @param {number} forestXPercent
 * @param {number} pivotXViewBox
 * @param {number} pivotYViewBox  base del árbol en viewBox (mayor y = más abajo)
 * @param {number} forestSizePx
 * @param {number} sceneWidthPx
 * @param {number} terrainHeightPx
 * @returns {number}
 */
export function computeTreeTerrainLiftSvg(
  profile,
  forestXPercent,
  pivotXViewBox,
  pivotYViewBox,
  forestSizePx,
  sceneWidthPx,
  terrainHeightPx,
) {
  if (!profile?.length || forestSizePx <= 0 || terrainHeightPx <= 0) return 0;
  const treeX = computeTreeScreenXPercent(forestXPercent, pivotXViewBox, forestSizePx, sceneWidthPx);
  const targetFromBottomPx = terrainCrestOffsetPx(profile, treeX, terrainHeightPx);
  const currentFromBottomPx = ((100 - pivotYViewBox) / 100) * forestSizePx;
  const liftPx = targetFromBottomPx - currentFromBottomPx;
  return (liftPx / forestSizePx) * 100;
}

/**
 * Desplazamiento SVG para apoyar un elemento centrado en la cresta del terreno.
 * @param {TerrainProfile} profile
 * @param {number} xPercent 0..100 en escena
 * @param {number} footYViewBox coordenada y del suelo del elemento en viewBox (mayor = más abajo)
 * @param {number} sizePx tamaño CSS del SVG
 * @param {number} terrainHeightPx
 * @returns {number}
 */
export function computeElementTerrainLiftSvg(
  profile,
  xPercent,
  footYViewBox,
  sizePx,
  terrainHeightPx,
) {
  if (!profile?.length || sizePx <= 0 || terrainHeightPx <= 0) return 0;
  const targetFromBottomPx = terrainCrestOffsetPx(profile, xPercent, terrainHeightPx);
  const currentFromBottomPx = ((100 - footYViewBox) / 100) * sizePx;
  const liftPx = targetFromBottomPx - currentFromBottomPx;
  return (liftPx / sizePx) * 100;
}

/**
 * Offset CSS `bottom` para apoyar un portal (pies + FX) en la cresta del terreno.
 * @param {TerrainProfile} profile
 * @param {number} xPercent
 * @param {number} footYViewBox
 * @param {number} sizePx
 * @param {number} terrainHeightPx
 * @returns {number}
 */
export function computePortalGroundBottomPx(
  profile,
  xPercent,
  footYViewBox,
  sizePx,
  terrainHeightPx,
) {
  if (!profile?.length || sizePx <= 0 || terrainHeightPx <= 0) return 0;
  const crestPx = terrainCrestOffsetPx(profile, xPercent, terrainHeightPx);
  const footInsetPx = ((100 - footYViewBox) / 100) * sizePx;
  const embedPx = Math.min(5, terrainHeightPx * 0.08);
  return Math.max(0, crestPx - footInsetPx - embedPx);
}

/**
 * Altura real en px de la capa de terreno (o fallback CSS).
 * @param {ParentNode} [layersRoot]
 * @returns {number}
 */
export function measureFantasyTerrainHeightPx(layersRoot) {
  const root = layersRoot ?? document;
  const terrainLayer = root.querySelector?.(".loader-layer--fantasy-terrain");
  if (terrainLayer?.clientHeight) return terrainLayer.clientHeight;
  const sceneLayer = root.querySelector?.(".loader-layer--fantasy-scene");
  const fromScene = sceneLayer
    && parseFloat(getComputedStyle(sceneLayer).getPropertyValue("--fantasy-terrain-h"));
  if (fromScene) return fromScene;
  const fromDoc = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fantasy-terrain-h"));
  return fromDoc || 48;
}

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
    profile,
    destroy() {
      destroyed = true;
      ro?.disconnect();
      if (!ro) window.removeEventListener("resize", layoutTerrain);
      layer.remove();
    },
  };
}
