import { subscribeLoaderAnimationFrame } from "./loader-animation-frame.js";
import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {'sun' | 'moon'} CelestialKind */

/** @typedef {{
 *   id: number;
 *   xFrac: number;
 *   yFrac: number;
 *   r: number;
 *   opacity: number;
 * }} StarPoint */

/** @typedef {{
 *   kind: CelestialKind;
 *   bodyPx: number;
 *   durationMs: number;
 *   horizonFrac: number;
 *   apexFrac: number;
 *   moonPhase?: number;
 * }} CelestialTransitParams */

export const MOON_PHASE_COUNT = 2;
export const MOON_PHASE_NAMES = [
  "waxing-crescent",
  "waning-crescent",
];

export const CELESTIAL_ARC_DURATION_MIN_MS = 22000;
export const CELESTIAL_ARC_DURATION_MAX_MS = 32000;
export const CELESTIAL_GAP_MIN_MS = 800;
export const CELESTIAL_GAP_MAX_MS = 2000;
export const CELESTIAL_INITIAL_DELAY_MIN_MS = 4000;
export const CELESTIAL_INITIAL_DELAY_MAX_MS = 7000;

const STAR_COUNT_MIN = 24;
const STAR_COUNT_MAX = 38;

/** Sol/luna: +70 % respecto al tamaño base (36–44 / 32–40 px). */
const SUN_BODY_PX_MIN = 61;
const SUN_BODY_PX_MAX = 75;
const MOON_BODY_PX_MIN = 54;
const MOON_BODY_PX_MAX = 68;

/** Estrellas: −55 % tamaño, menor opacidad, banda más amplia. */
const STAR_R_MIN = 0.32;
const STAR_R_MAX = 0.95;
const STAR_Y_FRAC_MIN = 0.22;
const STAR_Y_FRAC_MAX = 0.65;
const STAR_OPACITY_MIN = 0.2;
const STAR_OPACITY_MAX = 0.5;

/**
 * @param {number} n
 * @returns {number}
 */
function fmt(n) {
  return Math.round(n * 10) / 10;
}

/**
 * @param {number} phaseIndex
 * @returns {number}
 */
export function nextMoonPhaseIndex(phaseIndex) {
  return (phaseIndex + 1) % MOON_PHASE_COUNT;
}

/**
 * @param {number} t 0..1
 * @returns {number}
 */
export function celestialOpacityAt(t) {
  if (t <= 0) return 0;
  if (t < 0.07) return t / 0.07;
  if (t > 0.9) return Math.max(0, (1 - t) / 0.1);
  return 1;
}

/**
 * Arco parabólico este→oeste: X lineal (velocidad horizontal constante), Y parabólica.
 * @param {number} t
 * @param {number} layerW
 * @param {number} layerH
 * @param {{ horizonFrac?: number; apexFrac?: number }} [opts]
 * @returns {{ x: number; y: number; opacity: number }}
 */
export function celestialArcPoseAt(t, layerW, layerH, opts = {}) {
  const horizonFrac = opts.horizonFrac ?? 0.75;
  const apexFrac = opts.apexFrac ?? 0.22;

  const x0 = layerW * 1.1;
  const x1 = layerW * -0.1;
  const x = x0 + (x1 - x0) * t;

  const yHorizon = layerH * horizonFrac;
  const yApex = layerH * apexFrac;
  const y = yHorizon + (yApex - yHorizon) * 4 * t * (1 - t);

  return { x, y, opacity: celestialOpacityAt(t) };
}

/**
 * Empuja el centro del astro fuera del disco del logo central.
 * @param {number} x
 * @param {number} y
 * @param {number} layerW
 * @param {number} layerH
 * @param {number} bodyRadiusPx
 * @returns {{ x: number; y: number }}
 */
export function constrainOutsideLogo(x, y, layerW, layerH, bodyRadiusPx) {
  const logoCx = layerW * 0.5;
  const logoCy = layerH * 0.06;
  const logoR = layerW * 0.34;
  const dx = x - logoCx;
  const dy = y - logoCy;
  const dist = Math.hypot(dx, dy);
  const minDist = logoR + bodyRadiusPx;
  if (dist >= minDist) return { x, y };
  if (dist < 1e-6) {
    return { x: logoCx + minDist, y: logoCy };
  }
  const scale = minDist / dist;
  return { x: logoCx + dx * scale, y: logoCy + dy * scale };
}

