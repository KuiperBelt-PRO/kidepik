import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {'small' | 'medium' | 'large'} CloudSizeClass */

/** @typedef {{
 *   sizeClass: CloudSizeClass;
 *   widthPx: number;
 *   heightPx: number;
 *   durationMs: number;
 *   yFraction: number;
 *   xStartFraction: number;
 *   xEndFraction: number;
 *   pathD: string;
 *   baseOpacity: number;
 * }} CloudParams */

export const CLOUD_MAX_CONCURRENT = 6;
export const CLOUD_SPAWN_INTERVAL_MIN_MS = 2500;
export const CLOUD_SPAWN_INTERVAL_MAX_MS = 7000;
export const CLOUD_INITIAL_DELAY_MIN_MS = 1500;
export const CLOUD_INITIAL_DELAY_MAX_MS = 4000;

/** Fracción Y mínima (desde arriba del layer): evita quedar demasiado bajas. */
export const CLOUD_Y_FRACTION_MIN = 0.18;
/** Fracción Y máxima: no alcanzar la altura del logo/anillo central. */
export const CLOUD_Y_FRACTION_MAX = 0.5;

/** @type {{ class: CloudSizeClass; weight: number; width: [number, number]; heightFactor: [number, number] }[]} */
const SIZE_TABLE = [
  { class: "small", weight: 40, width: [52, 78], heightFactor: [0.42, 0.58] },
  { class: "medium", weight: 40, width: [78, 112], heightFactor: [0.45, 0.62] },
  { class: "large", weight: 20, width: [112, 148], heightFactor: [0.48, 0.66] },
];

const WEIGHT_TOTAL = SIZE_TABLE.reduce((sum, row) => sum + row.weight, 0);

/** Constante de aproximación cúbica a un cuarto de círculo (suavidad en picos). */
const BEZIER_CIRCLE_K = 0.5522847498;

/**
 * @param {number} n
 * @returns {number}
 */
