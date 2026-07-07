/**
 * Horizonte procedural persistente (montañas / colinas) en la mitad fantasía.
 *
 * @module loader-fantasy-backdrop
 */

import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {'rolling_hills'|'layered_hills'|'distant_peaks'|'serrated_range'|'mesa_horizon'} BackdropKind */

/** @typedef {{ x: number; y: number }[]} BackdropProfile */

/** @typedef {{ profile: BackdropProfile; opacity: number }[]} BackdropLayers */

export const BACKDROP_KINDS = /** @type {const} */ ([
  "rolling_hills",
  "layered_hills",
  "distant_peaks",
  "serrated_range",
  "mesa_horizon",
]);

/** Cumbres generales (colinas, mesas). */
export const BACKDROP_PEAK_Y_MIN = 0.38;
export const BACKDROP_PEAK_Y_MAX = 0.52;
/** Picos lejanos y cordilleras: ~50 % de relieve respecto a los picos generales. */
export const BACKDROP_DISTANT_PEAK_Y_MIN = 0.60;
export const BACKDROP_DISTANT_PEAK_Y_MAX = 0.70;
export const BACKDROP_SERRATED_PEAK_Y_MIN = 0.62;
export const BACKDROP_SERRATED_PEAK_Y_MAX = 0.72;
/** Mesetas de cumbre plana: ~50 % de relieve. */
export const BACKDROP_MESA_PEAK_Y_MIN = 0.60;
export const BACKDROP_MESA_PEAK_Y_MAX = 0.70;
export const BACKDROP_TALL_RELIEF_FACTOR = 0.5;
export const BACKDROP_TALL_REFERENCE_BASE = 0.86;
export const BACKDROP_HORIZON_Y_MIN = 0.78;
export const BACKDROP_VALLEY_Y_MAX = 0.96;
/** Máx. ascenso de cresta por paso horizontal normalizado (evita agujas). */
export const BACKDROP_MAX_RISE_PER_STEP = 0.09;

/**
 * @param {number} value
 * @returns {string}
 */
function fmt(value) {
  return (Math.round(value * 1000) / 1000).toFixed(1);
}

/**
 * @param {number} y
 * @returns {number}
 */
function clampRidgeY(y) {
  return Math.max(BACKDROP_PEAK_Y_MIN, Math.min(BACKDROP_VALLEY_Y_MAX, y));
}

/**
 * @param {BackdropProfile} profile
 * @returns {BackdropProfile}
 */
function finalizeProfile(profile) {
  return softenNeedleSpikes(
    profile.map((p) => ({ x: p.x, y: clampRidgeY(p.y) })),
  );
}

/**
 * Limita pendientes extremas que dibujan picos en forma de aguja.
 * @param {BackdropProfile} profile
 * @param {number} [maxRisePerStep]
 * @returns {BackdropProfile}
 */
export function softenNeedleSpikes(profile, maxRisePerStep = BACKDROP_MAX_RISE_PER_STEP) {
  if (profile.length < 2) return profile;
  const sorted = [...profile].sort((a, b) => a.x - b.x);
  /** @type {BackdropProfile} */
  const out = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = out[out.length - 1];
    const cur = { ...sorted[i] };
    const dx = cur.x - prev.x;
    if (dx <= 1e-6) continue;
    const scale = dx / 0.04;
    const maxRise = maxRisePerStep * Math.max(0.5, scale);
    const maxDrop = maxRise * 1.15;
    if (prev.y - cur.y > maxRise) {
      cur.y = prev.y - maxRise;
    } else if (cur.y - prev.y > maxDrop) {
      cur.y = prev.y + maxDrop;
    }
    out.push({ x: cur.x, y: clampRidgeY(cur.y) });
  }
  return out;
}

/**
 * @param {BackdropProfile} profile
 * @returns {number}
 */
export function countLocalPeaks(profile) {
  if (profile.length < 3) return 0;
  const sorted = [...profile].sort((a, b) => a.x - b.x);
  let peaks = 0;
  for (let i = 1; i < sorted.length - 1; i += 1) {
    const y = sorted[i].y;
    if (y < sorted[i - 1].y && y < sorted[i + 1].y) peaks += 1;
  }
  return peaks;
}

/**
 * Reduce el relieve vertical al factor indicado (0,5 = mitad de altura).
 * @param {number} y
 * @param {number} [baseY]
 * @param {number} [factor]
 * @returns {number}
 */
export function scaleBackdropRelief(
  y,
  baseY = BACKDROP_TALL_REFERENCE_BASE,
  factor = BACKDROP_TALL_RELIEF_FACTOR,
) {
  if (y >= baseY) return y;
  return baseY - (baseY - y) * factor;
}

