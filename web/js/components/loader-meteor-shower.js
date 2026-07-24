import { subscribeLoaderAnimationFrame } from "./loader-animation-frame.js";
import { createRng, randRange } from "./loader-ship-rng.js";
import { computeSpaceLayoutScale } from "./loader-space-layout.js";

/** @typedef {'micro' | 'small' | 'medium' | 'bright'} MeteorSizeClass */

/** @typedef {{
 *   sizeClass: MeteorSizeClass;
 *   lengthPx: number;
 *   thicknessPx: number;
 *   tailOpacity: number;
 *   durationMs: number;
 *   yFraction: number;
 *   xStartFraction: number;
 *   xEndFraction: number;
 * }} MeteorParams */

export const METEOR_BURST_INTERVAL_MIN_MS = 12000;
export const METEOR_BURST_INTERVAL_MAX_MS = 22000;
export const METEOR_BURST_COUNT_MIN = 10;
export const METEOR_BURST_COUNT_MAX = 28;
export const METEOR_MAX_CONCURRENT = 32;
export const METEOR_INITIAL_DELAY_MIN_MS = 4000;
export const METEOR_INITIAL_DELAY_MAX_MS = 8000;
export const METEOR_STAGGER_MIN_MS = 35;
export const METEOR_STAGGER_MAX_MS = 95;

/** @type {{ class: MeteorSizeClass; weight: number; len: [number, number]; thick: [number, number]; tail: [number, number] }[]} */
const SIZE_TABLE = [
  { class: "micro", weight: 35, len: [16, 24], thick: [1, 1], tail: [0.45, 0.65] },
  { class: "small", weight: 40, len: [28, 42], thick: [1, 1.5], tail: [0.55, 0.8] },
  { class: "medium", weight: 20, len: [48, 72], thick: [1.5, 2], tail: [0.7, 0.95] },
  { class: "bright", weight: 5, len: [78, 108], thick: [2, 2], tail: [0.85, 1] },
];

const WEIGHT_TOTAL = SIZE_TABLE.reduce((sum, row) => sum + row.weight, 0);

/**
 * @param {() => number} rng
 * @returns {number}
 */
export function planBurstMeteorCount(rng) {
  const span = METEOR_BURST_COUNT_MAX - METEOR_BURST_COUNT_MIN + 1;
  return METEOR_BURST_COUNT_MIN + Math.floor(rng() * span);
}

/**
 * @param {() => number} rng
 * @param {boolean} [isFirst]
 * @returns {number}
 */
