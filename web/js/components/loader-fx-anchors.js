/**
 * Extracción de anclas FX desde paths SVG normalizados.
 *
 * @module loader-fx-anchors
 */

import { createRng, randRange } from "./loader-ship-rng.js";

/**
 * Parsea el primer subpath cerrado de un `d` SVG.
 * @param {string} d
 * @returns {{ x: number; y: number }[]}
 */
export function parsePathOuterRing(d) {
  if (!d) return [];
  const subpaths = d.trim().split(/\s*(?=M\s)/i).filter(Boolean);
  const first = subpaths[0] ?? d;
  const nums = first.match(/-?[\d.]+/g)?.map(Number) ?? [];
  /** @type {{ x: number; y: number }[]} */
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return dedupeAdjacentPoints(pts);
}

/**
 * @param {{ x: number; y: number }[]} pts
 */
function dedupeAdjacentPoints(pts) {
  if (pts.length < 2) return pts;
  /** @type {{ x: number; y: number }[]} */
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    const prev = out[out.length - 1];
    const cur = pts[i];
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.05) {
      out.push(cur);
    }
  }
  return out;
}

/**
 * Vértice con menor y (punta en viewBox y-down).
 * @param {{ x: number; y: number }[]} pts
 */
export function tipFromPoints(pts) {
  if (pts.length === 0) return null;
  let best = pts[0];
  for (const p of pts) {
    if (p.y < best.y) best = p;
  }
  return best;
}

/**
 * Arista más larga del polígono (excluyendo la base: arista entre los dos vértices de mayor y).
 * @param {{ x: number; y: number }[]} pts
 * @returns {{ x: number; y: number; x2: number; y2: number; length: number } | null}
 */
export function longestCrystalEdge(pts) {
  const n = pts.length;
  if (n < 3) return null;

  const sortedByY = [...pts].sort((a, b) => b.y - a.y);
  const groundY = sortedByY[0].y;
  const groundIdx = new Set(
    pts.map((p, i) => (Math.abs(p.y - groundY) < 0.6 ? i : -1)).filter((i) => i >= 0),
  );

  let best = null;
  let bestLen = 0;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    if (groundIdx.has(i) && groundIdx.has(j)) continue;
    const a = pts[i];
    const b = pts[j];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > bestLen) {
      bestLen = len;
      best = { x: a.x, y: a.y, x2: b.x, y2: b.y, length: len };
    }
  }
  return best;
}

/**
 * @param {{ x: number; y: number }[]} tips
 */
export function clusterCoreFromTips(tips) {
  if (tips.length === 0) return null;
  const sum = tips.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / tips.length, y: sum.y / tips.length };
}

/**
 * Distancia mínima entre tips (validación).
 * @param {FxAnchor[]} tips
 */
export function minTipSeparation(tips) {
  let min = Infinity;
  for (let i = 0; i < tips.length; i += 1) {
    for (let j = i + 1; j < tips.length; j += 1) {
      const d = Math.hypot(tips[j].x - tips[i].x, tips[j].y - tips[i].y);
      if (d < min) min = d;
    }
  }
  return Number.isFinite(min) ? min : Infinity;
}

/**
 * Vértice con mayor y (base / suelo del prisma).
 * @param {{ x: number; y: number }[]} pts
 */
export function footFromPoints(pts) {
  if (pts.length === 0) return null;
  const maxY = Math.max(...pts.map((p) => p.y));
  const ground = pts.filter((p) => Math.abs(p.y - maxY) < 0.8);
  const pool = ground.length > 0 ? ground : pts;
  const x = pool.reduce((s, p) => s + p.x, 0) / pool.length;
  return { x, y: maxY };
}

/**
 * Banda horizontal interior a una fracción tip→base.
 * @param {{ x: number; y: number }[]} ring
 * @param {{ x: number; y: number }} tip
 * @param {{ x: number; y: number }} foot
 * @param {number} heightT 0..1 desde punta
 * @param {() => number} rng
 */
function reflectionBandAtHeight(ring, tip, foot, heightT, rng) {
  const y = tip.y + (foot.y - tip.y) * heightT;
  const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length;
  const near = ring.filter((p) => Math.abs(p.y - y) < 4);
  const pool = near.length >= 2 ? near : ring;
  const sorted = [...pool].sort((a, b) => a.x - b.x);
  const left = sorted[0];
  const right = sorted[sorted.length - 1];
  const inset = randRange(rng, 0.14, 0.28);
  const x1 = left.x + (cx - left.x) * inset;
  const x2 = right.x + (cx - right.x) * inset;
  const len = Math.hypot(x2 - x1, 0);
  return {
    x: x1,
    y: y + randRange(rng, -0.8, 0.8),
    x2,
    y2: y + randRange(rng, -0.8, 0.8),
    length: len,
    phase: rng() * Math.PI * 2,
  };
}

/**
 * Segmentos de reflejo interior dentro de un prisma (espacio viewBox).
 * @param {{ x: number; y: number }[]} ring
 * @param {() => number} rng
 * @returns {{ x: number; y: number; x2: number; y2: number; length: number; phase: number }[]}
 */
export function internalReflectionSegments(ring, rng) {
  const n = ring.length;
  if (n < 4) return [];

  const cx = ring.reduce((s, p) => s + p.x, 0) / n;
  const cy = ring.reduce((s, p) => s + p.y, 0) / n;
  const tip = tipFromPoints(ring);
  const foot = footFromPoints(ring);
  if (!tip || !foot) return [];

  /** @type {{ x: number; y: number; x2: number; y2: number; length: number; phase: number }[]} */
  const segments = [];

  for (const ht of [0.22, 0.42, 0.62, 0.8]) {
    const band = reflectionBandAtHeight(ring, tip, foot, ht, rng);
    if (band.length > 2.5) segments.push(band);
  }

  const axisLen = Math.hypot(foot.x - tip.x, foot.y - tip.y) || 1;
  const ux = (foot.x - tip.x) / axisLen;
  const uy = (foot.y - tip.y) / axisLen;
  const streakCount = 2 + Math.floor(rng() * 2);
  for (let s = 0; s < streakCount; s += 1) {
    const lateral = randRange(rng, -3.5, 3.5);
    const tA = randRange(rng, 0.12, 0.38);
    const tB = randRange(rng, 0.58, 0.92);
    const ox = cx + lateral * (-uy);
    const oy = cy + lateral * ux;
    segments.push({
      x: ox + ux * axisLen * tA,
      y: oy + uy * axisLen * tA,
      x2: ox + ux * axisLen * tB,
      y2: oy + uy * axisLen * tB,
      length: axisLen * (tB - tA),
      phase: rng() * Math.PI * 2,
    });
  }

  if (rng() > 0.15) {
    const i = Math.floor(rng() * n);
    const j = (i + Math.floor(n / 2)) % n;
    const a = ring[i];
    const b = ring[j];
    const inset2 = randRange(rng, 0.35, 0.62);
    segments.push({
      x: a.x + (cx - a.x) * inset2,
      y: a.y + (cy - a.y) * inset2,
      x2: b.x + (cx - b.x) * inset2,
      y2: b.y + (cy - b.y) * inset2,
      length: Math.hypot(b.x - a.x, b.y - a.y) * (1 - inset2),
      phase: rng() * Math.PI * 2,
    });
  }

  return segments.filter((seg) => seg.length > 2.5);
}
