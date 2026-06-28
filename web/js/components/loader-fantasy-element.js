/**
 * Motor de generación de elementos de fantasía.
 *
 * Expone:
 *  - `generateFantasyElement(kind, options)` → FantasyElement
 *  - `isValidFantasyElement(el)` → boolean
 *  - `planBuildOrder(parts)` → FantasyPart[] ordenado
 *  - `planLifecycleTiming(seed, kind, partCount)` → tiempos
 *  - `erosionThresholdAt(t)` → 0..1
 *  - `ElementAssembler` → helper para builders
 *  - `FANTASY_BUILDERS` → registro de builders
 *
 * @module loader-fantasy-element
 */

import { generateCastle } from "./loader-fantasy-castle.js";
import {
  aperture,
  buildPartPath,
  gableRoof,
  jitterRing,
  merlons,
  normalizeFantasyGroups,
  rect,
} from "./loader-fantasy-geom.js";
import { createRng, randRange } from "./loader-ship-rng.js";

// ---------------------------------------------------------------------------
// Tipos (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {'block'|'castle'|'palace'|'tower'|'village'|'town'|'inn'|'forest'|'crystals'|'portal'|'menhir'|'dolmen'|'stoneCircle'} FantasyKind
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
    /** @type {{ role: string; outer: import('./loader-fantasy-geom.js').FPoint[]; holes: import('./loader-fantasy-geom.js').FPoint[][]; tiltDeg?: number }[]} */
    this._parts = [];
  }

  /**
   * Añade una parte al ensamblador.
   * @param {string} role
   * @param {import('./loader-fantasy-geom.js').FPoint[]} outer
   * @param {import('./loader-fantasy-geom.js').FPoint[][]} [holes]
   * @param {{ tiltDeg?: number }} [opts]
   */
  addPart(role, outer, holes = [], opts = {}) {
    this._parts.push({ role, outer, holes, tiltDeg: opts.tiltDeg });
  }

  /**
   * Normaliza todo junto y devuelve el FantasyElement.
   * @param {FantasyKind} kind
   * @param {number} seed
   * @param {string} style
   * @param {Record<string, unknown>} [meta]
   * @returns {FantasyElement}
   */
  build(kind, seed, style = "white", meta = {}) {
    if (this._parts.length === 0) {
      return { kind, style, seed, viewBox: "0 0 100 100", parts: [], width: 0, height: 0, footprint: 0, meta };
    }

    // Recoger todos los anillos para normalización conjunta
    /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
    const allRings = [];
    /** @type {{ outerIdx: number; holeIdxs: number[]; role: string; tiltDeg?: number }[]} */
    const partMeta = [];

    for (const p of this._parts) {
      const outerIdx = allRings.length;
      allRings.push(p.outer);
      const holeIdxs = p.holes.map((h) => {
        const i = allRings.length;
        allRings.push(h);
        return i;
      });
      partMeta.push({ outerIdx, holeIdxs, role: p.role, tiltDeg: p.tiltDeg });
    }

    const normalized = normalizeFantasyGroups(allRings);

    /** @type {FantasyPart[]} */
    const parts = partMeta.map((pm, partIdx) => {
      const normOuter = normalized[pm.outerIdx];
      const normHoles = pm.holeIdxs.map((i) => normalized[i]);
      const d = buildPartPath(normOuter, normHoles);

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
        buildOrder: 0, // se asigna en planBuildOrder
        tiltDeg: pm.tiltDeg,
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
  const sorted = [...parts].sort((a, b) => b.baseY - a.baseY);
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
  // Mezclar seed con una constante para independizarlo del RNG de geometría
  const rng = createRng((seed ^ 0x4f3a9c2b) >>> 0);
  const partDurationMs = Math.round(randRange(rng, 580, 920));
  const holdMs = Math.round(randRange(rng, 2000, 5500));
  const erodeMs = Math.round(randRange(rng, 7000, 11000));
  const gapMs = Math.round(randRange(rng, 300, 1400));
  return { partDurationMs, holdMs, erodeMs, gapMs };
}

// ---------------------------------------------------------------------------
// erosionThresholdAt
// ---------------------------------------------------------------------------

/**
 * Curva de progreso de erosión (ease-in suave).
 * @param {number} t  progreso temporal 0..1
 * @returns {number}  posición del frente de erosión 0..1 (0 = intacto, 1 = borrado)
 */
export function erosionThresholdAt(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // Potencia 1.15: descenso casi constante del frente (no acelera tipo llama)
  return Math.pow(t, 1.15);
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
  // Phase 2+:
  tower: null,
  village: null,
  town: null,
  inn: null,
  forest: null,
  crystals: null,
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
 * @param {{ seed: number }} options
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
