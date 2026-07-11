/**
 * Generador de portales mágicos — v1 dolmen (dos rocas + losa).
 *
 * @module loader-fantasy-portal
 */

import { ElementAssembler } from "./loader-fantasy-element.js";
import { chamferRect, jitterRing } from "./loader-fantasy-geom.js";
import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {'dolmen'} PortalStyle */

/** @type {readonly string[]} */
export const PORTAL_PART_ROLES = ["upright_left", "upright_right", "lintel"];

/**
 * @param {number} seed
 * @returns {PortalStyle}
 */
export function planPortalStyle(seed) {
  return "dolmen";
}

/**
 * Escala global del dolmen (variación de tamaño por semilla).
 * @param {number} seed
 * @returns {number}
 */
export function planPortalScale(seed) {
  const rng = createRng((seed ^ 0x31bc9a11) >>> 0);
  return randRange(rng, 0.76, 1.22);
}

/**
 * Roca vertical con ligera irregularidad (chaflán + jitter moderado).
 */
export function buildIrregularUpright(cx, baseY, w, h, rng, imperfection) {
  const chamf = Math.min(w, h) * randRange(rng, 0.12, 0.22);
  const outer = chamferRect(cx, baseY, w, h, chamf);
  const jag = h * (0.018 + imperfection * 0.035);
  return jitterRing(outer, rng, jag, {
    lockY: [baseY],
    freezeSeams: true,
  });
}

/**
 * Losa horizontal con borde suavemente dentado.
 */
export function buildIrregularLintel(cx, baseY, w, h, rng, imperfection) {
  const chamf = Math.min(w, h) * randRange(rng, 0.1, 0.18);
  const outer = chamferRect(cx, baseY, w, h, chamf);
  const jag = h * (0.03 + imperfection * 0.05);
  return jitterRing(outer, rng, jag, {
    lockY: [baseY, baseY + h],
    freezeSeams: true,
  });
}

/**
 * @param {string} d
 * @returns {{ minX: number; maxX: number; minY: number; maxY: number }}
 */
export function pathBBox(d) {
  const nums = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Vano central entre uprights y bajo el lintel (viewBox y-down).
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {{ cx: number; cy: number; w: number; h: number } | null}
 */
export function computePortalAperture(element) {
  const left = element.parts.find((p) => p.role === "upright_left");
  const right = element.parts.find((p) => p.role === "upright_right");
  const lintel = element.parts.find((p) => p.role === "lintel");
  if (!left || !right || !lintel) return null;

  const lb = pathBBox(left.d);
  const rb = pathBBox(right.d);
  const lintelB = pathBBox(lintel.d);

  const gapLeft = lb.maxX;
  const gapRight = rb.minX;
  const w = gapRight - gapLeft;
  if (w < 2) return null;

  const gapTop = lintelB.maxY;
  const gapBottom = Math.max(lb.maxY, rb.maxY);
  const h = gapBottom - gapTop;
  if (h < 2) return null;

  return {
    cx: (gapLeft + gapRight) / 2,
    cy: (gapTop + gapBottom) / 2,
    w,
    h,
  };
}

/**
 * @param {{
 *   seed: number;
 *   style?: PortalStyle;
 *   imperfection?: number;
 *   scale?: number;
 * }} options
 * @returns {import('./loader-fantasy-element.js').FantasyElement}
 */
export function generatePortal(options) {
  const seed = options.seed >>> 0;
  const style = options.style ?? planPortalStyle(seed);
  const rng = createRng(seed ^ 0x8c41f0d3);
  const imperfection = options.imperfection ?? randRange(rng, 0.42, 0.62);
  const scale = options.scale ?? planPortalScale(seed);

  const uprightH = randRange(rng, 34, 50) * scale;
  const uprightW = randRange(rng, 5, 9) * scale;
  const gapW = randRange(rng, 14, 22) * scale;
  const lintelH = randRange(rng, 4, 7) * scale;
  const lintelW = (gapW + uprightW * 2 + randRange(rng, 1.5, 4)) * randRange(rng, 0.98, 1.04);
  const leftLean = (rng() - 0.5) * imperfection * 0.9;
  const rightLean = (rng() - 0.5) * imperfection * 0.9;

  const leftCx = -(gapW / 2 + uprightW / 2) + leftLean;
  const rightCx = gapW / 2 + uprightW / 2 + rightLean;
  const lintelY = uprightH - lintelH * randRange(rng, 0.1, 0.22);
  const lintelTilt = (rng() - 0.5) * imperfection * 1.2;

  const asm = new ElementAssembler();

  asm.addPart(
    "upright_left",
    buildIrregularUpright(leftCx, 0, uprightW, uprightH, rng, imperfection),
    [],
    { buildSequence: 0, tiltDeg: leftLean * 0.2 },
  );

  asm.addPart(
    "upright_right",
    buildIrregularUpright(rightCx, 0, uprightW, uprightH, rng, imperfection),
    [],
    { buildSequence: 1, tiltDeg: rightLean * 0.2 },
  );

  asm.addPart(
    "lintel",
    buildIrregularLintel(lintelTilt * 0.08, lintelY, lintelW, lintelH, rng, imperfection),
    [],
    { buildSequence: 2, tiltDeg: lintelTilt },
  );

  const heightFloor = 38 + scale * 8;
  const element = asm.build("portal", seed, style, {
    imperfection,
    scale,
    normalizeScaleBy: "height",
    normalizeHeightFloor: heightFloor,
  });

  const aperture = computePortalAperture(element);
  element.meta = {
    ...element.meta,
    aperture,
    uprightH,
    gapW,
    scale,
    imperfection,
  };

  return element;
}
