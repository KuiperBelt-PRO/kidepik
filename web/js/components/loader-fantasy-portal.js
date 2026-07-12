/**
 * Generador de portales mágicos — dolmen, arco románico y anillo circular.
 *
 * @module loader-fantasy-portal
 */

import { ElementAssembler } from "./loader-fantasy-element.js";
import { chamferRect, jitterRing } from "./loader-fantasy-geom.js";
import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {'dolmen' | 'romanesque' | 'circular'} PortalStyle */

/** @type {readonly PortalStyle[]} */
export const PORTAL_STYLES = ["dolmen", "romanesque", "circular"];

/** @type {readonly string[]} */
export const PORTAL_PART_ROLES = ["upright_left", "upright_right", "lintel"];

/**
 * @param {number} seed
 * @returns {PortalStyle}
 */
export function planPortalStyle(seed) {
  const rng = createRng((seed ^ 0x7f4a9c2e) >>> 0);
  const roll = rng();
  if (roll < 0.34) return "dolmen";
  if (roll < 0.67) return "romanesque";
  return "circular";
}

/**
 * Escala global del portal (variación de tamaño por semilla).
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
 * Dovela trapezoidal entre dos ángulos en un arco semicircular (y-up).
 */
export function buildArchVoussoir(cx, cy, innerR, outerR, angleStart, angleEnd, rng, imperfection) {
  const segments = 3;
  /** @type {import('./loader-fantasy-geom.js').FPoint[]} */
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = angleStart + (angleEnd - angleStart) * (i / segments);
    pts.push({
      x: cx + outerR * Math.cos(a),
      y: cy + outerR * Math.sin(a),
    });
  }
  for (let i = segments; i >= 0; i -= 1) {
    const a = angleStart + (angleEnd - angleStart) * (i / segments);
    pts.push({
      x: cx + innerR * Math.cos(a),
      y: cy + innerR * Math.sin(a),
    });
  }
  const jag = (outerR - innerR) * (0.06 + imperfection * 0.08);
  return jitterRing(pts, rng, jag, { freezeSeams: true });
}

/**
 * Cuña radial de anillo circular (stargate).
 */
export function buildRingStone(cx, cy, innerR, outerR, angleStart, angleEnd, rng, imperfection) {
  const segments = 2;
  /** @type {import('./loader-fantasy-geom.js').FPoint[]} */
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = angleStart + (angleEnd - angleStart) * (i / segments);
    pts.push({
      x: cx + outerR * Math.cos(a),
      y: cy + outerR * Math.sin(a),
    });
  }
  for (let i = segments; i >= 0; i -= 1) {
    const a = angleStart + (angleEnd - angleStart) * (i / segments);
    pts.push({
      x: cx + innerR * Math.cos(a),
      y: cy + innerR * Math.sin(a),
    });
  }
  const jag = (outerR - innerR) * (0.08 + imperfection * 0.1);
  return jitterRing(pts, rng, jag, { freezeSeams: true });
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
 * Vano central del dolmen o arco románico.
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {{ cx: number; cy: number; w: number; h: number } | null}
 */
