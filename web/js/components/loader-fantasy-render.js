/**
 * Capa de render para elementos de fantasía.
 *
 * Ciclo de vida de cada elemento:
 *   seeded → building → holding → eroding → gone
 *
 * Usa rAF + transform SVG para la animación de construcción (de abajo a arriba)
 * y una máscara SVG con feTurbulence + gradiente lineal para la erosión.
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
 * Crea el marcado SVG del elemento (defs + partes), sin la máscara de erosión.
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
    path.setAttribute("fill", "#fff");
    path.setAttribute("fill-rule", "evenodd");
    g.appendChild(path);

    partsGroup.appendChild(g);
    return g;
  });

  return { svg, partsGroup, partGs };
}

/**
 * Crea e inserta en el SVG la infraestructura de máscara de erosión.
 * El progreso se controla actualizando los stops del gradiente vía rAF.
 * @param {SVGSVGElement} svg
 * @param {SVGGElement} partsGroup
 * @param {number} seed
 * @returns {{ stopB: SVGStopElement; stopC: SVGStopElement }}
 */
function createErosionMask(svg, partsGroup, seed) {
  const uid = `fe-${(seed >>> 0).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const defs = document.createElementNS(SVG_NS, "defs");

  // Gradiente lineal vertical: define un frente CONTINUO negro(arriba)→blanco(abajo).
  // El borde de transición es estrecho (sharp) y al desplazarlo con ruido de baja
  // frecuencia se convierte en una línea ondulada conexa, sin islas blancas.
  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.id = `eg-${uid}`;
  grad.setAttribute("gradientUnits", "userSpaceOnUse");
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "-10");
  grad.setAttribute("x2", "0");
  grad.setAttribute("y2", "110");

  // stop inicial: negro fijo en top
  const stopA = document.createElementNS(SVG_NS, "stop");
  stopA.setAttribute("offset", "0");
  stopA.setAttribute("stop-color", "black");

  // stop dinámico: final del frente negro (erosionado)
  const stopB = /** @type {SVGStopElement} */ (document.createElementNS(SVG_NS, "stop"));
  stopB.setAttribute("offset", "0");
  stopB.setAttribute("stop-color", "black");

  // stop dinámico: inicio del área blanca (intacta) — mismo offset que stopB
  // para un frente duro sin difuminado.
  const stopC = /** @type {SVGStopElement} */ (document.createElementNS(SVG_NS, "stop"));
  stopC.setAttribute("offset", "0");
  stopC.setAttribute("stop-color", "white");

  // stop final: blanco fijo en bottom
  const stopD = document.createElementNS(SVG_NS, "stop");
  stopD.setAttribute("offset", "1");
  stopD.setAttribute("stop-color", "white");

  grad.append(stopA, stopB, stopC, stopD);

  // Filtro: ruido de BAJA frecuencia → ondula el frente de forma continua.
  // numOctaves=2 y freq baja evitan el detalle fino que generaba islas tipo "fuego".
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = `ef-${uid}`;
  filter.setAttribute("x", "-40%");
  filter.setAttribute("y", "-40%");
  filter.setAttribute("width", "180%");
  filter.setAttribute("height", "180%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const turbulence = document.createElementNS(SVG_NS, "feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  // Frecuencia muy baja: grandes ondulaciones del frente, no granulado
  turbulence.setAttribute("baseFrequency", "0.018 0.012");
  turbulence.setAttribute("numOctaves", "2");
  turbulence.setAttribute("seed", String((seed ^ 0x7f3c) & 0xffff));
  turbulence.setAttribute("result", "noise");

  const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
  disp.setAttribute("in", "SourceGraphic");
  disp.setAttribute("in2", "noise");
  // Desplazamiento vertical generoso para un barrido irregular pero conexo
  disp.setAttribute("scale", "26");
  disp.setAttribute("xChannelSelector", "R");
  disp.setAttribute("yChannelSelector", "G");

  filter.append(turbulence, disp);

  // Máscara: rect relleno con el gradiente + turbulencia
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.id = `em-${uid}`;
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  mask.setAttribute("x", "-20");
  mask.setAttribute("y", "-20");
  mask.setAttribute("width", "140");
  mask.setAttribute("height", "140");

  const maskRect = document.createElementNS(SVG_NS, "rect");
  maskRect.setAttribute("x", "-20");
  maskRect.setAttribute("y", "-20");
  maskRect.setAttribute("width", "140");
  maskRect.setAttribute("height", "140");
  maskRect.setAttribute("fill", `url(#eg-${uid})`);
  maskRect.setAttribute("filter", `url(#ef-${uid})`);

  mask.appendChild(maskRect);
  defs.append(grad, filter, mask);
  svg.insertBefore(defs, svg.firstChild);

  // Aplicar la máscara al grupo de partes
  partsGroup.setAttribute("mask", `url(#em-${uid})`);

  return { stopB, stopC, turbulence, disp };
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
  /** @type {{ g: SVGGElement; part: import('./loader-fantasy-element.js').FantasyPart; startMs: number; durationMs: number; done: boolean }[]} */
  const buildInfos = [];
  const overlapFactor = 0.28;
  let cumulativeDelayMs = 0;

  for (const part of element.parts) {
    const i = part.buildOrder;
    buildInfos.push({
      g: partGs[i],
      part,
      startMs: 0, // se rellena en el primer tick
      durationMs: timing.partDurationMs,
      done: false,
    });
    if (i === 0) {
      cumulativeDelayMs = 0;
    } else {
      cumulativeDelayMs += timing.partDurationMs * (1 - overlapFactor);
    }
  }

  // Calcular delays acumulados
  let accDelay = 0;
  buildInfos.forEach((info, i) => {
    if (i === 0) {
      info._delay = 0;
    } else {
      accDelay += timing.partDurationMs * (1 - overlapFactor);
      info._delay = accDelay;
    }
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

    const { stopB, stopC } = createErosionMask(svg, partsGroup, element.seed);

    let erodeStartMs = 0;
    // delta=0 → frente duro (sin banda de difuminado); la irregularidad
    // la aporta solo el feDisplacementMap de baja frecuencia.
    const delta = 0;

    function tickErode(now) {
      if (destroyed) return;
      if (erodeStartMs === 0) erodeStartMs = now;

      const elapsed = now - erodeStartMs;
      const tRaw = Math.min(1, elapsed / timing.erodeMs);
      const threshold = erosionThresholdAt(tRaw);

      stopB.setAttribute("offset", String(threshold));
      stopC.setAttribute("offset", String(threshold));

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