/**
 * @param {number} t 0..1
 * @param {number} p1
 * @param {number} p2
 * @param {number} f1
 * @param {number} f2
 * @param {number} amp
 * @returns {number}
 */
function ridgeNoise(t, p1, p2, f1, f2, amp) {
  return amp * (
    0.5 * Math.sin(t * Math.PI * f1 + p1)
    + 0.28 * Math.sin(t * Math.PI * f2 + p2)
    + 0.14 * Math.sin(t * Math.PI * f1 * 2.4 + p1 * 1.6)
    + 0.08 * Math.sin(t * Math.PI * f2 * 1.7 + p2 * 0.9)
  );
}

/**
 * Inserta puntos intermedios con micro-variación.
 * @param {BackdropProfile} profile
 * @param {() => number} rng
 * @param {number} [extraPerSegment]
 * @returns {BackdropProfile}
 */
export function densifyProfile(profile, rng, extraPerSegment = 2) {
  if (profile.length < 2) return profile;
  /** @type {BackdropProfile} */
  const out = [profile[0]];
  for (let i = 1; i < profile.length; i += 1) {
    const a = profile[i - 1];
    const b = profile[i];
    for (let s = 1; s <= extraPerSegment; s += 1) {
      const t = s / (extraPerSegment + 1);
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: clampRidgeY(a.y + (b.y - a.y) * t + randRange(rng, -0.006, 0.006)),
      });
    }
    out.push(b);
  }
  return out.sort((p, q) => p.x - q.x);
}

/**
 * @param {() => number} rng
 * @returns {BackdropKind}
 */
export function pickBackdropKind(rng) {
  const roll = rng();
  if (roll < 0.24) return "rolling_hills";
  if (roll < 0.42) return "layered_hills";
  if (roll < 0.62) return "distant_peaks";
  if (roll < 0.82) return "serrated_range";
  return "mesa_horizon";
}

/**
 * @param {() => number} rng
 * @param {{ yBase?: number; ampScale?: number; segments?: number; densify?: number }} [opts]
 * @returns {BackdropProfile}
 */
export function buildRollingHillsProfile(rng, opts = {}) {
  const segments = opts.segments ?? 26 + Math.floor(rng() * 18);
  const yBase = opts.yBase ?? randRange(rng, 0.8, 0.88);
  const amp = (opts.ampScale ?? 1) * randRange(rng, 0.14, 0.26);
  const f1 = randRange(rng, 2.2, 4.8);
  const f2 = randRange(rng, 5.5, 9.5);
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;

  /** @type {BackdropProfile} */
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const n = ridgeNoise(t, p1, p2, f1, f2, 1);
    const micro = randRange(rng, -amp * 0.12, amp * 0.12);
    const y = yBase - Math.abs(n) * amp - micro;
    points.push({ x: t, y: clampRidgeY(y) });
  }
  return finalizeProfile(densifyProfile(points, rng, opts.densify ?? 2));
}

/**
 * @param {() => number} rng
 * @returns {BackdropProfile}
 */
export function buildDistantPeaksProfile(rng) {
  const peakCount = 4 + Math.floor(rng() * 4);
  /** @type {BackdropProfile} */
  const points = [{ x: 0, y: randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX) }];

  for (let i = 0; i < peakCount; i += 1) {
    const spanStart = i / peakCount;
    const spanEnd = (i + 1) / peakCount;
    const xFootL = spanStart + randRange(rng, 0.02, 0.08) * (spanEnd - spanStart);
    const xShoulderL = spanStart + randRange(rng, 0.28, 0.42) * (spanEnd - spanStart);
    const xApex = spanStart + randRange(rng, 0.45, 0.58) * (spanEnd - spanStart);
    const xShoulderR = spanStart + randRange(rng, 0.62, 0.76) * (spanEnd - spanStart);
    const xFootR = spanEnd - randRange(rng, 0.02, 0.08) * (spanEnd - spanStart);

    const apexY = clampRidgeY(randRange(rng, BACKDROP_DISTANT_PEAK_Y_MIN, BACKDROP_DISTANT_PEAK_Y_MAX));
    const shoulderY = randRange(rng, apexY + 0.04, BACKDROP_HORIZON_Y_MIN + 0.02);
    const footY = randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX);

    points.push({ x: xFootL, y: footY });
    points.push({ x: xShoulderL, y: shoulderY });
    if (rng() < 0.55) {
      points.push({
        x: xApex - randRange(rng, 0.01, 0.03),
        y: clampRidgeY(apexY + randRange(rng, 0.02, 0.06)),
      });
    }
    points.push({ x: xApex, y: apexY });
    if (rng() < 0.45) {
      points.push({
        x: xApex + randRange(rng, 0.01, 0.035),
        y: clampRidgeY(apexY + randRange(rng, 0.015, 0.05)),
      });
    }
    points.push({ x: xShoulderR, y: shoulderY + randRange(rng, -0.02, 0.03) });
    points.push({ x: xFootR, y: footY + randRange(rng, -0.02, 0.02) });
  }

  points.push({ x: 1, y: randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX) });
  return finalizeProfile(densifyProfile(points.sort((a, b) => a.x - b.x), rng, 1));
}

