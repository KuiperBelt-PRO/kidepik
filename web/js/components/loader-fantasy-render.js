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
import { subscribeLoaderAnimationFrame } from "./loader-animation-frame.js";
import { planFxRecipe } from "./loader-fx-engine.js";
import { mountFxBundle } from "./loader-fx-render.js";
import "./loader-fx-crystals.js";
import "./loader-fx-portal.js";
import {
  computePortalGroundBottomPx,
  computeTreeTerrainLiftSvg,
  measureFantasyTerrainHeightPx,
} from "./loader-fantasy-terrain.js";

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
 * Easing con overshoot más marcado (cristalización).
 * @param {number} t  0..1
 */
function easeOutBackCrystal(t) {
  const c1 = 1.75;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * @param {import('./loader-fantasy-element.js').FantasyKind | undefined} kind
 */
function buildEaseForKind(kind) {
  return kind === "crystals" ? easeOutBackCrystal : easeOutBack;
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
  const rot = tiltDeg ? ` rotate(${fmt(tiltDeg)} ${fmt(pivotX)} 100)` : "";
  g.setAttribute(
    "transform",
    `translate(${fmt(pivotX)} ${fmt(pivotY)}) scale(1 ${fmt(s)}) translate(${fmt(-pivotX)} ${fmt(-pivotY)})${rot}`,
  );
}

/**
 * Transform de un árbol de bosque: apoyo en terreno + escala desde el suelo.
 * @param {SVGGElement} g
 * @param {number} pivotX
 * @param {number} pivotY
 * @param {number} sy
 * @param {number} tiltDeg
 * @param {number} liftSvg  desplazamiento hacia arriba en unidades viewBox
 */
export function applyForestTreeTransform(g, pivotX, pivotY, sy, tiltDeg = 0, liftSvg = 0) {
  const s = Math.max(0, sy);
  const rot = tiltDeg ? ` rotate(${fmt(tiltDeg)} ${fmt(pivotX)} ${fmt(pivotY)})` : "";
  g.setAttribute(
    "transform",
    `translate(0 ${fmt(-liftSvg)}) translate(${fmt(pivotX)} ${fmt(pivotY)}) scale(1 ${fmt(s)}) translate(${fmt(-pivotX)} ${fmt(-pivotY)})${rot}`,
  );
}

/**
 * Índice de árbol al que pertenece una parte de bosque.
 * @param {import('./loader-fantasy-element.js').FantasyPart} part
 * @returns {number}
 */
export function forestTreeIndexFromPart(part) {
  if (Number.isFinite(part.treeIndex)) return /** @type {number} */ (part.treeIndex);
  return Math.floor((part.buildSequence ?? 0) / 10);
}

/**
 * Agrupa partes de bosque por árbol (orden estable por treeIndex).
 * @param {import('./loader-fantasy-element.js').FantasyPart[]} parts
 * @returns {{ treeIndex: number; parts: import('./loader-fantasy-element.js').FantasyPart[] }[]}
 */
export function groupForestPartsByTree(parts) {
  /** @type {Map<number, import('./loader-fantasy-element.js').FantasyPart[]>} */
  const map = new Map();
  for (const part of parts) {
    const idx = forestTreeIndexFromPart(part);
    const bucket = map.get(idx) ?? [];
    bucket.push(part);
    map.set(idx, bucket);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([treeIndex, treeParts]) => ({ treeIndex, parts: treeParts }));
}

/**
 * Pivote de escala para un árbol completo (suelo + centro horizontal).
 * @param {import('./loader-fantasy-element.js').FantasyPart[]} treeParts
 * @returns {{ pivotX: number; pivotY: number; tiltDeg: number }}
 */
export function forestTreePivot(treeParts) {
  const trunk = treeParts.find((p) => p.role === "trunk");
  const pivotY = Math.max(...treeParts.map((p) => p.baseY));
  const pivotX = trunk?.centerX ?? treeParts.reduce((s, p) => s + p.centerX, 0) / treeParts.length;
  const tiltDeg = trunk?.tiltDeg ?? treeParts[0]?.tiltDeg ?? 0;
  return { pivotX, pivotY, tiltDeg };
}

/**
 * @param {import('./loader-fantasy-element.js').FantasyPart} part
 * @returns {SVGGElement}
 */
function createPartGroup(part) {
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
  return g;
}

/**
 * Crea el marcado SVG del elemento (defs + partes), sin el clip de erosión.
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @returns {{
 *   svg: SVGSVGElement;
 *   partsGroup: SVGGElement;
 *   partGs: SVGGElement[];
 *   forestTrees?: { g: SVGGElement; treeIndex: number; parts: import('./loader-fantasy-element.js').FantasyPart[]; pivotX: number; pivotY: number; tiltDeg: number }[];
 * }}
 */
function createElementSvg(element) {
  const svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, "svg"));
  svg.setAttribute("viewBox", element.viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("loader-fantasy-el__svg");

  const partsGroup = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, "g"));
  partsGroup.classList.add("loader-fantasy-el__parts");
  svg.appendChild(partsGroup);

  if (element.kind === "forest") {
    const trees = groupForestPartsByTree(element.parts);
    /** @type {SVGGElement[]} */
    const partGs = [];
    /** @type {NonNullable<ReturnType<typeof createElementSvg>["forestTrees"]>} */
    const forestTrees = [];

    for (const { treeIndex, parts } of trees) {
      const treeG = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, "g"));
      treeG.classList.add("loader-fantasy-tree");
      treeG.dataset.treeIndex = String(treeIndex);
      const { pivotX, pivotY, tiltDeg } = forestTreePivot(parts);
      for (const part of parts) {
        const partG = createPartGroup(part);
        treeG.appendChild(partG);
        partGs.push(partG);
      }
      partsGroup.appendChild(treeG);
      forestTrees.push({ g: treeG, treeIndex, parts, pivotX, pivotY, tiltDeg });
    }

    return { svg, partsGroup, partGs, forestTrees };
  }

  const partGs = element.parts.map((part) => {
    const g = createPartGroup(part);
    partsGroup.appendChild(g);
    return g;
  });

  return { svg, partsGroup, partGs };
}