function fmt(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Silueta de nube: base plana + bultos superiores redondeados (cúbicas Bézier).
 * @param {() => number} rng
 * @returns {string}
 */
export function generateCloudPath(rng) {
  const bumpCount = 3 + Math.floor(rng() * 4);
  /** @type {{ cx: number; rx: number; ry: number }[]} */
  const bumps = [];
  let x = 6 + rng() * 14;

  for (let i = 0; i < bumpCount; i += 1) {
    const rx = 11 + rng() * 20;
    const ry = rx * randRange(rng, 0.5, 0.75);
    bumps.push({ cx: x + rx * 0.85, rx, ry });
    x += rx * randRange(rng, 0.42, 0.78);
  }

  const bellyY = 46 + rng() * 2.5;
  const leftX = bumps[0].cx - bumps[0].rx - randRange(rng, 0.5, 2.5);
  const rightX = bumps[bumps.length - 1].cx + bumps[bumps.length - 1].rx + randRange(rng, 0.5, 2.5);

  let d = `M ${fmt(leftX)} ${fmt(bellyY)} L ${fmt(rightX)} ${fmt(bellyY)}`;
  let penX = rightX;

  for (let i = bumps.length - 1; i >= 0; i -= 1) {
    const b = bumps[i];
    const xR = b.cx + b.rx;
    const xL = b.cx - b.rx;
    const yTop = bellyY - b.ry;
    const skewX = randRange(rng, 0.94, 1.06);
    const skewY = randRange(rng, 0.92, 1.08);
    const kx = BEZIER_CIRCLE_K * skewX;
    const ky = BEZIER_CIRCLE_K * skewY;

    if (penX > xR + 0.05) {
      d += ` L ${fmt(xR)} ${fmt(bellyY)}`;
      penX = xR;
    }

    d += ` C ${fmt(b.cx + b.rx * kx)} ${fmt(bellyY)}`;
    d += ` ${fmt(b.cx + b.rx * kx)} ${fmt(bellyY - b.ry * ky)}`;
    d += ` ${fmt(b.cx)} ${fmt(yTop)}`;
    d += ` C ${fmt(b.cx - b.rx * kx)} ${fmt(yTop)}`;
    d += ` ${fmt(b.cx - b.rx * kx)} ${fmt(bellyY)}`;
    d += ` ${fmt(xL)} ${fmt(bellyY)}`;
    penX = xL;
  }

  if (penX > leftX + 0.05) {
    d += ` L ${fmt(leftX)} ${fmt(bellyY)}`;
  }
  d += " Z";
  return d;
}

/**
 * @param {() => number} rng
 * @returns {typeof SIZE_TABLE[number]}
 */
function pickSizeRow(rng) {
  let roll = rng() * WEIGHT_TOTAL;
  for (const row of SIZE_TABLE) {
    roll -= row.weight;
    if (roll <= 0) return row;
  }
  return SIZE_TABLE[SIZE_TABLE.length - 1];
}

/**
 * @param {() => number} rng
 * @param {boolean} [isFirst]
 * @returns {number}
 */
export function planNextCloudSpawnDelayMs(rng, isFirst = false) {
  if (isFirst) {
    return Math.round(randRange(rng, CLOUD_INITIAL_DELAY_MIN_MS, CLOUD_INITIAL_DELAY_MAX_MS));
  }
  return Math.round(randRange(rng, CLOUD_SPAWN_INTERVAL_MIN_MS, CLOUD_SPAWN_INTERVAL_MAX_MS));
}

/**
 * @param {() => number} rng
 * @returns {CloudParams}
 */
export function createCloudParams(rng) {
  const row = pickSizeRow(rng);
  const widthPx = Math.round(randRange(rng, row.width[0], row.width[1]));
  const heightPx = Math.round(widthPx * randRange(rng, row.heightFactor[0], row.heightFactor[1]));
  const baseDuration = randRange(rng, 22000, 52000);
  const speedJitter = randRange(rng, 0.82, 1.22);

  const pathRng = createRng(Math.floor(rng() * 0xffffffff) >>> 0);

  return {
    sizeClass: row.class,
    widthPx,
    heightPx,
    durationMs: Math.round(baseDuration * speedJitter),
    yFraction: randRange(rng, CLOUD_Y_FRACTION_MIN, CLOUD_Y_FRACTION_MAX),
    xStartFraction: randRange(rng, 1.08, 1.18),
    xEndFraction: randRange(rng, -0.18, -0.08),
    pathD: generateCloudPath(pathRng),
    baseOpacity: Math.round(randRange(rng, 0.32, 0.72) * 100) / 100,
  };
}

/**
 * @param {number} t Progress 0..1
 * @returns {number}
 */
export function cloudOpacityAt(t) {
  if (t <= 0) return 0;
  if (t < 0.06) return t / 0.06;
  if (t > 0.92) return Math.max(0, (1 - t) / 0.08);
  return 1;
}

/**
 * @param {CloudParams} params
 * @param {number} layerW
 * @param {number} layerH
 * @param {number} t
 * @returns {{ x: number; y: number; opacity: number }}
 */
export function cloudPoseAt(params, layerW, layerH, t) {
  const x0 = params.xStartFraction * layerW;
  const x1 = params.xEndFraction * layerW;
  const y = params.yFraction * layerH;
  return {
    x: x0 + (x1 - x0) * t,
    y,
    opacity: cloudOpacityAt(t) * params.baseOpacity,
  };
}

/**
 * @param {CloudParams} params
 * @returns {HTMLElement}
 */
function createCloudElement(params) {
  const wrap = document.createElement("div");
  wrap.className = `loader-cloud loader-cloud--${params.sizeClass}`;
  wrap.style.width = `${params.widthPx}px`;
  wrap.style.height = `${params.heightPx}px`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 50");
  svg.setAttribute("class", "loader-cloud__svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", params.pathD);
  path.setAttribute("class", "loader-cloud__shape");
  svg.appendChild(path);
  wrap.appendChild(svg);

  return wrap;
}

/**
 * @param {HTMLElement} container
 * @param {{ reducedMotion?: boolean; rng?: () => number; demoFast?: boolean }} [options]
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyCloudsLayer(container, { reducedMotion = false, rng, demoFast = false } = {}) {
  if (reducedMotion) {
    return { destroy() {} };
  }

  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--fantasy-clouds";
  layer.setAttribute("aria-hidden", "true");
  container.appendChild(layer);

  const random = rng ?? createRng(Date.now() >>> 0);

  /** @type {{ el: HTMLElement; params: CloudParams; startMs: number; durationMs: number }[]} */
  let active = [];
  let destroyed = false;
  let rafId = 0;
  let nextSpawnAt = performance.now() + planNextCloudSpawnDelayMs(random, true);
  let layoutReady = false;

  function spawnCloud(now) {
    if (active.length >= CLOUD_MAX_CONCURRENT) return false;

    const layerW = layer.clientWidth;
    const layerH = layer.clientHeight;
    if (layerW < 1 || layerH < 1) return false;

    const params = createCloudParams(random);
    const el = createCloudElement(params);
    layer.appendChild(el);

    const pose = cloudPoseAt(params, layerW, layerH, 0);
    el.style.transform = `translate(${pose.x - params.widthPx / 2}px, ${pose.y - params.heightPx / 2}px)`;
    el.style.opacity = "0";

    active.push({
      el,
      params,
      startMs: now,
      durationMs: params.durationMs,
    });
    return true;
  }

  function tick(rawNow) {
    if (destroyed) return;
    const now = typeof rawNow === "number" ? rawNow : performance.now();

    if (!layoutReady) {
      if (layer.clientWidth < 1 || layer.clientHeight < 1) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      layoutReady = true;
      if (demoFast) {
        nextSpawnAt = now;
      }
    }

    if (now >= nextSpawnAt && active.length < CLOUD_MAX_CONCURRENT) {
      if (spawnCloud(now)) {
        const delay = demoFast
          ? randRange(random, 400, 900)
          : planNextCloudSpawnDelayMs(random, false);
        nextSpawnAt = now + delay;
      }
    }

    const layerW = layer.clientWidth || window.innerWidth;
    const layerH = layer.clientHeight || window.innerHeight * 0.5;

    active = active.filter((item) => {
      const t = (now - item.startMs) / item.durationMs;
      if (t >= 1) {
        item.el.remove();
        return false;
      }
      const pose = cloudPoseAt(item.params, layerW, layerH, t);
      const halfW = item.params.widthPx / 2;
      const halfH = item.params.heightPx / 2;
      item.el.style.transform = `translate(${pose.x - halfW}px, ${pose.y - halfH}px)`;
      item.el.style.opacity = String(pose.opacity);
      return true;
    });

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return {
    destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      for (const item of active) item.el.remove();
      active = [];
      layer.remove();
    },
  };
}