/**
 * Cordillera con dientes anchos (4–7 crestas), no agujas finas.
 * @param {() => number} rng
 * @returns {BackdropProfile}
 */
export function buildSerratedRangeProfile(rng) {
  const ridgeCount = 4 + Math.floor(rng() * 4);
  /** @type {BackdropProfile} */
  const points = [{ x: 0, y: randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX) }];

  for (let i = 0; i < ridgeCount; i += 1) {
    const spanStart = i / ridgeCount;
    const spanEnd = (i + 1) / ridgeCount;
    const spanW = spanEnd - spanStart;
    const xValleyL = spanStart + spanW * randRange(rng, 0.04, 0.12);
    const xRiseL = spanStart + spanW * randRange(rng, 0.22, 0.34);
    const xPeak = spanStart + spanW * randRange(rng, 0.42, 0.58);
    const xRiseR = spanStart + spanW * randRange(rng, 0.66, 0.78);
    const xValleyR = spanEnd - spanW * randRange(rng, 0.04, 0.12);

    const peakY = clampRidgeY(randRange(rng, BACKDROP_SERRATED_PEAK_Y_MIN, BACKDROP_SERRATED_PEAK_Y_MAX));
    const midY = randRange(rng, peakY + 0.03, BACKDROP_HORIZON_Y_MIN - 0.01);
    const footY = randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX);

    points.push({ x: xValleyL, y: footY });
    points.push({ x: xRiseL, y: midY });
    points.push({ x: xPeak, y: peakY });
    points.push({ x: xRiseR, y: midY + randRange(rng, -0.02, 0.02) });
    points.push({ x: xValleyR, y: footY + randRange(rng, -0.015, 0.015) });
  }

  points.push({ x: 1, y: randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX) });
  return finalizeProfile(densifyProfile(points.sort((a, b) => a.x - b.x), rng, 1));
}

/**
 * @param {() => number} rng
 * @returns {BackdropProfile}
 */
export function buildMesaHorizonProfile(rng) {
  const mesaCount = 4 + Math.floor(rng() * 4);
  const d = BACKDROP_TALL_RELIEF_FACTOR;
  /** @type {BackdropProfile} */
  const points = [{ x: 0, y: randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX) }];
  const slice = 1 / mesaCount;

  for (let i = 0; i < mesaCount; i += 1) {
    const xStart = i * slice + randRange(rng, 0, slice * 0.1);
    const xEnd = (i + 1) * slice - randRange(rng, 0, slice * 0.1);
    const top = clampRidgeY(randRange(rng, BACKDROP_MESA_PEAK_Y_MIN, BACKDROP_MESA_PEAK_Y_MAX));
    const footY = randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX);

    points.push({ x: Math.max(0, xStart), y: footY });
    points.push({
      x: Math.max(0, xStart + slice * randRange(rng, 0.04, 0.12)),
      y: top + randRange(rng, 0.02, 0.05) * d,
    });
    points.push({ x: Math.max(0, xStart + slice * randRange(rng, 0.14, 0.22)), y: top });

    const notchCount = 1 + Math.floor(rng() * 3);
    for (let n = 0; n < notchCount; n += 1) {
      const nx = xStart + (xEnd - xStart) * randRange(rng, 0.25, 0.75);
      points.push({ x: nx, y: top + randRange(rng, 0.015, 0.04) * d });
      points.push({ x: nx + slice * randRange(rng, 0.02, 0.06), y: top - randRange(rng, 0.005, 0.02) * d });
    }

    points.push({ x: Math.min(1, xEnd - slice * randRange(rng, 0.04, 0.1)), y: top });
    points.push({ x: Math.min(1, xEnd), y: top + randRange(rng, 0.01, 0.04) * d });
    points.push({ x: Math.min(1, xEnd), y: footY + randRange(rng, -0.02, 0.02) });
    if (rng() < 0.6) {
      points.push({
        x: Math.min(1, xEnd + slice * randRange(rng, 0.02, 0.08)),
        y: randRange(rng, top + 0.04 * d, BACKDROP_HORIZON_Y_MIN),
      });
    }
  }

  points.push({ x: 1, y: randRange(rng, BACKDROP_HORIZON_Y_MIN, BACKDROP_VALLEY_Y_MAX) });
  return finalizeProfile(densifyProfile(points.sort((a, b) => a.x - b.x), rng, 1));
}

