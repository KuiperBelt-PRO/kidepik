/**
 * Capa de render para elementos de fantasía.
 *
 * Ciclo de vida de cada elemento:
 *   seeded → building → holding → eroding → gone
 *
 * Usa rAF + transform SVG para la animación de construcción (de abajo a arriba)
 * y un clipPath rectangular animado para la erosión (solo vertical, sin
 * estrechar el zócalo por los lados).
 *
 * @module loader-fantasy-render
 */

import { erosionThresholdAt, planLifecycleTiming } from "./loader-fantasy-element.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** @param {number} n */
function fmt(n) {
  return String(Math.round(n * 10) / 10);
}

/**
 * Easing con ligero overshoot (ease-out back).
 * @param {number} t  0..1
 */
function easeOutBack(t) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Aplica `transform` SVG de escala (y opcional inclinación) desde el pivote
 * (pivotX, pivotY) en user units. scaleY=0 colapsa el elemento hacia su base.
 * @param {SVGElement} g
 * @param {number} pivotX
 * @param {number} pivotY
 * @param {number} sy
 * @param {number} [tiltDeg]  rotación residual de imperfección alrededor del pivote
 */
function applyPartScale(g, pivotX, pivotY, sy, tiltDeg = 0) {
  const s = Math.max(0, sy);
  // La rotación de imperfección usa y=100 como pivote (suelo del viewBox),
  // igual para todas las piezas — torre y remate giran alrededor del mismo
  // punto y permanecen alineados aunque el eje de escala de cada pieza sea
  // su propio baseY.
  const rot = tiltDeg ? ` rotate(${fmt(tiltDeg)} ${fmt(pivotX)} 100)` : "";
  g.setAttribute(
    "transform",
    `translate(${fmt(pivotX)} ${fmt(pivotY)}) scale(1 ${fmt(s)}) translate(${fmt(-pivotX)} ${fmt(-pivotY)})${rot}`,
  );
}

/**
 * Crea el marcado SVG del elemento (defs + partes), sin el clip de erosión.
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {{ svg: SVGSVGElement; partsGroup: SVGGElement; partGs: SVGGElement[] }}
 */
function createElementSvg(element) {
  const svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, "svg"));
  svg.setAttribute("viewBox", element.viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("loader-fantasy-el__svg");

  const partsGroup = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, "g"));
  partsGroup.classList.add("loader-fantasy-el__parts");
  svg.appendChild(partsGroup);

  const partGs = element.parts.map((part) => {
    const g = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, "g"));
    g.classList.add("loader-fantasy-part");
    g.dataset.role = part.role;

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", part.d);
    if (part.stroke) {
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#fff");
      path.setAttribute("stroke-width", String(part.strokeWidth ?? 2));
      path.setAttribute("vector-effect", "non-scaling-stroke");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      g.classList.add("loader-fantasy-part--stroke");
    } else {
      path.setAttribute("fill", "#fff");
      path.setAttribute("fill-rule", "evenodd");
    }
    g.appendChild(path);

    partsGroup.appendChild(g);
    return g;
  });

  return { svg, partsGroup, partGs };
}

/** Padding alrededor del contenido para el clip de erosión (trazo, antialias). */
const EROSION_CLIP_PAD_X = 14;
const EROSION_CLIP_PAD_Y = 10;

/**
 * @param {import('./loader-fantasy-element.js').FantasyPart[]} parts
 * @returns {{ minX: number; minY: number; maxX: number; maxY: number }}
 */