/** Desfase entre árboles al crecer (ms). */
export const FOREST_TREE_STAGGER_MS = 48;

/**
 * Delays acumulados para el crecimiento escalonado de un bosque.
 * @param {number} treeCount
 * @param {number} [staggerMs]
 * @returns {number[]}
 */
export function planForestTreeBuildDelays(treeCount, staggerMs = FOREST_TREE_STAGGER_MS) {
  const delays = [];
  for (let i = 0; i < treeCount; i += 1) {
    delays.push(i * staggerMs);
  }
  return delays;
}

/** Perfil de velocidad de construcción por facción (solo fase BUILD). */
const DEFAULT_BUILD_TIMING = {
  fillScale: 1,
  strokeFactor: 0.15,
  strokeOverlap: 0.92,
  strokeMinMs: 70,
  fillOverlap: 0.28,
};

/** Élficos: duración de trazos × (1 + 0.30). */
const ELF_BUILD_STROKE_SLOW = 1.3;
/** Humanos/enanos: duración de bloques ÷ (1 + 0.65). */
const HUMAN_DWARF_BUILD_FILL_FAST = 1.65;

/**
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 */
export function castleBuildTimingProfile(element) {
  const faction = element.meta?.faction;
  if (faction === "elf") {
    return {
      ...DEFAULT_BUILD_TIMING,
      strokeFactor: DEFAULT_BUILD_TIMING.strokeFactor * ELF_BUILD_STROKE_SLOW,
      strokeMinMs: Math.round(DEFAULT_BUILD_TIMING.strokeMinMs * ELF_BUILD_STROKE_SLOW),
      strokeOverlap: 0.9,
    };
  }
  if (faction === "human" || faction === "dwarf") {
    return {
      ...DEFAULT_BUILD_TIMING,
      fillScale: 1 / HUMAN_DWARF_BUILD_FILL_FAST,
    };
  }
  if (element.kind === "forest") {
    return {
      ...DEFAULT_BUILD_TIMING,
      fillScale: 0.78,
      fillOverlap: 0.12,
    };
  }
  if (element.kind === "crystals") {
    return {
      ...DEFAULT_BUILD_TIMING,
      fillScale: 0.92,
      fillOverlap: 0.42,
    };
  }
  if (element.kind === "portal") {
    return {
      ...DEFAULT_BUILD_TIMING,
      fillScale: 0.88,
      fillOverlap: 0.35,
    };
  }
  return DEFAULT_BUILD_TIMING;
}

