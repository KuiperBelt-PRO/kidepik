/**
 * Generador de racimos de cristales: roca irregular + hexágonos alargados.
 *
 * Cada cristal es un hexágono con dos lados largos (caras paralelas) y cuatro
 * cortos (terminaciones superior e inferior), anclado en la cresta de la roca.
 *
 * @module loader-fantasy-crystals
 */

import { ElementAssembler } from "./loader-fantasy-element.js";
import { jitterRing, polygon } from "./loader-fantasy-geom.js";
import { createRng, randRange } from "./loader-ship-rng.js";

/** @typedef {'shard' | 'geode' | 'floatingShards'} CrystalStyle */

const STYLE_CONFIG = {
  shard: {
    crystalMin: 4,
    crystalMax: 6,
    layoutMin: 34,
    layoutMax: 48,
    rockHMin: 8,
    rockHMax: 14,
    heightMul: 1.05,
    spreadMul: 0.4,
    floatCount: 0,
  },
  geode: {
    crystalMin: 6,
    crystalMax: 9,
    layoutMin: 40,
    layoutMax: 54,
    rockHMin: 10,
    rockHMax: 16,
    heightMul: 0.82,
    spreadMul: 0.35,
    floatCount: 0,
  },
  floatingShards: {
    crystalMin: 4,
    crystalMax: 7,
    layoutMin: 36,
    layoutMax: 50,
    rockHMin: 8,
    rockHMax: 14,
    heightMul: 1.0,
    spreadMul: 0.42,
    floatCount: 2,
  },
};

/** @type {readonly string[]} */
export const CRYSTAL_PART_ROLES = ["crystal"];

/**
 * Semi-ancho aleatorio con sesgo a prismas estrechos, medios y anchos.
 * @param {() => number} rng
 * @param {number} heightFrac
 */
export function sampleCrystalHalfWidth(rng, heightFrac) {
  const roll = rng();
  let hw;
  if (roll < 0.5) {
    hw = randRange(rng, 1.1, 2.2);
  } else if (roll < 0.9) {
    hw = randRange(rng, 2.0, 3.4);
  } else {
    hw = randRange(rng, 3.0, 4.0);
  }
  return hw * (0.74 + heightFrac * 0.2);
}

/**
 * Abscisa de un cristal en el racimo, con separación angular moderada.
 * @param {() => number} rng
 * @param {number} i
 * @param {number} crystalCount
 * @param {number} rockCx
 * @param {number} spread
 * @param {number} imperfection
 */
export function sampleCrystalOffsetX(rng, i, crystalCount, rockCx, spread, imperfection) {
  const slotSpan = Math.PI * 0.68;
  const slotAngle = crystalCount <= 1
    ? 0
    : slotSpan / (crystalCount - 1);
  const angle = (i - (crystalCount - 1) * 0.5) * slotAngle
    + (rng() - 0.5) * slotAngle * randRange(rng, 0.16, 0.3);
  const radius = spread * randRange(rng, 0.1, 0.62);
  const jitter = (rng() - 0.5) * spread * randRange(rng, 0.05, 0.1);
  return rockCx + Math.sin(angle) * radius + jitter;
}

/**
 * @param {number} seed
 * @returns {CrystalStyle}
 */
export function planCrystalStyle(seed) {
  const rng = createRng((seed ^ 0x2c91f4a8) >>> 0);
  const roll = rng();
  if (roll < 0.34) return "shard";
  if (roll < 0.68) return "geode";
  return "floatingShards";
}

/**
 * @param {import('./loader-fantasy-geom.js').FPoint[]} pts
 * @param {number} pivotX
 * @param {number} pivotY
 * @param {number} deg
 */
export function rotatePoints(pts, pivotX, pivotY, deg) {
  if (Math.abs(deg) < 0.01) return pts;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return pts.map((p) => {
    const dx = p.x - pivotX;
    const dy = p.y - pivotY;
    return {
      x: pivotX + dx * cos - dy * sin,
      y: pivotY + dx * sin + dy * cos,
    };
  });
}

/**
 * Hexágono alargado (perfil de prisma visto de lado):
 *
 *        ●  vértice superior
 *       / \
 *      /   \   ← 2 lados cortos (facetas de terminación)
 *     |     |
 *     |     |  ← 2 lados largos PARALELOS (caras del prisma)
 *     |     |
 *      \   /   ← 2 lados cortos (facetas de base)
 *       ●  vértice inferior (anclado en la roca)
 *
 * Coordenadas locales y-up; crece desde `baseY` hacia arriba.
 *
 * @param {number} cx
 * @param {number} baseY  cresta de la roca (vértice inferior)
 * @param {number} height altura total
 * @param {number} halfWidth semi-ancho de las caras largas
 * @param {number} capDepth altura de cada terminación corta (arriba y abajo)
 */
