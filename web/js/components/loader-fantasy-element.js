/**
 * Motor de generación de elementos de fantasía.
 *
 * Expone:
 *  - `generateFantasyElement(kind, options)` → FantasyElement
 *  - `isValidFantasyElement(el)` → boolean
 *  - `planBuildOrder(parts)` → FantasyPart[] ordenado
 *  - `planLifecycleTiming(seed, kind, partCount)` → tiempos
 *  - `erosionThresholdAt(t, seed?)` → 0..1 (velocidad variable)
 *  - `ElementAssembler` → helper para builders
 *  - `FANTASY_BUILDERS` → registro de builders
 *
 * @module loader-fantasy-element
 */

import { generateCastle } from "./loader-fantasy-castle.js";
import { generateCliffs } from "./loader-fantasy-cliffs.js";
import { generateCrystals } from "./loader-fantasy-crystals.js";
import { generateForest } from "./loader-fantasy-forest.js";
import {
  aperture,
  buildPartPath,
  gableRoof,
  jitterRing,
  merlons,
  normalizeFantasyGroups,
  normalizeFantasyWallGroups,
  rect,
} from "./loader-fantasy-geom.js";
import { createRng, randRange } from "./loader-ship-rng.js";

/**
 * @typedef {'block'|'castle'|'palace'|'cliffs'|'tower'|'village'|'town'|'inn'|'forest'|'crystals'|'portal'|'menhir'|'dolmen'|'stoneCircle'} FantasyKind
 */

/**
 * @typedef {{
 *   id: string;
 *   role: string;
 *   d: string;
 *   baseY: number;
 *   centerX: number;
 *   buildOrder: number;
 *   tiltDeg?: number;
 *   stroke?: boolean;
 *   strokeWidth?: number;
 *   buildSequence?: number;
 *   treeIndex?: number;
 * }} FantasyPart
 */

/**
 * @typedef {{
 *   kind: FantasyKind;
 *   style: string;
 *   seed: number;
 *   viewBox: '0 0 100 100';
 *   parts: FantasyPart[];
 *   width: number;
 *   height: number;
 *   footprint: number;
 *   meta: Record<string, unknown>;
 * }} FantasyElement
 */

// ---------------------------------------------------------------------------
// ElementAssembler
// ---------------------------------------------------------------------------

/**
 * Helper que acumula partes en espacio local y-up y las normaliza al construir.
 * Los builders lo usan para producir un FantasyElement.
 */
export class ElementAssembler {
  constructor() {
    /** @type {{ role: string; outer: import('./loader-fantasy-geom.js').FPoint[]; holes: import('./loader-fantasy-geom.js').FPoint[][]; tiltDeg?: number; stroke?: boolean; buildSequence?: number; treeIndex?: number; smoothOutline?: boolean }[]} */
    this._parts = [];
  }

  /**
   * Añade una parte al ensamblador.
   * @param {string} role
   * @param {import('./loader-fantasy-geom.js').FPoint[]} outer
   * @param {import('./loader-fantasy-geom.js').FPoint[][]} [holes]
   * @param {{ tiltDeg?: number; stroke?: boolean; strokeWidth?: number; buildSequence?: number; treeIndex?: number; smoothOutline?: boolean }} [opts]
   */
  addPart(role, outer, holes = [], opts = {}) {
    this._parts.push({
      role,
      outer,
      holes,
      tiltDeg: opts.tiltDeg,
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
      buildSequence: opts.buildSequence,
      treeIndex: opts.treeIndex,
      smoothOutline: opts.smoothOutline,
    });
  }