/** Sombra en máscara (×r desde cx): creciente / menguante — sombra muy superpuesta. */
const MOON_SHADOW_X_FRAC = [-0.68, 0.68];

/**
 * Centro X del círculo sombra en máscara lunar (negro oculta, blanco revela).
 * @param {number} phaseIndex 0..1
 * @param {number} cx
 * @param {number} r
 * @returns {number}
 */
export function moonShadowMaskCx(phaseIndex, cx, r) {
  const phase = ((phaseIndex % MOON_PHASE_COUNT) + MOON_PHASE_COUNT) % MOON_PHASE_COUNT;
  return cx + MOON_SHADOW_X_FRAC[phase] * r;
}

/** @deprecated Usar moonShadowMaskCx — alias para tests heredados */
export function moonShadowOffsetX(phaseIndex, r) {
  return moonShadowMaskCx(phaseIndex, 50, r) - 50;
}

/**
 * Estrella de 4 puntas (viewBox local).
 * @param {number} cx
 * @param {number} cy
 * @param {number} outerR
 * @param {number} [innerRatio]
 * @returns {string}
 */
export function star4PathD(cx, cy, outerR, innerRatio = 0.34) {
  const ir = outerR * innerRatio;
  return [
    `M ${fmt(cx)} ${fmt(cy - outerR)}`,
    `L ${fmt(cx + ir)} ${fmt(cy - ir)}`,
    `L ${fmt(cx + outerR)} ${fmt(cy)}`,
    `L ${fmt(cx + ir)} ${fmt(cy + ir)}`,
    `L ${fmt(cx)} ${fmt(cy + outerR)}`,
    `L ${fmt(cx - ir)} ${fmt(cy + ir)}`,
    `L ${fmt(cx - outerR)} ${fmt(cy)}`,
    `L ${fmt(cx - ir)} ${fmt(cy - ir)}`,
    "Z",
  ].join(" ");
}

/**
 * @param {() => number} rng
 * @returns {{ mainCount: number; wispCount: number }}
 */
export function planSunRayCounts(rng) {
  const mainCount = 14 + Math.floor(rng() * 5);
  return { mainCount, wispCount: mainCount * 2 };
}

/**
 * Pulso individual por rayo (duración y retardo desfasados).
 * @param {SVGElement} path
 * @param {() => number} rng
 */
function applySunRayPulse(path, rng) {
  path.classList.add("loader-celestial__sun-ray--pulse");
  path.style.setProperty("--ray-pulse-dur", `${fmt(randRange(rng, 1.4, 2.4))}s`);
  path.style.setProperty("--ray-pulse-delay", `${fmt(rng() * 2.8)}s`);
}

/**
 * Rayos solares: cúspides anchas + trazos curvos intercalados (determinista por rng).
 * @param {SVGElement} svg
 * @param {() => number} rng
 */