export function buildElongatedHexCrystal(cx, baseY, height, halfWidth, capDepth) {
  const cap = Math.min(capDepth, height * 0.22);
  const tipY = baseY + height;
  const joinTop = tipY - cap;
  const joinBot = baseY + cap;

  return polygon([
    { x: cx, y: tipY },
    { x: cx + halfWidth, y: joinTop },
    { x: cx + halfWidth, y: joinBot },
    { x: cx, y: baseY },
    { x: cx - halfWidth, y: joinBot },
    { x: cx - halfWidth, y: joinTop },
  ]);
}

/**
 * Roca irregular de base con perfil superior dentado.
 * @param {() => number} rng
 * @param {number} layoutWidth
 * @param {number} depth
 * @returns {{ outer: import('./loader-fantasy-geom.js').FPoint[]; crestPts: import('./loader-fantasy-geom.js').FPoint[]; centerX: number }}
 */
export function buildIrregularRock(rng, layoutWidth, depth) {
  const cx = layoutWidth * 0.5;
  const w = layoutWidth * randRange(rng, 0.82, 1.08);
  const steps = 10 + Math.floor(rng() * 4);
  /** @type {import('./loader-fantasy-geom.js').FPoint[]} */
  const crestPts = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = cx - w * 0.5 + w * t;
    const dome = Math.sin(t * Math.PI) * depth * 0.14;
    const ripple = Math.sin(t * Math.PI * (2.2 + rng() * 1.6)) * depth * randRange(rng, 0.04, 0.1);
    const jitter = (rng() - 0.5) * depth * 0.06;
    const y = depth * randRange(rng, 0.58, 0.92) + dome + ripple + jitter;
    crestPts.push({ x, y });
  }

  const leftW = w * randRange(rng, 0.08, 0.16);
  const rightW = w * randRange(rng, 0.08, 0.16);

  let outer = polygon([
    { x: cx - w * 0.5 - leftW, y: 0 },
    { x: cx + w * 0.5 + rightW, y: 0 },
    ...crestPts.slice().reverse(),
  ]);

  outer = jitterRing(outer, rng, depth * randRange(rng, 0.025, 0.05), {
    freezeSeams: true,
    lockY: [0],
  });

  return { outer, crestPts, centerX: cx };
}

/**
 * Altura del perfil superior de la roca en una abscisa (interp. sobre `crestPts`).
 * @deprecated Preferir {@link rockTopYAt} con el polígono final de la roca.
 */