/** Padding alrededor del contenido para la máscara de erosión (trazo, antialias). */
const EROSION_MASK_PAD_X = 14;
const EROSION_MASK_PAD_Y = 10;

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
    x: minX - EROSION_MASK_PAD_X,
    width: (maxX - minX) + EROSION_MASK_PAD_X * 2,
    yMin: minY - EROSION_MASK_PAD_Y,
    yMax: maxY + EROSION_MASK_PAD_Y,
  };
}

/**
 * Offset del gradiente de máscara para un umbral de erosión 0..1.
 * @param {number} threshold
 * @returns {string}
 */
export function erosionMaskOffsetForThreshold(threshold) {
  return String(Math.min(1, Math.max(0, threshold)));
}

/**
 * Parámetros de turbulencia/displacement para la máscara (más irregular que v1).
 * @param {number} seed
 * @param {import('./loader-fantasy-element.js').FantasyKind} [kind]
 * @returns {{ baseFrequency: string; numOctaves: number; dispScale: number; noiseSeed: number }}
 */
export function erosionMaskNoiseParams(seed, kind) {
  const s = seed >>> 0;
  let freqMul = 1;
  if (kind === "crystals") freqMul = 1.45;
  const freqX = (0.028 + (s % 11) * 0.0025) * freqMul;
  const freqY = (0.018 + ((s >>> 4) % 9) * 0.002) * freqMul;
  const dispScale = kind === "crystals" ? 32 + (s % 14) : 38 + (s % 19);
  return {
    baseFrequency: `${freqX.toFixed(4)} ${freqY.toFixed(4)}`,
    numOctaves: 3,
    dispScale,
    noiseSeed: (s ^ 0x7f3c) & 0xffff,
  };
}

/**
 * @param {SVGStopElement} stopB
 * @param {SVGStopElement} stopC
 * @param {number} threshold
 */
function applyErosionMaskStops(stopB, stopC, threshold) {
  const offset = erosionMaskOffsetForThreshold(threshold);
  stopB.setAttribute("offset", offset);
  stopC.setAttribute("offset", offset);
}

/**
 * Crea e inserta en el SVG la infraestructura de máscara de erosión.
 * El progreso se controla actualizando los stops del gradiente vía rAF.
 * @param {SVGSVGElement} svg
 * @param {SVGGElement} partsGroup
 * @param {number} seed
 * @param {{ x: number; width: number; yMin: number; yMax: number }} bounds
 * @returns {{ stopB: SVGStopElement; stopC: SVGStopElement }}
 */