export function appendSunArtistry(svg, rng) {
  const cx = 50;
  const cy = 50;
  const rays = document.createElementNS("http://www.w3.org/2000/svg", "g");
  rays.setAttribute("class", "loader-celestial__sun-rays");

  const { mainCount, wispCount } = planSunRayCounts(rng);
  for (let i = 0; i < mainCount; i += 1) {
    const baseAngle = (i / mainCount) * Math.PI * 2 - Math.PI / 2;
    const a = baseAngle + (rng() - 0.5) * 0.22;
    const len = randRange(rng, 9, 17);
    const width = randRange(rng, 1.6, 3.4);
    const inner = 20.5;
    const tipX = cx + Math.cos(a) * (inner + len);
    const tipY = cy + Math.sin(a) * (inner + len);
    const perp = a + Math.PI / 2;
    const hw = width / 2;
    const bx1 = cx + Math.cos(a) * inner + Math.cos(perp) * hw;
    const by1 = cy + Math.sin(a) * inner + Math.sin(perp) * hw;
    const bx2 = cx + Math.cos(a) * inner - Math.cos(perp) * hw;
    const by2 = cy + Math.sin(a) * inner - Math.sin(perp) * hw;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${fmt(bx1)} ${fmt(by1)} L ${fmt(tipX)} ${fmt(tipY)} L ${fmt(bx2)} ${fmt(by2)} Z`);
    path.setAttribute("class", "loader-celestial__sun-ray-main");
    applySunRayPulse(path, rng);
    rays.appendChild(path);
  }

  for (let i = 0; i < wispCount; i += 1) {
    const a = (i / wispCount) * Math.PI * 2 - Math.PI / 2 + (rng() - 0.5) * 0.14;
    const inner = 21 + rng() * 3;
    const outer = inner + randRange(rng, 4, 10);
    const bend = (rng() - 0.5) * 0.14;
    const x0 = cx + Math.cos(a) * inner;
    const y0 = cy + Math.sin(a) * inner;
    const x1 = cx + Math.cos(a + bend) * (inner + outer) * 0.55;
    const y1 = cy + Math.sin(a + bend) * (inner + outer) * 0.55;
    const x2 = cx + Math.cos(a) * outer;
    const y2 = cy + Math.sin(a) * outer;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${fmt(x0)} ${fmt(y0)} Q ${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)}`);
    path.setAttribute("class", "loader-celestial__sun-ray-wisp");
    applySunRayPulse(path, rng);
    rays.appendChild(path);
  }

  svg.appendChild(rays);
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} cx
 * @param {number} cy
 * @param {number} dx
 * @param {number} dy
 * @returns {boolean}
 */
export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  function orient(px, py, qx, qy, rx, ry) {
    return (qy - py) * (rx - qx) - (qx - px) * (ry - qy);
  }
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/**
 * @param {StarPoint[]} stars
 * @param {[number, number]} edge
 * @param {[number, number][]} edges
 * @param {number} layerW
 * @param {number} layerH
 * @returns {boolean}
 */
function tryAddConstellationEdge(stars, edge, edges, layerW, layerH) {
  const [i, j] = edge;
  if (i === j) return false;
  const exists = edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
  if (exists) return false;
  if (edgeCrossesExisting(stars, edge, edges, layerW, layerH)) return false;
  edges.push(edge);
  return true;
}

/**
 * @param {StarPoint[]} stars
 * @param {[number, number]} edge
 * @param {[number, number][]} edges
 * @param {number} layerW
 * @param {number} layerH
 * @returns {boolean}
 */
function edgeCrossesExisting(stars, edge, edges, layerW, layerH) {
  const a = stars[edge[0]];
  const b = stars[edge[1]];
  const ax = a.xFrac * layerW;
  const ay = a.yFrac * layerH;
  const bx = b.xFrac * layerW;
  const by = b.yFrac * layerH;

  for (const [i, j] of edges) {
    if (i === edge[0] || i === edge[1] || j === edge[0] || j === edge[1]) continue;
    const c = stars[i];
    const d = stars[j];
    if (segmentsIntersect(
      ax, ay, bx, by,
      c.xFrac * layerW, c.yFrac * layerH,
      d.xFrac * layerW, d.yFrac * layerH,
    )) {
      return true;
    }
  }
  return false;
}

/**
 * @param {() => number} rng
 * @returns {StarPoint[]}
 */
export function generateStarField(rng) {
  const count = STAR_COUNT_MIN + Math.floor(rng() * (STAR_COUNT_MAX - STAR_COUNT_MIN + 1));
  /** @type {StarPoint[]} */
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      id: i,
      xFrac: randRange(rng, 0.03, 0.97),
      yFrac: randRange(rng, STAR_Y_FRAC_MIN, STAR_Y_FRAC_MAX),
      r: randRange(rng, STAR_R_MIN, STAR_R_MAX),
      opacity: Math.round(randRange(rng, STAR_OPACITY_MIN, STAR_OPACITY_MAX) * 100) / 100,
    });
  }
  return stars;
}