export function rockCrestYAt(crestPts, x) {
  if (crestPts.length === 0) return 0;
  if (x <= crestPts[0].x) return crestPts[0].y;
  const last = crestPts[crestPts.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 0; i < crestPts.length - 1; i += 1) {
    const a = crestPts[i];
    const b = crestPts[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return last.y;
}

/**
 * Altura de la superficie superior de la roca en `x` (y-up), a partir del polígono real.
 * @param {import('./loader-fantasy-geom.js').FPoint[]} rockOuter
 * @param {number} x
 */
export function rockTopYAt(rockOuter, x) {
  if (rockOuter.length < 2) return 0;
  /** @type {number[]} */
  const hits = [];
  for (let i = 0; i < rockOuter.length; i += 1) {
    const a = rockOuter[i];
    const b = rockOuter[(i + 1) % rockOuter.length];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    if (x < minX - 1e-6 || x > maxX + 1e-6) continue;
    const dx = b.x - a.x;
    if (Math.abs(dx) < 1e-9) {
      if (Math.abs(a.x - x) < 1e-6) hits.push(a.y, b.y);
      continue;
    }
    const t = (x - a.x) / dx;
    if (t >= 0 && t <= 1) hits.push(a.y + (b.y - a.y) * t);
  }
  if (hits.length === 0) {
    return Math.max(...rockOuter.map((p) => p.y));
  }
  return Math.max(...hits);
}

/**
 * Línea de implantación del prisma: hombros inferiores (joinBot), no la punta.
 * @param {import('./loader-fantasy-geom.js').FPoint[]} outer
 */
export function crystalPlantLine(outer) {
  const sorted = [...outer].sort((a, b) => a.y - b.y);
  const apex = sorted[0];
  const shoulderA = sorted[1];
  const shoulderB = sorted[2];
  return {
    plantY: (shoulderA.y + shoulderB.y) * 0.5,
    plantX: (shoulderA.x + shoulderB.x) * 0.5,
    apexY: apex.y,
    apexX: apex.x,
  };
}

/**
 * Inserta el cristal en la roca: la línea ancha de la base queda en la superficie
 * (o ligeramente hundida) y la punta inferior queda dentro del macizo.
 *
 * @param {import('./loader-fantasy-geom.js').FPoint[]} outer
 * @param {import('./loader-fantasy-geom.js').FPoint[]} rockOuter
 * @param {number} [penetration] hundimiento extra de la línea de implantación (y-up)
 */
export function anchorCrystalToRock(outer, rockOuter, penetration = 0) {
  const { plantY, plantX } = crystalPlantLine(outer);
  const surfaceY = rockTopYAt(rockOuter, plantX);
  const targetY = surfaceY - penetration;
  const dy = targetY - plantY;
  if (Math.abs(dy) < 0.001) return outer;
  return outer.map((p) => ({ x: p.x, y: p.y + dy }));
}

/**
 * @param {() => number} rng
 * @param {number} cx
 * @param {number} baseY
 * @param {number} height
 * @param {number} halfWidth
 * @param {number} tiltDeg
 * @param {import('./loader-fantasy-geom.js').FPoint[]} [rockOuter]
 */
export function buildCrystalAt(rng, cx, baseY, height, halfWidth, tiltDeg, rockOuter) {
  const capDepth = height * randRange(rng, 0.08, 0.14);
  let outer = buildElongatedHexCrystal(cx, baseY, height, halfWidth, capDepth);
  outer = rotatePoints(outer, cx, baseY, tiltDeg);
  if (rockOuter?.length) {
    const penetration = capDepth * randRange(rng, 0.45, 1.1) + height * randRange(rng, 0.03, 0.1);
    outer = anchorCrystalToRock(outer, rockOuter, penetration);
  }
  return outer;
}

/**
 * @param {import('./loader-fantasy-element.js').FantasyElement} el
 */
export function crystalParts(el) {
  return el.parts.filter((p) => p.role === "crystal");
}

/**
 * @param {{
 *   seed: number;
 *   style?: CrystalStyle;
 *   imperfection?: number;
 * }} options
 */
export function generateCrystals(options) {
  const { seed } = options;
  const rng = createRng(seed >>> 0);
  const style = options.style ?? planCrystalStyle(seed);
  const cfg = STYLE_CONFIG[style];
  const imperfection = options.imperfection ?? randRange(rng, 0.25, 0.65);

  const layoutWidth = randRange(rng, cfg.layoutMin, cfg.layoutMax);
  const rockDepth = randRange(rng, cfg.rockHMin, cfg.rockHMax);
  const crystalCount = cfg.crystalMin + Math.floor(rng() * (cfg.crystalMax - cfg.crystalMin + 1));
  const clusterHeight = randRange(rng, 38, 58) * cfg.heightMul;

  const rock = buildIrregularRock(rng, layoutWidth, rockDepth);
  const rockCx = rock.centerX;

  const asm = new ElementAssembler();
  asm.addPart("rock_base", rock.outer, [], { buildSequence: 0 });

  let maxCrystalHeight = 0;
  let crystalCxSum = 0;
  const spread = layoutWidth * cfg.spreadMul;

  for (let i = 0; i < crystalCount; i += 1) {
    const cx = sampleCrystalOffsetX(rng, i, crystalCount, rockCx, spread, imperfection);
    crystalCxSum += cx;

    const isHero = i === 0 || (i === 1 && rng() < 0.35);
    const heightFrac = isHero
      ? randRange(rng, 0.88, 1.0)
      : randRange(rng, 0.2, 0.92);
    const height = clusterHeight * heightFrac;
    maxCrystalHeight = Math.max(maxCrystalHeight, height);

    const halfWidth = sampleCrystalHalfWidth(rng, heightFrac);
    const angleBias = spread > 0 ? (cx - rockCx) / spread : 0;
    const tilt = randRange(rng, -34, 34)
      + angleBias * randRange(rng, 14, 28)
      + (rng() - 0.5) * imperfection * 24;

    const crestY = rockTopYAt(rock.outer, cx);
    const crystal = buildCrystalAt(
      rng, cx, crestY, height, halfWidth, tilt, rock.outer,
    );

    asm.addPart("crystal", crystal, [], {
      buildSequence: 100 + i,
      tiltDeg: (rng() - 0.5) * imperfection * 4,
    });
  }

  return asm.build("crystals", seed, style, {
    crystalCount,
    fallenCount: 0,
    floatCount: 0,
    layoutWidth,
    rockHeight: rockDepth,
    clusterHeight: maxCrystalHeight + rockDepth,
    localCentroidRatio: crystalCxSum / (crystalCount * layoutWidth),
    rockCenterX: rockCx / layoutWidth,
    imperfection,
    normalizeScaleBy: "height",
  });
}