export function planNextBurstDelayMs(rng, isFirst = false) {
  if (isFirst) {
    return randRange(rng, METEOR_INITIAL_DELAY_MIN_MS, METEOR_INITIAL_DELAY_MAX_MS);
  }
  return randRange(rng, METEOR_BURST_INTERVAL_MIN_MS, METEOR_BURST_INTERVAL_MAX_MS);
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
 * @returns {MeteorParams}
 */
export function createMeteorParams(rng) {
  const row = pickSizeRow(rng);
  const lengthPx = randRange(rng, row.len[0], row.len[1]);
  const thicknessPx = randRange(rng, row.thick[0], row.thick[1]);
  const tailOpacity = randRange(rng, row.tail[0], row.tail[1]);
  const baseDuration = randRange(rng, 520, 920);
  const sizeFactor = randRange(rng, 0.9, 1.4);
  const jitter = randRange(rng, 0.92, 1.12);

  return {
    sizeClass: row.class,
    lengthPx: Math.round(lengthPx),
    thicknessPx: Math.round(thicknessPx * 10) / 10,
    tailOpacity: Math.round(tailOpacity * 100) / 100,
    durationMs: Math.round(baseDuration * sizeFactor * jitter),
    yFraction: randRange(rng, 0.08, 0.38),
    xStartFraction: randRange(rng, -0.18, -0.08),
    xEndFraction: randRange(rng, 1.08, 1.18),
  };
}

/**
 * @param {number} t Progress 0..1
 * @returns {number}
 */
export function meteorOpacityAt(t) {
  if (t <= 0) return 0;
  if (t < 0.08) return t / 0.08;
  if (t > 0.88) return Math.max(0, (1 - t) / 0.12);
  return 1;
}

/**
 * @param {MeteorParams} params
 * @param {number} layerW
 * @param {number} layerH
 * @param {number} t
 * @returns {{ x: number; y: number; opacity: number }}
 */
export function meteorPoseAt(params, layerW, layerH, t) {
  const x0 = params.xStartFraction * layerW;
  const x1 = params.xEndFraction * layerW;
  const y = params.yFraction * layerH;
  return {
    x: x0 + (x1 - x0) * t,
    y,
    opacity: meteorOpacityAt(t) * params.tailOpacity,
  };
}

/**
 * @param {MeteorParams} params
 * @returns {HTMLElement}
 */
function createMeteorElement(params) {
  const el = document.createElement("div");
  el.className = `loader-meteor loader-meteor--${params.sizeClass}`;
  el.style.setProperty("--meteor-len", `${params.lengthPx}px`);
  el.style.setProperty("--meteor-thick", `${params.thicknessPx}px`);
  el.style.setProperty("--meteor-tail", String(params.tailOpacity));
  return el;
}

export function mountMeteorShowerLayer(container, { reducedMotion = false, rng, demoBurst = false, layout = "loader" } = {}) {
  void layout;
  if (reducedMotion) {
    return { destroy() {} };
  }

  /**
   * @param {HTMLElement} meteorLayer
   * @returns {'loader' | 'legal'}
   */
  function resolveSpaceLayout(meteorLayer) {
    const scene = meteorLayer.closest(".scene-legal, .scene-loader");
    return scene?.classList.contains("scene-legal") ? "legal" : "loader";
  }

  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--meteor-shower loader-layer--logo-masked";
  layer.setAttribute("aria-hidden", "true");
  container.appendChild(layer);

  const random = rng ?? createRng(Date.now() >>> 0);

  /** @type {{ el: HTMLElement; params: MeteorParams; startMs: number; durationMs: number }[]} */
  let active = [];
  let destroyed = false;
  let unsub = () => {};
  let nextBurstAt = performance.now() + planNextBurstDelayMs(random, true);
  /** @type {number[]} */
  let pendingSpawns = [];
  let layoutReady = false;
  let demoBurstScheduled = false;

  function scheduleBurst(atMs) {
    const count = planBurstMeteorCount(random);
    for (let i = 0; i < count; i += 1) {
      pendingSpawns.push(atMs + i * randRange(random, METEOR_STAGGER_MIN_MS, METEOR_STAGGER_MAX_MS));
    }
  }

  function ensureDemoBurst(now) {
    if (!demoBurst || demoBurstScheduled) return;
    demoBurstScheduled = true;
    scheduleBurst(now);
    nextBurstAt = now + METEOR_BURST_INTERVAL_MAX_MS + 60000;
  }

  function spawnMeteor(now) {
    if (active.length >= METEOR_MAX_CONCURRENT) return false;

    const layerW = layer.clientWidth;
    const layerH = layer.clientHeight;
    if (layerW < 1 || layerH < 1) return false;

    const params = createMeteorParams(random);
    const scale = computeSpaceLayoutScale(layer, resolveSpaceLayout(layer));
    if (scale < 0.999) {
      params.lengthPx = Math.max(8, Math.round(params.lengthPx * scale));
      params.thicknessPx = Math.max(0.8, Math.round(params.thicknessPx * scale * 10) / 10);
    }
    const el = createMeteorElement(params);
    layer.appendChild(el);

    const pose = meteorPoseAt(params, layerW, layerH, 0);
    el.style.transform = `translate(${pose.x}px, ${pose.y}px)`;
    el.style.opacity = "0";

    active.push({
      el,
      params,
      startMs: now,
      durationMs: params.durationMs,
    });
    return true;
  }

  function drainPendingSpawns(now) {
    while (pendingSpawns.length > 0 && pendingSpawns[0] <= now) {
      if (!spawnMeteor(now)) break;
      pendingSpawns.shift();
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
      ensureDemoBurst(now);
    }

    if (now >= nextBurstAt && pendingSpawns.length === 0) {
      scheduleBurst(now);
      nextBurstAt = now + planNextBurstDelayMs(random, false);
    }

    drainPendingSpawns(now);

    const layerW = layer.clientWidth || window.innerWidth;
    const layerH = layer.clientHeight || window.innerHeight * 0.48;

    active = active.filter((item) => {
      const t = (now - item.startMs) / item.durationMs;
      if (t >= 1) {
        item.el.remove();
        return false;
      }
      const pose = meteorPoseAt(item.params, layerW, layerH, t);
      item.el.style.transform = `translate(${pose.x}px, ${pose.y}px)`;
      item.el.style.opacity = String(pose.opacity);
      return true;
    });
  }

  unsub = subscribeLoaderAnimationFrame(tick);

  return {
    destroy() {
      destroyed = true;
      unsub();
      pendingSpawns = [];
      for (const item of active) item.el.remove();
      active = [];
      layer.remove();
    },
  };
}