/**
 * Cadenas estelares sin cruces entre segmentos.
 * @param {StarPoint[]} stars
 * @param {() => number} rng
 * @param {number} [layerW]
 * @param {number} [layerH]
 * @returns {[number, number][]}
 */
export function buildConstellationEdges(stars, rng, layerW = 390, layerH = 400) {
  const constellationCount = 3 + Math.floor(rng() * 4);
  const used = new Set();
  /** @type {[number, number][]} */
  const edges = [];

  for (let c = 0; c < constellationCount; c += 1) {
    const available = stars.filter((s) => !used.has(s.id));
    if (available.length < 4) break;

    const anchor = available[Math.floor(rng() * available.length)];
    used.add(anchor.id);
    /** @type {StarPoint[]} */
    const group = [anchor];
    const targetSize = 4 + Math.floor(rng() * 5);

    while (group.length < targetSize && group.length < available.length) {
      let best = null;
      let bestDist = Infinity;
      for (const s of available) {
        if (used.has(s.id) || group.some((g) => g.id === s.id)) continue;
        const ref = group[group.length - 1];
        const d = (s.xFrac - ref.xFrac) ** 2 + (s.yFrac - ref.yFrac) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      if (!best || bestDist > 0.2) break;
      group.push(best);
      used.add(best.id);
    }

    if (group.length < 2) continue;

    const cx = group.reduce((s, p) => s + p.xFrac, 0) / group.length;
    const cy = group.reduce((s, p) => s + p.yFrac, 0) / group.length;
    group.sort((a, b) => Math.atan2(a.yFrac - cy, a.xFrac - cx) - Math.atan2(b.yFrac - cy, b.xFrac - cx));

    for (let i = 0; i < group.length - 1; i += 1) {
      tryAddConstellationEdge(stars, [group[i].id, group[i + 1].id], edges, layerW, layerH);
    }

    if (group.length >= 4 && rng() > 0.3) {
      tryAddConstellationEdge(
        stars,
        [group[0].id, group[group.length - 1].id],
        edges,
        layerW,
        layerH,
      );
    }

    const hub = group[0];
    for (let k = 2; k < group.length - 1; k += 1) {
      if (rng() > 0.5) continue;
      tryAddConstellationEdge(stars, [hub.id, group[k].id], edges, layerW, layerH);
    }

    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 2; j < group.length; j += 1) {
        if (j === group.length - 1 && i === 0) continue;
        const d2 = (group[i].xFrac - group[j].xFrac) ** 2 + (group[i].yFrac - group[j].yFrac) ** 2;
        if (d2 < 0.0225 || d2 > 0.045) continue;
        if (rng() > 0.55) continue;
        tryAddConstellationEdge(stars, [group[i].id, group[j].id], edges, layerW, layerH);
      }
    }
  }

  return edges;
}

/**
 * Campo estelar + constelaciones deterministas por seed.
 * @param {number} seed
 * @param {number} [layerW]
 * @param {number} [layerH]
 * @returns {{ stars: StarPoint[]; edges: [number, number][] }}
 */
export function buildStarFieldFromSeed(seed, layerW = 390, layerH = 400) {
  const starRng = createRng(seed >>> 0);
  const stars = generateStarField(starRng);
  const edges = buildConstellationEdges(
    stars,
    createRng((seed ^ 0x9e3779b9) >>> 0),
    layerW,
    layerH,
  );
  return { stars, edges };
}

/**
 * @param {() => number} rng
 * @param {CelestialKind} kind
 * @param {number} [moonPhase]
 * @returns {CelestialTransitParams}
 */
export function createCelestialTransitParams(rng, kind, moonPhase = 0) {
  const bodyPx = kind === "sun"
    ? Math.round(randRange(rng, SUN_BODY_PX_MIN, SUN_BODY_PX_MAX))
    : Math.round(randRange(rng, MOON_BODY_PX_MIN, MOON_BODY_PX_MAX));

  return {
    kind,
    bodyPx,
    durationMs: Math.round(randRange(rng, CELESTIAL_ARC_DURATION_MIN_MS, CELESTIAL_ARC_DURATION_MAX_MS)),
    horizonFrac: randRange(rng, 0.72, 0.78),
    apexFrac: randRange(rng, 0.2, 0.26),
    moonPhase: kind === "moon" ? moonPhase : undefined,
  };
}