function computeColumnAperture(element) {
  const left = element.parts.find((p) => p.role === "upright_left");
  const right = element.parts.find((p) => p.role === "upright_right");
  if (!left || !right) return null;

  const lb = pathBBox(left.d);
  const rb = pathBBox(right.d);

  const gapLeft = lb.maxX;
  const gapRight = rb.minX;
  const w = gapRight - gapLeft;
  if (w < 2) return null;

  let gapTop = Math.min(lb.minY, rb.minY);
  const lintel = element.parts.find((p) => p.role === "lintel");
  if (lintel) {
    gapTop = pathBBox(lintel.d).maxY;
  } else {
    const voussoirs = element.parts.filter((p) => p.role.startsWith("voussoir_"));
    if (voussoirs.length > 0) {
      gapTop = Math.min(...voussoirs.map((p) => pathBBox(p.d).maxY));
    }
  }

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
 * Vano central del anillo circular (hueco interior estimado desde las piedras).
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {{ cx: number; cy: number; w: number; h: number } | null}
 */
function computeCircularAperture(element) {
  const stones = element.parts.filter((p) => p.role.startsWith("ring_stone_"));
  if (stones.length < 5) return null;

  let outerMinX = Infinity;
  let outerMaxX = -Infinity;
  let outerMinY = Infinity;
  let outerMaxY = -Infinity;

  for (const stone of stones) {
    const b = pathBBox(stone.d);
    if (b.minX < outerMinX) outerMinX = b.minX;
    if (b.maxX > outerMaxX) outerMaxX = b.maxX;
    if (b.minY < outerMinY) outerMinY = b.minY;
    if (b.maxY > outerMaxY) outerMaxY = b.maxY;
  }

  const cx = (outerMinX + outerMaxX) / 2;
  const cy = (outerMinY + outerMaxY) / 2;
  const w = (outerMaxX - outerMinX) * 0.5;
  const h = (outerMaxY - outerMinY) * 0.58;
  if (w < 4 || h < 4) return null;

  return { cx, cy, w, h };
}

/**
 * Vano central para anclas FX.
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {{ cx: number; cy: number; w: number; h: number } | null}
 */
export function computePortalAperture(element) {
  if (element.style === "circular") {
    return computeCircularAperture(element);
  }
  return computeColumnAperture(element);
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
  const imperfection = options.imperfection ?? randRange(createRng(seed ^ 0x8c41f0d3), 0.42, 0.62);
  const scale = options.scale ?? planPortalScale(seed);

  if (style === "romanesque") {
    return generateRomanesquePortal(seed, imperfection, scale);
  }
  if (style === "circular") {
    return generateCircularPortal(seed, imperfection, scale);
  }
  return generateDolmenPortal(seed, imperfection, scale);
}

/**
 * @param {number} seed
 * @param {number} imperfection
 * @param {number} scale
 */
function generateDolmenPortal(seed, imperfection, scale) {
  const rng = createRng(seed ^ 0x8c41f0d3);

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
  const element = asm.build("portal", seed, "dolmen", {
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

/**
 * @param {number} seed
 * @param {number} imperfection
 * @param {number} scale
 */
function generateRomanesquePortal(seed, imperfection, scale) {
  const rng = createRng(seed ^ 0x9d52e1c4);

  const uprightH = randRange(rng, 32, 46) * scale;
  const uprightW = randRange(rng, 5, 9) * scale;
  const gapW = randRange(rng, 14, 20) * scale;
  const archR = gapW / 2;
  const archThickness = randRange(rng, 4, 7) * scale;
  const innerR = archR - archThickness * 0.35;
  const outerR = archR + archThickness * 0.65;
  const voussoirCount = 5 + Math.floor(rng() * 4);

  const leftLean = (rng() - 0.5) * imperfection * 0.85;
  const rightLean = (rng() - 0.5) * imperfection * 0.85;
  const leftCx = -(gapW / 2 + uprightW / 2) + leftLean;
  const rightCx = gapW / 2 + uprightW / 2 + rightLean;
  const springY = uprightH - archThickness * randRange(rng, 0.15, 0.35);

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

  for (let i = 0; i < voussoirCount; i += 1) {
    const t0 = i / voussoirCount;
    const t1 = (i + 1) / voussoirCount;
    const a0 = Math.PI * (1 - t0);
    const a1 = Math.PI * (1 - t1);
    asm.addPart(
      `voussoir_${i}`,
      buildArchVoussoir(0, springY, innerR, outerR, a0, a1, rng, imperfection),
      [],
      { buildSequence: 2 + i },
    );
  }

  const heightFloor = 38 + scale * 8;
  const element = asm.build("portal", seed, "romanesque", {
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
    voussoirCount,
    scale,
    imperfection,
  };

  return element;
}

/**
 * @param {number} seed
 * @param {number} imperfection
 * @param {number} scale
 */
function generateCircularPortal(seed, imperfection, scale) {
  const rng = createRng(seed ^ 0xae63f2d5);

  const innerR = randRange(rng, 9, 13) * scale;
  const stoneDepth = randRange(rng, 3.5, 6.5) * scale;
  const outerR = innerR + stoneDepth;
  const ellipseY = randRange(rng, 0.62, 0.78);
  const gapAngle = randRange(rng, 0.38, 0.55);
  const preferOdd = rng() < 0.65;
  let stoneCount = 7 + Math.floor(rng() * 5);
  if (preferOdd && stoneCount % 2 === 0) stoneCount += 1;
  stoneCount = Math.min(11, Math.max(7, stoneCount));

  const ringCx = 0;
  const ringCy = innerR * ellipseY + outerR * 0.35;
  const span = Math.PI * 2 - gapAngle;
  const startAngle = Math.PI / 2 + gapAngle / 2;
  const step = span / stoneCount;

  /** @type {{ index: number; depth: number; a0: number; a1: number }[]} */
  const slots = [];
  for (let i = 0; i < stoneCount; i += 1) {
    const a0 = startAngle + i * step;
    const a1 = a0 + step * randRange(rng, 0.88, 0.96);
    const midA = (a0 + a1) / 2;
    const depth = Math.sin(midA);
    slots.push({ index: i, depth, a0, a1 });
  }
  slots.sort((a, b) => a.depth - b.depth);

  const asm = new ElementAssembler();
  slots.forEach((slot, order) => {
    const localInner = innerR * randRange(rng, 0.94, 1.02);
    const localOuter = outerR * randRange(rng, 0.96, 1.06);
    asm.addPart(
      `ring_stone_${slot.index}`,
      buildRingStone(ringCx, ringCy, localInner, localOuter, slot.a0, slot.a1, rng, imperfection),
      [],
      { buildSequence: order },
    );
  });

  const heightFloor = 36 + scale * 10;
  const element = asm.build("portal", seed, "circular", {
    imperfection,
    scale,
    normalizeScaleBy: "height",
    normalizeHeightFloor: heightFloor,
  });

  const aperture = computePortalAperture(element);
  element.meta = {
    ...element.meta,
    aperture,
    stoneCount,
    scale,
    imperfection,
  };

  return element;
}