function createErosionMask(svg, partsGroup, seed, bounds, kind) {
  const uid = `fe-${(seed >>> 0).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const noise = erosionMaskNoiseParams(seed, kind);
  const padY = EROSION_MASK_PAD_Y * 1.5;

  const defs = document.createElementNS(SVG_NS, "defs");

  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.id = `eg-${uid}`;
  grad.setAttribute("gradientUnits", "userSpaceOnUse");
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", String(bounds.yMin - padY));
  grad.setAttribute("x2", "0");
  grad.setAttribute("y2", String(bounds.yMax + padY));

  const stopA = document.createElementNS(SVG_NS, "stop");
  stopA.setAttribute("offset", "0");
  stopA.setAttribute("stop-color", "black");

  const stopB = /** @type {SVGStopElement} */ (document.createElementNS(SVG_NS, "stop"));
  stopB.setAttribute("offset", "0");
  stopB.setAttribute("stop-color", "black");

  const stopC = /** @type {SVGStopElement} */ (document.createElementNS(SVG_NS, "stop"));
  stopC.setAttribute("offset", "0");
  stopC.setAttribute("stop-color", "white");

  const stopD = document.createElementNS(SVG_NS, "stop");
  stopD.setAttribute("offset", "1");
  stopD.setAttribute("stop-color", "white");

  grad.append(stopA, stopB, stopC, stopD);

  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = `ef-${uid}`;
  filter.setAttribute("x", "-50%");
  filter.setAttribute("y", "-50%");
  filter.setAttribute("width", "200%");
  filter.setAttribute("height", "200%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const turbulence = document.createElementNS(SVG_NS, "feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  turbulence.setAttribute("baseFrequency", noise.baseFrequency);
  turbulence.setAttribute("numOctaves", String(noise.numOctaves));
  turbulence.setAttribute("seed", String(noise.noiseSeed));
  turbulence.setAttribute("result", "noise");

  const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
  disp.setAttribute("in", "SourceGraphic");
  disp.setAttribute("in2", "noise");
  disp.setAttribute("scale", String(noise.dispScale));
  disp.setAttribute("xChannelSelector", "R");
  disp.setAttribute("yChannelSelector", "G");

  filter.append(turbulence, disp);

  const mask = document.createElementNS(SVG_NS, "mask");
  mask.id = `em-${uid}`;
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  mask.setAttribute("x", String(bounds.x));
  mask.setAttribute("y", String(bounds.yMin - padY));
  mask.setAttribute("width", String(bounds.width));
  mask.setAttribute("height", String(bounds.yMax - bounds.yMin + padY * 2));

  const maskRect = document.createElementNS(SVG_NS, "rect");
  maskRect.setAttribute("x", String(bounds.x));
  maskRect.setAttribute("y", String(bounds.yMin - padY));
  maskRect.setAttribute("width", String(bounds.width));
  maskRect.setAttribute("height", String(bounds.yMax - bounds.yMin + padY * 2));
  maskRect.setAttribute("fill", `url(#eg-${uid})`);
  maskRect.setAttribute("filter", `url(#ef-${uid})`);

  mask.appendChild(maskRect);
  defs.append(grad, filter, mask);
  svg.insertBefore(defs, svg.firstChild);

  partsGroup.setAttribute("mask", `url(#em-${uid})`);

  return { stopB, stopC, maskId: `em-${uid}` };
}

/**
 * Monta un FantasyElement en el `container` y gestiona su ciclo de vida.
 *
 * @param {HTMLElement} container
 * @param {import('./loader-fantasy-element.js').FantasyElement} element
 * @param {{
 *   reducedMotion?: boolean;
 *   xPercent: number;        0..100
 *   anchor?: 'center' | 'left' | 'right';
 *   sizePx: number;          tamaño CSS del lado del SVG en px (equivale a altura deseada)
 *   terrainHeightPx: number; altura en px de la franja de terreno
 *   terrainProfile?: import('./loader-fantasy-terrain.js').TerrainProfile;
 *   timing?: ReturnType<import('./loader-fantasy-element.js').planLifecycleTiming>;
 *   onGone?: () => void;
 *   fxEnabled?: boolean;
 *   fxIntensity?: number;
 * }} opts
 * @returns {{ destroy: () => void }}
 */
export function mountFantasyElement(container, element, opts) {
  const {
    reducedMotion = false,
    xPercent,
    sizePx,
    terrainHeightPx,
    anchor = "center",
    terrainProfile,
    onGone,
    fxEnabled = true,
    fxIntensity = 1,
  } = opts;

  const timing = opts.timing ?? planLifecycleTiming(element.seed, element.kind, element.parts.length);

  let destroyed = false;
  let unsubFrame = () => {};
  let phaseTimer = 0;

  function stopFrame() {
    unsubFrame();
    unsubFrame = () => {};
  }

  // ─── Contenedor del elemento ─────────────────────────────────────────────
  const el = document.createElement("div");
  el.className = `loader-fantasy-el loader-fantasy-el--${element.kind}`;
  el.style.left = `${xPercent}%`;
  if (anchor === "left") {
    el.style.transform = "translateX(0)";
  } else if (anchor === "right") {
    el.style.transform = "translateX(-100%)";
  } else {
    el.style.transform = "translateX(-50%)";
  }
  // Bosques: base en el suelo de la escena; cada árbol se apoya en la cresta del terreno.
  el.style.bottom = "0";

  // El viewBox es cuadrado (0 0 100 100) con el contenido anclado abajo (y=100).
  // Caja cuadrada + preserveAspectRatio xMidYMax: el borde inferior dibujado
  // coincide SIEMPRE con el fondo de la caja → nunca flota.
  const svgH = sizePx;
  const svgW = sizePx;
  el.style.width = `${svgW}px`;
  el.style.height = `${svgH}px`;

  const sceneWidthPx = container.clientWidth || 390;
  const resolvedTerrainH = measureFantasyTerrainHeightPx(container.parentElement ?? container);
  const terrainH = resolvedTerrainH || terrainHeightPx;
  const portalFootY = element.kind === "portal"
    ? svgBoundsFromParts(element.parts).maxY
    : 100;

  function applyPortalGround(terrainHeight) {
    if (element.kind !== "portal" || !terrainProfile?.length) {
      el.style.bottom = "0";
      return;
    }
    const bottomPx = computePortalGroundBottomPx(
      terrainProfile,
      xPercent,
      portalFootY,
      sizePx,
      terrainHeight,
    );
    el.style.bottom = bottomPx > 0 ? `${bottomPx}px` : "0";
  }

  applyPortalGround(terrainH);

  const { svg, partsGroup, partGs, forestTrees } = createElementSvg(element);
  const isForest = element.kind === "forest" && forestTrees?.length;
  const preserve = anchor === "left"
    ? "xMinYMax meet"
    : anchor === "right"
      ? "xMaxYMax meet"
      : "xMidYMax meet";
  svg.setAttribute("preserveAspectRatio", preserve);
  svg.style.width = `${svgW}px`;
  svg.style.height = `${svgH}px`;
  el.appendChild(svg);
  container.appendChild(el);

  const fxProfile = typeof element.meta?.fxProfile === "string" ? element.meta.fxProfile : undefined;
  const fxRecipe = fxEnabled && !reducedMotion
    ? planFxRecipe(element.kind, element, {
      seed: element.seed,
      intensity: fxIntensity,
      fxProfile,
    })
    : null;
  const fx = fxRecipe ? mountFxBundle(el, svg, fxRecipe, { reducedMotion, displayScalePx: sizePx }) : null;

  /** @type {{ g: SVGGElement; pivotX: number; pivotY: number; tiltDeg: number; liftSvg: number; durationMs?: number; done?: boolean; _delay?: number }[] | null} */
  let liveForestInfos = null;

  function recomputeForestLifts(terrainHeight) {
    if (!isForest || !forestTrees || !terrainProfile?.length) return;
    const widthPx = container.clientWidth || sceneWidthPx;
    for (const tree of forestTrees) {
      tree.liftSvg = computeTreeTerrainLiftSvg(
        terrainProfile,
        xPercent,
        tree.pivotX,
        tree.pivotY,
        sizePx,
        widthPx,
        terrainHeight,
      );
    }
    if (liveForestInfos) {
      for (let i = 0; i < liveForestInfos.length; i += 1) {
        liveForestInfos[i].liftSvg = forestTrees[i]?.liftSvg ?? 0;
      }
    }
  }

  function paintForestGround(scale = 1) {
    if (!isForest || !forestTrees) return;
    if (liveForestInfos) {
      for (const info of liveForestInfos) {
        if (!info.done) continue;
        applyForestTreeTransform(info.g, info.pivotX, info.pivotY, 1, info.tiltDeg, info.liftSvg);
      }
      return;
    }
    for (const tree of forestTrees) {
      applyForestTreeTransform(tree.g, tree.pivotX, tree.pivotY, scale, tree.tiltDeg * scale, tree.liftSvg ?? 0);
    }
  }

  function relayoutGround() {
    if (destroyed) return;
    const nextTerrainH = measureFantasyTerrainHeightPx(container.parentElement ?? container)
      || terrainHeightPx;
    applyPortalGround(nextTerrainH);
    recomputeForestLifts(nextTerrainH);
    paintForestGround(1);
  }

  if (isForest && forestTrees && terrainProfile?.length) {
    recomputeForestLifts(resolvedTerrainH || terrainHeightPx);
  }

  // ─── Inicializar partes con escala 0 ──────────────────────────────────────
  if (isForest && forestTrees) {
    for (const tree of forestTrees) {
      applyForestTreeTransform(tree.g, tree.pivotX, tree.pivotY, 0, 0, tree.liftSvg ?? 0);
    }
  } else {
    element.parts.forEach((part, i) => {
      applyPartScale(partGs[i], part.centerX, part.baseY, 0, part.tiltDeg ?? 0);
    });
  }

  // ─── Función de limpieza ──────────────────────────────────────────────────
  function destroy() {
    destroyed = true;
    stopFrame();
    clearTimeout(phaseTimer);
    fx?.destroy();
    el.remove();
  }

  // ─── Reduced motion: fade simple ─────────────────────────────────────────
  if (reducedMotion) {
    el.style.transition = "opacity 400ms ease";
    el.style.opacity = "0";
    if (isForest && forestTrees) {
      for (const tree of forestTrees) {
        applyForestTreeTransform(tree.g, tree.pivotX, tree.pivotY, 1, tree.tiltDeg, tree.liftSvg ?? 0);
      }
    } else {
      element.parts.forEach((part, i) => {
        applyPartScale(partGs[i], part.centerX, part.baseY, 1, part.tiltDeg ?? 0);
      });
    }
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

    return { destroy, relayoutGround };
  }

  // ─── Fase BUILDING ────────────────────────────────────────────────────────
  const buildProfile = castleBuildTimingProfile(element);
  const buildEase = buildEaseForKind(element.kind);

  if (isForest && forestTrees) {
    const treeDurationMs = Math.round(timing.partDurationMs * buildProfile.fillScale);
    const buildDelays = planForestTreeBuildDelays(forestTrees.length);
    /** @type {{ g: SVGGElement; pivotX: number; pivotY: number; tiltDeg: number; liftSvg: number; durationMs: number; done: boolean; _delay: number }[]} */
    const treeBuildInfos = forestTrees.map((tree, i) => ({
      g: tree.g,
      pivotX: tree.pivotX,
      pivotY: tree.pivotY,
      tiltDeg: tree.tiltDeg,
      liftSvg: tree.liftSvg ?? 0,
      durationMs: treeDurationMs,
      done: false,
      _delay: buildDelays[i] ?? 0,
    }));
    liveForestInfos = treeBuildInfos;

    let buildStartMs = 0;

    function tickForestBuild(now) {
      if (destroyed) return;
      if (buildStartMs === 0) buildStartMs = now;

      let allDone = true;
      for (const info of treeBuildInfos) {
        if (info.done) continue;
        const elapsed = now - buildStartMs - info._delay;
        if (elapsed < 0) {
          allDone = false;
          continue;
        }
        const t = Math.min(1, elapsed / info.durationMs);
        const sy = easeOutBack(t);
        const tilt = info.tiltDeg * t;
        applyForestTreeTransform(info.g, info.pivotX, info.pivotY, sy, tilt, info.liftSvg);
        if (t >= 1) {
          info.done = true;
          applyForestTreeTransform(info.g, info.pivotX, info.pivotY, 1, info.tiltDeg, info.liftSvg);
        } else {
          allDone = false;
        }
      }

      if (!allDone) {
        return;
      }

      stopFrame();
      phaseTimer = setTimeout(() => {
        if (destroyed) return;
        startEroding();
      }, timing.holdMs);
    }

    unsubFrame = subscribeLoaderAnimationFrame(tickForestBuild);
    return { destroy, relayoutGround };
  }

  /** @type {{ g: SVGGElement; part: import('./loader-fantasy-element.js').FantasyPart; startMs: number; durationMs: number; done: boolean }[]} */
  const buildInfos = [];

  for (const part of element.parts) {
    const i = part.buildOrder;
    const stroke = !!part.stroke;
    buildInfos.push({
      g: partGs[i],
      part,
      startMs: 0,
      durationMs: stroke
        ? Math.max(
          buildProfile.strokeMinMs,
          Math.round(timing.partDurationMs * buildProfile.strokeFactor),
        )
        : Math.round(timing.partDurationMs * buildProfile.fillScale),
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
      ? buildProfile.strokeOverlap
      : buildProfile.fillOverlap;
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
      const sy = buildEase(t);
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
      return;
    }

    stopFrame();
    fx?.onPhase("building_end");
    fx?.onPhase("holding");

    // ─── Fase HOLDING ─────────────────────────────────────────────────────
    phaseTimer = setTimeout(() => {
      if (destroyed) return;
      startEroding();
    }, timing.holdMs);
  }

  // ─── Fase ERODING ────────────────────────────────────────────────────────
  function startEroding() {
    if (destroyed) return;

    fx?.onPhase("eroding");

    const erosionBounds = erosionClipBoundsFromParts(element.parts);
    const { stopB, stopC, maskId } = createErosionMask(svg, partsGroup, element.seed, erosionBounds, element.kind);
    fx?.setErosionMask(`url(#${maskId})`);

    let erodeStartMs = 0;

    function tickErode(now) {
      if (destroyed) return;
      if (erodeStartMs === 0) erodeStartMs = now;

      const elapsed = now - erodeStartMs;
      const tRaw = Math.min(1, elapsed / timing.erodeMs);
      const threshold = erosionThresholdAt(tRaw, element.seed);

      applyErosionMaskStops(stopB, stopC, threshold);
      fx?.setErosionProgress(tRaw);

      if (tRaw >= 1) {
        stopFrame();
        fx?.onPhase("gone");
        destroy();
        onGone?.();
        return;
      }
    }

    stopFrame();
    unsubFrame = subscribeLoaderAnimationFrame(tickErode);
  }

  // ─── Arranque ─────────────────────────────────────────────────────────────
  unsubFrame = subscribeLoaderAnimationFrame(tickBuild);

  return { destroy, relayoutGround };
}