  /**
   * Normaliza todo junto y devuelve el FantasyElement.
   * @param {FantasyKind} kind
   * @param {number} seed
   * @param {string} style
   * @param {Record<string, unknown>} [meta]
   * @param {{ scaleBy?: 'max' | 'height' }} [normalizeOpts]
   * @returns {FantasyElement}
   */
  build(kind, seed, style = "white", meta = {}, normalizeOpts = {}) {
    if (this._parts.length === 0) {
      return { kind, style, seed, viewBox: "0 0 100 100", parts: [], width: 0, height: 0, footprint: 0, meta };
    }

    const scaleBy = /** @type {'max'|'height'} */ (
      normalizeOpts.scaleBy
      ?? (meta.normalizeScaleBy === "height" ? "height" : "max")
    );
    const bottomInset = Number(meta.normalizeBottomInset) || normalizeOpts.bottomInset || 0;
    const heightFloor = Number(meta.normalizeHeightFloor) || normalizeOpts.heightFloor || 0;

    // Recoger todos los anillos para normalización conjunta
    /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
    const allRings = [];
    /** @type {{ outerIdx: number; holeIdxs: number[]; role: string; tiltDeg?: number; stroke?: boolean; strokeWidth?: number; buildSequence?: number; treeIndex?: number; smoothOutline?: boolean }[]} */
    const partMeta = [];

    for (const p of this._parts) {
      const outerIdx = allRings.length;
      allRings.push(p.outer);
      const holeIdxs = p.holes.map((h) => {
        const i = allRings.length;
        allRings.push(h);
        return i;
      });
      partMeta.push({
        outerIdx,
        holeIdxs,
        role: p.role,
        tiltDeg: p.tiltDeg,
        stroke: p.stroke,
        strokeWidth: p.strokeWidth,
        buildSequence: p.buildSequence,
        treeIndex: p.treeIndex,
        smoothOutline: p.smoothOutline,
      });
    }

    const anchorX = meta.normalizeAnchorX === "left" || meta.normalizeAnchorX === "right"
      ? meta.normalizeAnchorX
      : "center";

    const wallSide = meta.normalizeMode === "wallSeam" && (meta.side === "left" || meta.side === "right")
      ? /** @type {'left'|'right'} */ (meta.side)
      : null;

    const normalized = wallSide
      ? normalizeFantasyWallGroups(allRings, {
        side: wallSide,
        bottomInset,
        heightFloor,
      })
      : normalizeFantasyGroups(allRings, {
        anchorY: "bottom",
        scaleBy,
        bottomInset,
        heightFloor,
        anchorX,
      });

    /** @type {FantasyPart[]} */
    const parts = partMeta.map((pm, partIdx) => {
      const normOuter = normalized[pm.outerIdx];
      const normHoles = pm.holeIdxs.map((i) => normalized[i]);
      const pathOpts = {
        open: Boolean(pm.stroke),
        smooth: Boolean(pm.smoothOutline),
      };
      const d = buildPartPath(normOuter, normHoles, pathOpts);

      // baseY SVG = max y del anillo exterior (= parte inferior de la forma en SVG y-down)
      const ys = normOuter.map((p) => p.y);
      const xs = normOuter.map((p) => p.x);
      const baseY = Math.max(...ys);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;

      return {
        id: `${pm.role}-${partIdx}`,
        role: pm.role,
        d,
        baseY,
        centerX,
        buildOrder: 0,
        tiltDeg: pm.tiltDeg,
        stroke: pm.stroke,
        strokeWidth: pm.strokeWidth,
        buildSequence: pm.buildSequence,
        treeIndex: pm.treeIndex,
      };
    });

    const ordered = planBuildOrder(parts);

    // Bounds del elemento completo
    const allPts = normalized.flat();
    const allXs = allPts.map((p) => p.x);
    const allYs = allPts.map((p) => p.y);
    const width = allPts.length ? Math.max(...allXs) - Math.min(...allXs) : 0;
    const height = allPts.length ? Math.max(...allYs) - Math.min(...allYs) : 0;

    return {
      kind,
      style,
      seed,
      viewBox: "0 0 100 100",
      parts: ordered,
      width,
      height,
      footprint: width,
      meta,
    };
  }
}

// ---------------------------------------------------------------------------
// planBuildOrder
// ---------------------------------------------------------------------------

/**
 * Asigna `buildOrder` a las partes: mayor `baseY` SVG → menor buildOrder (suelo primero).
 * Devuelve un nuevo array ordenado por buildOrder; no muta el original.
 * @param {FantasyPart[]} parts
 * @returns {FantasyPart[]}
 */