/**
 * @param {CelestialTransitParams} params
 * @param {number} layerW
 * @param {number} layerH
 * @param {number} t
 * @returns {{ x: number; y: number; opacity: number }}
 */
export function celestialTransitPoseAt(params, layerW, layerH, t) {
  return celestialArcPoseAt(t, layerW, layerH, {
    horizonFrac: params.horizonFrac,
    apexFrac: params.apexFrac,
  });
}

/**
 * @param {CelestialKind} kind
 * @param {CelestialTransitParams} params
 * @returns {HTMLElement}
 */
function createCelestialElement(kind, params) {
  const el = document.createElement("div");
  el.className = `loader-celestial loader-celestial--${kind}`;
  el.style.width = `${params.bodyPx}px`;
  el.style.height = `${params.bodyPx}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "loader-celestial__svg");
  svg.setAttribute("aria-hidden", "true");

  if (kind === "sun") {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "50");
    circle.setAttribute("cy", "50");
    circle.setAttribute("r", "20");
    circle.setAttribute("class", "loader-celestial__sun-disc");
    svg.appendChild(circle);

    const shapeRng = createRng((params.bodyPx * 9973) ^ 0x5f3759df);
    appendSunArtistry(svg, shapeRng);
  } else {
    const phase = params.moonPhase ?? 0;
    const uid = `moon-${phase}-${Math.random().toString(36).slice(2, 8)}`;
    const maskId = `loader-moon-mask-${uid}`;
    const moonR = 22;
    const shadowCx = moonShadowMaskCx(phase, 50, moonR);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
    mask.setAttribute("id", maskId);

    const maskBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    maskBg.setAttribute("width", "100");
    maskBg.setAttribute("height", "100");
    maskBg.setAttribute("fill", "white");

    const maskShadow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    maskShadow.setAttribute("cx", String(shadowCx));
    maskShadow.setAttribute("cy", "50");
    maskShadow.setAttribute("r", String(moonR));
    maskShadow.setAttribute("fill", "black");

    mask.append(maskBg, maskShadow);
    defs.appendChild(mask);
    svg.appendChild(defs);

    const moon = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    moon.setAttribute("cx", "50");
    moon.setAttribute("cy", "50");
    moon.setAttribute("r", String(moonR));
    moon.setAttribute("class", "loader-celestial__moon-body");
    moon.setAttribute("mask", `url(#${maskId})`);
    svg.appendChild(moon);
  }

  el.appendChild(svg);
  return el;
}

/**
 * @param {StarPoint[]} stars
 * @param {[number, number][]} edges
 * @returns {SVGElement}
 */
function createStarFieldSvg(stars, edges) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "loader-celestial__stars-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.width = "100%";
  svg.style.height = "100%";

  const lines = document.createElementNS("http://www.w3.org/2000/svg", "g");
  lines.setAttribute("class", "loader-celestial__constellations");
  for (const [i, j] of edges) {
    const a = stars[i];
    const b = stars[j];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(a.xFrac * 100));
    line.setAttribute("y1", String(a.yFrac * 100));
    line.setAttribute("x2", String(b.xFrac * 100));
    line.setAttribute("y2", String(b.yFrac * 100));
    line.setAttribute("class", "loader-celestial__constellation-line");
    lines.appendChild(line);
  }
  svg.appendChild(lines);

  const dots = document.createElementNS("http://www.w3.org/2000/svg", "g");
  dots.setAttribute("class", "loader-celestial__star-dots");
  for (const s of stars) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "loader-celestial__star");
    g.setAttribute("opacity", String(s.opacity));
    const rot = (s.xFrac * 47 + s.yFrac * 83) * 360;
    g.setAttribute(
      "transform",
      `translate(${s.xFrac * 100} ${s.yFrac * 100}) rotate(${fmt(rot)})`,
    );

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", star4PathD(0, 0, s.r * 1.15));
    path.setAttribute("class", "loader-celestial__star-shape");
    g.appendChild(path);
    dots.appendChild(g);
  }
  svg.appendChild(dots);

  return svg;
}