export function svgBoundsFromParts(parts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const part of parts) {
    const nums = part.d.match(/-?[\d.]+/g)?.map(Number) ?? [];
    for (let i = 0; i < nums.length; i += 2) {
      const x = nums[i];
      const y = nums[i + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }
  return { minX, minY, maxX, maxY };
}

/**
 * @param {import('./loader-fantasy-element.js').FantasyPart[]} parts
 * @returns {{ x: number; width: number; yMin: number; yMax: number }}
 */
export function erosionClipBoundsFromParts(parts) {
  const { minX, minY, maxX, maxY } = svgBoundsFromParts(parts);
  return {
    x: minX - EROSION_CLIP_PAD_X,
    width: (maxX - minX) + EROSION_CLIP_PAD_X * 2,
    yMin: minY - EROSION_CLIP_PAD_Y,
    yMax: maxY + EROSION_CLIP_PAD_Y,
  };
}

/**
 * Rectángulo de clip para un umbral de erosión 0..1 (0 = intacto, 1 = borrado).
 * Solo recorta en Y; el ancho se toma del bounding box real del elemento.
 * @param {number} threshold
 * @param {{ x: number; width: number; yMin: number; yMax: number }} bounds
 * @returns {{ x: number; y: number; width: number; height: number }}
 */
export function erosionClipRectForThreshold(threshold, bounds) {
  const t = Math.min(1, Math.max(0, threshold));
  const frontY = bounds.yMin + t * (bounds.yMax - bounds.yMin);
  return {
    x: bounds.x,
    width: bounds.width,
    y: frontY,
    height: Math.max(0, bounds.yMax - frontY),
  };
}

/**
 * @param {SVGRectElement} clipRect
 * @param {number} threshold
 * @param {{ x: number; width: number; yMin: number; yMax: number }} bounds
 */
function applyErosionClipRect(clipRect, threshold, bounds) {
  const { x, y, width, height } = erosionClipRectForThreshold(threshold, bounds);
  clipRect.setAttribute("x", String(x));
  clipRect.setAttribute("width", String(width));
  clipRect.setAttribute("y", String(y));
  clipRect.setAttribute("height", String(height));
}

/**
 * Crea e inserta en el SVG la infraestructura de clip de erosión.
 * El progreso se controla actualizando el rect del clipPath vía rAF.
 * @param {SVGSVGElement} svg
 * @param {SVGGElement} partsGroup
 * @param {number} seed
 * @param {{ x: number; width: number; yMin: number; yMax: number }} bounds
 * @returns {{ clipRect: SVGRectElement; bounds: { x: number; width: number; yMin: number; yMax: number } }}
 */
function createErosionClip(svg, partsGroup, seed, bounds) {
  const uid = `fe-${(seed >>> 0).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const defs = document.createElementNS(SVG_NS, "defs");

  const clipPath = document.createElementNS(SVG_NS, "clipPath");
  clipPath.id = `ec-${uid}`;
  clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");

  const clipRect = /** @type {SVGRectElement} */ (document.createElementNS(SVG_NS, "rect"));
  applyErosionClipRect(clipRect, 0, bounds);

  clipPath.appendChild(clipRect);
  defs.appendChild(clipPath);
  svg.insertBefore(defs, svg.firstChild);

  partsGroup.setAttribute("clip-path", `url(#ec-${uid})`);

  return { clipRect, bounds };
}

/**
 * Monta un FantasyElement en el `container` y gestiona su ciclo de vida.
 *
 * @param {HTMLElement} container
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @param {{
 *   reducedMotion?: boolean;
 *   xPercent: number;        0..100
 *   sizePx: number;          tamaño CSS del lado del SVG en px (equivale a altura deseada)
 *   terrainHeightPx: number; altura en px de la franja de terreno
 *   timing?: ReturnType<import('./loader-fantasy-element.js').planLifecycleTiming>;
 *   onGone?: () => void;
 * }} opts
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyElement(container, element, opts) {
  const {
    reducedMotion = false,
    xPercent,
    sizePx,
    terrainHeightPx,
    onGone,
  } = opts;

  const timing = opts.timing ?? planLifecycleTiming(element.seed, element.kind, element.parts.length);

  let destroyed = false;
  let rafId = 0;
  let phaseTimer = 0;

  // ─── Contenedor del elemento ─────────────────────────────────────────────
  const el = document.createElement("div");
  el.className = "loader-fantasy-el";
  el.style.left = `${xPercent}%`;
  // El borde inferior del viewBox queda anclado al fondo de la pantalla (suelo).
  el.style.bottom = "0";

  // El viewBox es cuadrado (0 0 100 100) con el contenido anclado abajo (y=100).
  // Caja cuadrada + preserveAspectRatio xMidYMax: el borde inferior dibujado
  // coincide SIEMPRE con el fondo de la caja → nunca flota.
  const svgH = sizePx;
  const svgW = sizePx;
  el.style.width = `${svgW}px`;
  el.style.height = `${svgH}px`;

  const { svg, partsGroup, partGs } = createElementSvg(element);
  svg.setAttribute("preserveAspectRatio", "xMidYMax meet");
  svg.style.width = `${svgW}px`;
  svg.style.height = `${svgH}px`;
  el.appendChild(svg);
  container.appendChild(el);

  // ─── Inicializar partes con escala 0 ──────────────────────────────────────
  element.parts.forEach((part, i) => {
    applyPartScale(partGs[i], part.centerX, part.baseY, 0, part.tiltDeg ?? 0);
  });

  // ─── Función de limpieza ──────────────────────────────────────────────────
  function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    clearTimeout(phaseTimer);
    el.remove();
  }

  // ─── Reduced motion: fade simple ─────────────────────────────────────────
  if (reducedMotion) {
    el.style.transition = "opacity 400ms ease";
    el.style.opacity = "0";
    element.parts.forEach((part, i) => {
      applyPartScale(partGs[i], part.centerX, part.baseY, 1, part.tiltDeg ?? 0);
    });
    // Force reflow
    void el.offsetHeight;
    el.style.opacity = "1";

    phaseTimer = setTimeout(() => {
      if (destroyed) return;
      el.style.opacity = "0";
      phaseTimer = setTimeout(() => {
        destroy();
        onGone?.();
      }, 500);
    }, timing.holdMs);

    return { destroy };
  }

  // ─── Fase BUILDING ────────────────────────────────────────────────────────
  const STROKE_PART_DURATION_FACTOR = 0.15;
  const STROKE_PART_OVERLAP = 0.92;
  const STROKE_PART_MIN_MS = 70;
  /** @type {{ g: SVGGElement; part: import('./loader-fantasy-element.js').FantasyPart; startMs: number; durationMs: number; done: boolean }[]} */
  const buildInfos = [];
  const overlapFactor = 0.28;

  for (const part of element.parts) {
    const i = part.buildOrder;
    const stroke = !!part.stroke;
    buildInfos.push({
      g: partGs[i],
      part,
      startMs: 0,
      durationMs: stroke
        ? Math.max(STROKE_PART_MIN_MS, Math.round(timing.partDurationMs * STROKE_PART_DURATION_FACTOR))
        : timing.partDurationMs,
      done: false,
    });
  }

  // Calcular delays acumulados (trazos: solape alto para apilar rápido)
  let accDelay = 0;
  buildInfos.forEach((info, i) => {
    if (i === 0) {
      info._delay = 0;
      return;
    }
    const prev = buildInfos[i - 1];
    const overlap = prev.part.stroke && info.part.stroke
      ? STROKE_PART_OVERLAP
      : overlapFactor;
    accDelay += prev.durationMs * (1 - overlap);
    info._delay = accDelay;
  });

  let buildStartMs = 0;

  function tickBuild(now) {
    if (destroyed) return;
    if (buildStartMs === 0) buildStartMs = now;

    let allDone = true;
    for (const info of buildInfos) {
      if (info.done) continue;
      const elapsed = now - buildStartMs - (info._delay ?? 0);
      if (elapsed < 0) {
        allDone = false;
        continue;
      }
      const t = Math.min(1, elapsed / info.durationMs);
      const sy = easeOutBack(t);
      const tilt = (info.part.tiltDeg ?? 0) * t;
      applyPartScale(info.g, info.part.centerX, info.part.baseY, sy, tilt);
      if (t >= 1) {
        info.done = true;
        applyPartScale(info.g, info.part.centerX, info.part.baseY, 1, info.part.tiltDeg ?? 0);
      } else {
        allDone = false;
      }
    }

    if (!allDone) {
      rafId = requestAnimationFrame(tickBuild);
      return;
    }

    // ─── Fase HOLDING ─────────────────────────────────────────────────────
    phaseTimer = setTimeout(() => {
      if (destroyed) return;
      startEroding();
    }, timing.holdMs);
  }

  // ─── Fase ERODING ────────────────────────────────────────────────────────
  function startEroding() {
    if (destroyed) return;

    const erosionBounds = erosionClipBoundsFromParts(element.parts);
    const { clipRect } = createErosionClip(svg, partsGroup, element.seed, erosionBounds);

    let erodeStartMs = 0;

    function tickErode(now) {
      if (destroyed) return;
      if (erodeStartMs === 0) erodeStartMs = now;

      const elapsed = now - erodeStartMs;
      const tRaw = Math.min(1, elapsed / timing.erodeMs);
      const threshold = erosionThresholdAt(tRaw);

      applyErosionClipRect(clipRect, threshold, erosionBounds);

      if (tRaw >= 1) {
        destroy();
        onGone?.();
        return;
      }

      rafId = requestAnimationFrame(tickErode);
    }

    rafId = requestAnimationFrame(tickErode);
  }

  // ─── Arranque ─────────────────────────────────────────────────────────────
  rafId = requestAnimationFrame(tickBuild);

  return { destroy };
}