/**
 * @param {() => number} rng
 * @param {BackdropKind} kind
 * @returns {BackdropProfile}
 */
export function buildBackdropProfile(rng, kind) {
  switch (kind) {
    case "rolling_hills":
      return buildRollingHillsProfile(rng);
    case "distant_peaks":
      return buildDistantPeaksProfile(rng);
    case "serrated_range":
      return buildSerratedRangeProfile(rng);
    case "mesa_horizon":
      return buildMesaHorizonProfile(rng);
    case "layered_hills":
      return buildRollingHillsProfile(rng, { ampScale: 0.9, densify: 2 });
    default:
      return buildRollingHillsProfile(rng);
  }
}

/**
 * @param {() => number} rng
 * @param {BackdropKind} kind
 * @returns {BackdropLayers}
 */
export function buildBackdropLayers(rng, kind) {
  if (kind === "layered_hills") {
    return [
      {
        profile: buildRollingHillsProfile(rng, { yBase: 0.86, ampScale: 0.42, segments: 18, densify: 1 }),
        opacity: 0.07,
      },
      {
        profile: buildRollingHillsProfile(rng, { yBase: 0.84, ampScale: 0.62, segments: 24, densify: 2 }),
        opacity: 0.1,
      },
      {
        profile: buildRollingHillsProfile(rng, { yBase: 0.82, ampScale: 0.85, segments: 30, densify: 2 }),
        opacity: 0.14,
      },
    ];
  }
  return [{ profile: buildBackdropProfile(rng, kind), opacity: 0.15 }];
}

/**
 * Silueta de horizonte cerrada (borde inferior = línea de suelo del layer).
 * @param {number} width
 * @param {number} height
 * @param {BackdropProfile} profile
 * @returns {string}
 */
export function buildBackdropPath(width, height, profile) {
  if (width <= 0 || height <= 0 || !profile?.length) return "";

  const points = profile.map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));

  let d = `M 0 ${fmt(height)} L 0 ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  d += ` L ${fmt(width)} ${fmt(height)} Z`;
  return d;
}

/**
 * @returns {number}
 */
function sessionBackdropSeed() {
  return ((Date.now() >>> 0) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * @param {string | undefined} raw
 * @returns {BackdropKind | undefined}
 */
export function parseBackdropKind(raw) {
  if (!raw) return undefined;
  return /** @type {BackdropKind | undefined} */ (
    BACKDROP_KINDS.includes(/** @type {BackdropKind} */ (raw)) ? raw : undefined
  );
}

/**
 * Horizonte persistente en la mitad fantasía (detrás de terreno, nubes y escena).
 * @param {HTMLElement} container
 * @param {{ rng?: () => number; kind?: BackdropKind }} [options]
 * @returns {{ destroy: () => void; kind: BackdropKind; layers: BackdropLayers }}
 */
export function mountFantasyBackdropLayer(container, { rng, kind: forcedKind } = {}) {
  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--fantasy-backdrop";
  layer.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "loader-fantasy-backdrop__svg");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  layer.appendChild(svg);
  container.appendChild(layer);

  const random = rng ?? createRng(sessionBackdropSeed());
  const kind = forcedKind ?? pickBackdropKind(random);
  const layers = buildBackdropLayers(random, kind);
  /** @type {{ el: SVGPathElement; profile: BackdropProfile }[]} */
  const pathEls = [];

  for (const band of layers) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "loader-fantasy-backdrop__fill");
    path.style.opacity = String(band.opacity);
    svg.appendChild(path);
    pathEls.push({ el: path, profile: band.profile });
  }

  let destroyed = false;

  function layoutBackdrop() {
    if (destroyed) return;
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    if (!w || !h) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    for (const { el, profile } of pathEls) {
      el.setAttribute("d", buildBackdropPath(w, h, profile));
    }
  }

  layoutBackdrop();

  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => layoutBackdrop())
      : null;
  ro?.observe(layer);
  if (!ro) window.addEventListener("resize", layoutBackdrop);

  return {
    kind,
    layers,
    destroy() {
      destroyed = true;
      ro?.disconnect();
      if (!ro) window.removeEventListener("resize", layoutBackdrop);
      layer.remove();
    },
  };
}