/**
 * @param {HTMLElement} container
 * @param {{ reducedMotion?: boolean; rng?: () => number; demoFast?: boolean }} [options]
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyCelestialLayer(container, { reducedMotion = false, rng, demoFast = false } = {}) {
  if (reducedMotion) {
    return { destroy() {} };
  }

  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--fantasy-celestial loader-layer--logo-masked";
  layer.setAttribute("aria-hidden", "true");
  container.appendChild(layer);

  const starsWrap = document.createElement("div");
  starsWrap.className = "loader-celestial__stars";
  starsWrap.style.opacity = "0";
  layer.appendChild(starsWrap);

  const random = rng ?? createRng(Date.now() >>> 0);

  let destroyed = false;
  let unsub = () => {};
  let layoutReady = false;
  /** @type {CelestialKind} */
  let nextKind = "sun";
  let moonPhaseIndex = 0;
  let nextSpawnAt = performance.now() + (demoFast ? 500 : randRange(random, CELESTIAL_INITIAL_DELAY_MIN_MS, CELESTIAL_INITIAL_DELAY_MAX_MS));
  /** @type {{ el: HTMLElement; params: CelestialTransitParams; startMs: number } | null} */
  let active = null;

  function scheduleNext(kind, delayMs) {
    nextKind = kind;
    nextSpawnAt = performance.now() + delayMs;
  }

  function refreshStarField() {
    const layerW = layer.clientWidth || 390;
    const layerH = layer.clientHeight || 400;
    const starSeed = Math.floor(random() * 0xffffffff) >>> 0;
    const { stars, edges } = buildStarFieldFromSeed(starSeed, layerW, layerH);
    starsWrap.replaceChildren(createStarFieldSvg(stars, edges));
  }

  function beginTransit(now) {
    if (active) return;

    const layerW = layer.clientWidth;
    const layerH = layer.clientHeight;
    if (layerW < 1 || layerH < 1) return;

    const kind = nextKind;
    const phase = kind === "moon" ? moonPhaseIndex : undefined;
    const params = createCelestialTransitParams(random, kind, phase);
    if (demoFast) params.durationMs = Math.round(randRange(random, 7000, 9000));

    const el = createCelestialElement(kind, params);
    layer.appendChild(el);

    if (kind === "moon") {
      refreshStarField();
    }

    active = { el, params, startMs: now };

    if (kind === "moon") {
      moonPhaseIndex = nextMoonPhaseIndex(moonPhaseIndex);
    }
  }

  function tick(rawNow) {
    if (destroyed) return;
    const now = typeof rawNow === "number" ? rawNow : performance.now();

    if (!layoutReady) {
      if (layer.clientWidth < 1 || layer.clientHeight < 1) {
        return;
      }
      layoutReady = true;
    }

    if (!active && now >= nextSpawnAt) {
      beginTransit(now);
    }

    const layerW = layer.clientWidth || window.innerWidth;
    const layerH = layer.clientHeight || window.innerHeight * 0.5;

    if (active) {
      const t = (now - active.startMs) / active.params.durationMs;
      if (t >= 1) {
        active.el.remove();
        const finishedKind = active.params.kind;
        active = null;
        starsWrap.style.opacity = "0";

        const gap = demoFast
          ? randRange(random, 300, 600)
          : randRange(random, CELESTIAL_GAP_MIN_MS, CELESTIAL_GAP_MAX_MS);
        scheduleNext(finishedKind === "sun" ? "moon" : "sun", gap);
      } else {
        const pose = celestialTransitPoseAt(active.params, layerW, layerH, t);
        const half = active.params.bodyPx / 2;
        active.el.style.transform = `translate(${pose.x - half}px, ${pose.y - half}px)`;
        active.el.style.opacity = String(pose.opacity);

        if (active.params.kind === "moon") {
          starsWrap.style.opacity = String(pose.opacity * 0.92);
        }
      }
    }
  }

  unsub = subscribeLoaderAnimationFrame(tick);

  return {
    destroy() {
      destroyed = true;
      unsub();
      if (active) active.el.remove();
      active = null;
      layer.remove();
    },
  };
}