export function planBuildOrder(parts) {
  const sorted = [...parts].sort((a, b) => {
    if (b.baseY !== a.baseY) return b.baseY - a.baseY;
    return (a.buildSequence ?? 0) - (b.buildSequence ?? 0);
  });
  sorted.forEach((p, i) => {
    p.buildOrder = i;
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// planLifecycleTiming
// ---------------------------------------------------------------------------

/**
 * Genera los tiempos del ciclo de vida de un elemento.
 * Determinista para la misma combinación seed+kind+partCount.
 * @param {number} seed
 * @param {FantasyKind} kind
 * @param {number} _partCount  reservado para futuras variaciones por complejidad
 * @returns {{ partDurationMs: number; holdMs: number; erodeMs: number; gapMs: number }}
 */
export function planLifecycleTiming(seed, kind, _partCount) {
  const rng = createRng((seed ^ 0x4f3a9c2b) >>> 0);
  if (kind === "cliffs") {
    return {
      partDurationMs: Math.round(randRange(rng, 520, 780)),
      holdMs: Math.round(randRange(rng, 9000, 15000)),
      erodeMs: Math.round(randRange(rng, 13000, 20000)),
      gapMs: Math.round(randRange(rng, 2500, 5000)),
    };
  }
  if (kind === "forest") {
    return {
      partDurationMs: Math.round(randRange(rng, 240, 420)),
      holdMs: Math.round(randRange(rng, 16000, 26000)),
      erodeMs: Math.round(randRange(rng, 5500, 9000)),
      gapMs: Math.round(randRange(rng, 900, 2200)),
    };
  }
  if (kind === "crystals") {
    return {
      partDurationMs: Math.round(randRange(rng, 160, 280)),
      holdMs: Math.round(randRange(rng, 2500, 4500)),
      erodeMs: Math.round(randRange(rng, 1400, 2000)),
      gapMs: Math.round(randRange(rng, 400, 1200)),
    };
  }
  const partDurationMs = Math.round(randRange(rng, 580, 920));
  const holdMs = Math.round(randRange(rng, 2000, 5500));
  const erodeMs = Math.round(randRange(rng, 7000, 11000));
  const gapMs = Math.round(randRange(rng, 300, 1400));
  return { partDurationMs, holdMs, erodeMs, gapMs };
}

// ---------------------------------------------------------------------------
// erosionThresholdAt
// ---------------------------------------------------------------------------

const EROSION_SPEED_SEGMENTS = 6;

/**
 * Segmentos de velocidad para la erosión (determinista por seed).
 * @param {number} seed
 * @returns {{ dur: number; speed: number }[]}
 */
export function buildErosionSpeedSegments(seed) {
  const rng = createRng((seed ^ 0xe7a91c3b) >>> 0);
  /** @type {{ dur: number; speed: number }[]} */
  const segments = [];
  for (let i = 0; i < EROSION_SPEED_SEGMENTS; i++) {
    segments.push({
      dur: 0.35 + rng() * 1.25,
      speed: 0.3 + rng() * 1.7,
    });
  }
  const durSum = segments.reduce((s, seg) => s + seg.dur, 0);
  for (const seg of segments) seg.dur /= durSum;
  return segments;
}

/**
 * Progreso del frente de erosión 0..1 (0 = intacto, 1 = borrado).
 * El tiempo `t` avanza linealmente; la velocidad del frente varía por segmentos.
 * @param {number} t  progreso temporal 0..1
 * @param {number} [seed]  semilla del elemento (velocidad irregular)
 * @returns {number}
 */
export function erosionThresholdAt(t, seed = 0) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const segments = buildErosionSpeedSegments(seed);
  let timeLeft = t;
  let weightedProgress = 0;
  let totalWeight = 0;
  for (const seg of segments) totalWeight += seg.dur * seg.speed;

  for (const seg of segments) {
    if (timeLeft <= seg.dur) {
      weightedProgress += timeLeft * seg.speed;
      const raw = weightedProgress / totalWeight;
      return Math.pow(raw, 1.1);
    }
    timeLeft -= seg.dur;
    weightedProgress += seg.dur * seg.speed;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Builder 'block' (Phase 0 — elemento de prueba)
// ---------------------------------------------------------------------------

/**
 * Builder 'block': bloque rectangular con una ventana simple.
 * Usado en Phase 0 para validar el motor de animación.
 * @param {number} seed
 * @returns {FantasyElement}
 */
function buildBlock(seed) {
  const rng = createRng(seed);
  const asm = new ElementAssembler();

  const w = randRange(rng, 28, 48);
  const h = randRange(rng, 30, 50);
  const cx = 50;
  const baseY = 0;
  const seamOverlap = 1.6;

  const wallTop = h + seamOverlap * 0.4;
  const wallOuter = rect(cx, baseY, w, wallTop);

  // Ventana centrada (con pequeña variación)
  const winW = w * 0.2;
  const winH = h * 0.22;
  const winCxOffset = (rng() - 0.5) * w * 0.2;
  const winBaseY = h * 0.28;
  const winHole = aperture(cx + winCxOffset, winBaseY, winW, winH, "rect");

  asm.addPart("wall", wallOuter, [winHole]);

  // Tejado: solapa ligeramente el muro para evitar huecos tras normalizar
  const roofW = w * randRange(rng, 1.05, 1.15);
  const roofH = h * randRange(rng, 0.22, 0.32);
  const roofBaseY = h - seamOverlap;
  const roofOuter = gableRoof(cx, roofBaseY, roofW, roofH + seamOverlap);
  asm.addPart("roof", roofOuter);

  // Almenas opcionales (50%) — sobre el muro, solapando el tejado
  if (rng() > 0.5) {
    const merH = h * 0.09;
    const merCount = 3 + Math.floor(rng() * 3); // 3–5
    const merOuter = merlons(cx, h, w * 0.95, merCount, merH);
    asm.addPart("merlons", merOuter);
  }

  // Jitter en aristas exteriores; aristas compartidas congeladas (sin huecos)
  const jitterAmt = 0.28;
  for (const part of asm._parts) {
    if (part.role === "wall") {
      part.outer = jitterRing(part.outer, rng, jitterAmt, { lockY: [baseY, wallTop], freezeSeams: true });
    } else if (part.role === "roof") {
      part.outer = jitterRing(part.outer, rng, jitterAmt, { lockY: [roofBaseY], freezeSeams: true });
    } else if (part.role === "merlons") {
      part.outer = jitterRing(part.outer, rng, jitterAmt * 0.7, { lockY: [h], freezeSeams: true });
    }
  }

  return asm.build("block", seed, "white");
}

// ---------------------------------------------------------------------------
// Registro de builders
// ---------------------------------------------------------------------------

/**
 * @type {Record<FantasyKind, (seed: number) => FantasyElement>}
 */
export const FANTASY_BUILDERS = {
  block: buildBlock,
  // Phase 1 — castillos y palacios (mismo builder, palace sesga estilo)
  castle: (seed, opts = {}) => generateCastle({ ...opts, seed, palace: false }),
  palace: (seed, opts = {}) => generateCastle({ ...opts, seed, palace: true }),
  cliffs: (seed, opts = {}) => generateCliffs({ ...opts, seed, side: opts.side ?? "left" }),
  forest: (seed, opts = {}) => generateForest({ ...opts, seed }),
  crystals: (seed, opts = {}) => generateCrystals({ ...opts, seed }),
  // Phase 2+:
  tower: null,
  village: null,
  town: null,
  inn: null,
  portal: null,
  menhir: null,
  dolmen: null,
  stoneCircle: null,
};

// ---------------------------------------------------------------------------
// generateFantasyElement
// ---------------------------------------------------------------------------

/**
 * Genera un FantasyElement del tipo indicado.
 * @param {FantasyKind} kind
 * @param {{ seed: number; variant?: number }} options
 * @returns {FantasyElement | null}  null si el builder no está registrado
 */
export function generateFantasyElement(kind, options = {}) {
  const builder = FANTASY_BUILDERS[kind];
  if (!builder) return null;
  return builder(options.seed, options);
}

// ---------------------------------------------------------------------------
// isValidFantasyElement
// ---------------------------------------------------------------------------

/**
 * Valida la forma básica de un FantasyElement.
 * @param {unknown} el
 * @returns {el is FantasyElement}
 */
export function isValidFantasyElement(el) {
  if (!el || typeof el !== "object") return false;
  const e = /** @type {any} */ (el);
  if (!e.kind || typeof e.kind !== "string") return false;
  if (e.viewBox !== "0 0 100 100") return false;
  if (!Array.isArray(e.parts) || e.parts.length === 0) return false;
  if (!Number.isFinite(e.width) || e.width < 0) return false;
  if (!Number.isFinite(e.height) || e.height < 0) return false;
  for (const part of e.parts) {
    if (!part.id || !part.role) return false;
    if (typeof part.d !== "string" || !part.d.includes("M")) return false;
    if (!Number.isFinite(part.baseY)) return false;
    if (!Number.isFinite(part.buildOrder)) return false;
  }
  return true;
}
