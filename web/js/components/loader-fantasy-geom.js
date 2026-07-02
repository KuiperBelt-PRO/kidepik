/**
 * Primitivas de geometría procedural para elementos de fantasía.
 *
 * Espacio de coordenadas local: x = horizontal, y = altura desde el suelo (y-up).
 * La función `normalizeFantasyGroups` convierte a SVG (y-down) y normaliza 0..100.
 *
 * @module loader-fantasy-geom
 */

import { createRng, hashSeed, randRange } from "./loader-ship-rng.js";

/** @typedef {{ x: number; y: number }} FPoint */

/**
 * Redondea a 1 decimal para minimizar el tamaño de los path strings.
 * @param {number} n
 */
function fmt(n) {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Primitivas (espacio local y-up)
// ---------------------------------------------------------------------------

/**
 * Rectángulo centrado en `cx`, base en `baseY`.
 * @param {number} cx
 * @param {number} baseY  coordenada y-up de la cara inferior
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[]}
 */
export function rect(cx, baseY, w, h) {
  const hw = w / 2;
  return [
    { x: cx - hw, y: baseY },
    { x: cx + hw, y: baseY },
    { x: cx + hw, y: baseY + h },
    { x: cx - hw, y: baseY + h },
  ];
}

/**
 * Marco hueco: rectángulo exterior con hueco interior (torres élficas abiertas).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} wallT  grosor de pared
 * @returns {{ outer: FPoint[]; holes: FPoint[][] }}
 */
export function hollowRect(cx, baseY, w, h, wallT) {
  const wt = Math.min(Math.max(wallT, 0.9), w * 0.42, h * 0.42);
  const outer = rect(cx, baseY, w, h);
  const inner = rect(cx, baseY + wt * 0.4, w - 2 * wt, h - wt * 0.55);
  return { outer, holes: [inner] };
}

/**
 * Rectángulo con esquinas achaflanadas (piedra tallada enana / angular).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} [chamfer]
 * @returns {FPoint[]}
 */
export function chamferRect(cx, baseY, w, h, chamfer = 3) {
  const hw = w / 2;
  const c = Math.min(chamfer, hw * 0.45, h * 0.35);
  return [
    { x: cx - hw + c, y: baseY },
    { x: cx + hw - c, y: baseY },
    { x: cx + hw, y: baseY + c },
    { x: cx + hw, y: baseY + h - c },
    { x: cx + hw - c, y: baseY + h },
    { x: cx - hw + c, y: baseY + h },
    { x: cx - hw, y: baseY + h - c },
    { x: cx - hw, y: baseY + c },
  ];
}

/**
 * Hueco rectangular achaflanado — vano enano (puerta, ventana, saetera).
 * Misma forma que chamferRect; se usa como anillo de sustracción (evenodd).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} [chamfer]
 * @returns {FPoint[]}
 */
export function chamferAperture(cx, baseY, w, h, chamfer = 3) {
  return chamferRect(cx, baseY, w, h, chamfer);
}

/**
 * Rectángulo con achaflanado solo en las esquinas superiores (base plana).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} [chamfer]
 * @returns {FPoint[]}
 */
export function chamferTopRect(cx, baseY, w, h, chamfer = 3) {
  const hw = w / 2;
  const c = Math.min(chamfer, hw * 0.45, h * 0.35);
  return [
    { x: cx - hw, y: baseY },
    { x: cx + hw, y: baseY },
    { x: cx + hw, y: baseY + h - c },
    { x: cx + hw - c, y: baseY + h },
    { x: cx - hw + c, y: baseY + h },
    { x: cx - hw, y: baseY + h - c },
  ];
}

/**
 * Hueco con achaflanado solo arriba (vanos enanos).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} [chamfer]
 * @returns {FPoint[]}
 */
export function chamferTopAperture(cx, baseY, w, h, chamfer = 3) {
  return chamferTopRect(cx, baseY, w, h, chamfer);
}

/**
 * Trapecio (base ancha, cima estrecha) con achaflanado solo en las esquinas superiores.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w       anchura en la base
 * @param {number} h
 * @param {number} [taper] 0..0.4 — reducción relativa de anchura en la cima
 * @param {number} [chamfer]
 * @returns {FPoint[]}
 */
export function trapezoidTopChamfer(cx, baseY, w, h, taper = 0.12, chamfer = 3) {
  const hw = w / 2;
  const t = Math.min(0.4, Math.max(0, taper));
  const wTop = w * (1 - t);
  const hwTop = wTop / 2;
  const c = Math.min(chamfer, hwTop * 0.45, h * 0.35);
  return [
    { x: cx - hw, y: baseY },
    { x: cx + hw, y: baseY },
    { x: cx + hwTop, y: baseY + h - c },
    { x: cx + hwTop - c, y: baseY + h },
    { x: cx - hwTop + c, y: baseY + h },
    { x: cx - hwTop, y: baseY + h - c },
  ];
}

/**
 * Trapecio invertido (cima estrecha o igual, base más ancha) para zócalos que
 * se ensanchan hacia el terreno sin crear un reborde en la unión con el muro.
 * @param {number} cx
 * @param {number} topY   borde superior (unión con bastión)
 * @param {number} wTop   anchura en topY — debe coincidir con el muro superior
 * @param {number} wBot   anchura en la base (más ancha, hacia el suelo)
 * @param {number} h      altura hacia abajo (topY → topY − h)
 * @returns {FPoint[]}
 */
export function trapezoidFlareDown(cx, topY, wTop, wBot, h) {
  const hwTop = wTop / 2;
  const hwBot = wBot / 2;
  const botY = topY - h;
  return [
    { x: cx - hwTop, y: topY },
    { x: cx + hwTop, y: topY },
    { x: cx + hwBot, y: botY },
    { x: cx - hwBot, y: botY },
  ];
}

/**
 * Tejado a dos aguas (triángulo o trapecio con cumbrera).
 * @param {number} cx
 * @param {number} baseY  base del tejado (sobre el muro)
 * @param {number} w
 * @param {number} h
 * @param {{ ridgeW?: number }} [opts]  ridgeW > 0 → trapecio
 * @returns {FPoint[]}
 */
export function gableRoof(cx, baseY, w, h, opts = {}) {
  const { ridgeW = 0 } = opts;
  const hw = w / 2;
  if (ridgeW <= 0) {
    return [
      { x: cx - hw, y: baseY },
      { x: cx + hw, y: baseY },
      { x: cx, y: baseY + h },
    ];
  }
  const hr = ridgeW / 2;
  return [
    { x: cx - hw, y: baseY },
    { x: cx + hw, y: baseY },
    { x: cx + hr, y: baseY + h },
    { x: cx - hr, y: baseY + h },
  ];
}

/**
 * Bóveda / cúpula semielíptica poligonalizada, base en `baseY`.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} rx  radio horizontal
 * @param {number} ry  radio vertical (altura)
 * @param {number} [segments]
 * @returns {FPoint[]}
 */
export function dome(cx, baseY, rx, ry, segments = 10) {
  const pts = [{ x: cx - rx, y: baseY }, { x: cx + rx, y: baseY }];
  for (let i = segments; i >= 0; i--) {
    const angle = (i / segments) * Math.PI;
    pts.push({
      x: cx + rx * Math.cos(angle),
      y: baseY + ry * Math.sin(angle),
    });
  }
  return pts;
}

/**
 * Cúpula con recorte horizontal recto en la parte superior (remate humano).
 * Genera la silueta: base plana → arcos laterales → tapa plana horizontal.
 * @param {number} cx
 * @param {number} baseY  base de la cúpula (y-up)
 * @param {number} rx     radio horizontal
 * @param {number} ry     radio vertical (altura total de la semicúpula completa)
 * @param {number} [cropRatio]  fracción de ry conservada (0,35–0,55)
 * @param {number} [segments]
 * @returns {FPoint[]}
 */
export function domeCropped(cx, baseY, rx, ry, cropRatio = 0.45, segments = 10) {
  const cr = Math.min(0.95, Math.max(0.05, cropRatio));
  const θCut = Math.asin(cr);
  const cutX = rx * Math.cos(θCut);
  const cutY = baseY + ry * cr;
  const steps = Math.max(3, Math.round(segments * θCut / (Math.PI / 2)));

  const pts = [
    { x: cx - rx, y: baseY },
    { x: cx + rx, y: baseY },
  ];

  // Arco derecho: desde la base derecha subiendo hasta el corte
  for (let i = 1; i <= steps; i++) {
    const θ = (i / steps) * θCut;
    pts.push({ x: fmt(cx + rx * Math.cos(θ)), y: fmt(baseY + ry * Math.sin(θ)) });
  }

  // Tapa plana: del corte derecho al corte izquierdo
  pts.push({ x: fmt(cx - cutX), y: fmt(cutY) });

  // Arco izquierdo: desde el corte izquierdo bajando hasta la base izquierda
  for (let i = 1; i <= steps; i++) {
    const θ = (Math.PI - θCut) + (i / steps) * θCut;
    pts.push({ x: fmt(cx + rx * Math.cos(θ)), y: fmt(baseY + ry * Math.sin(θ)) });
  }

  return pts;
}

/**
 * Altura Y de la tapa plana de una cúpula recortada (para anclar almenas).
 * @param {number} baseY
 * @param {number} ry
 * @param {number} [cropRatio]
 * @returns {number}
 */
export function domeCroppedCapY(baseY, ry, cropRatio = 0.45) {
  const cr = Math.min(0.95, Math.max(0.05, cropRatio));
  return baseY + ry * cr;
}

/**
 * Contorno de almenas (merlones + cuerpo base).
 * Reparte `count` dientes de forma uniforme de borde a borde sobre `w`.
 * @param {number} cx
 * @param {number} baseY  base del parapeto (suelo de la franja de almenas)
 * @param {number} w  anchura total (extremo izquierdo a derecho)
 * @param {number} count  número de merlones
 * @param {number} merH  altura del merlón (proporcional al ancho de cada diente)
 * @param {number} [merWidthFrac]  fracción del paso ocupada por cada merlón (≈0,5 → merlón y hueco iguales)
 * @returns {FPoint[]}
 */
export function merlons(cx, baseY, w, count, merH, merWidthFrac = 0.5) {
  const hw = w / 2;
  const n = Math.max(2, Math.round(count));
  const pitch = w / n;
  const fill = Math.min(0.88, Math.max(0.38, merWidthFrac));
  const merW = pitch * fill;
  const inset = (pitch - merW) / 2;
  const leftEdge = cx - hw;

  /** @type {FPoint[]} */
  const pts = [{ x: leftEdge, y: baseY }];

  for (let i = 0; i < n; i += 1) {
    const merLeft = leftEdge + i * pitch + inset;
    const merRight = merLeft + merW;
    pts.push(
      { x: merLeft, y: baseY },
      { x: merLeft, y: baseY + merH },
      { x: merRight, y: baseY + merH },
      { x: merRight, y: baseY },
    );
    if (i < n - 1) {
      pts.push({ x: leftEdge + (i + 1) * pitch, y: baseY });
    }
  }

  pts.push({ x: cx + hw, y: baseY });
  return pts;
}

/**
 * Hojas ojivales góticas (imposta → ápice) compartidas por `arch` y `gothicArchOutline`.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} segments
 * @param {number} [straightFrac]
 * @param {number} [bulgeK]
 */
function gothicArchLeaves(cx, baseY, w, h, segments, straightFrac = 0.25, bulgeK = 0.2) {
  const hw = w / 2;
  const straightH = h * straightFrac;
  const apexY = baseY + h;
  const segs = Math.max(6, Math.floor(segments / 2));
  const springRX = cx + hw;
  const springLX = cx - hw;

  /** @type {FPoint[]} */
  const rightLeaf = [];
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    rightLeaf.push({
      x: springRX + (cx - springRX) * t + Math.sin(t * Math.PI) * hw * bulgeK,
      y: (baseY + straightH) + (apexY - (baseY + straightH)) * t,
    });
  }

  /** @type {FPoint[]} */
  const leftLeaf = [];
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    leftLeaf.push({
      x: cx + (springLX - cx) * t - Math.sin((1 - t) * Math.PI) * hw * bulgeK,
      y: apexY + ((baseY + straightH) - apexY) * t,
    });
  }

  return {
    leftSpring: { x: cx - hw, y: baseY + straightH },
    rightSpring: { x: cx + hw, y: baseY + straightH },
    leftLeaf,
    rightLeaf,
  };
}

/**
 * Arco como anillo de sustracción (hueco).
 * @param {number} cx
 * @param {number} baseY  base del arco
 * @param {number} w
 * @param {number} h
 * @param {'gothic'|'romanesque'|'flat'|'trefoil'} [kind]
 * @param {number} [segments]
 * @returns {FPoint[]}
 */
export function arch(cx, baseY, w, h, kind = "gothic", segments = 8) {
  const hw = w / 2;

  if (kind === "flat") {
    return rect(cx, baseY, w, h);
  }

  if (kind === "romanesque") {
    // Parte recta + semicírculo de medio punto
    const archR = hw;
    const straightH = Math.max(0, h - archR);
    /** @type {FPoint[]} */
    const pts = [
      { x: cx - hw, y: baseY },
      { x: cx + hw, y: baseY },
      { x: cx + hw, y: baseY + straightH },
    ];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI;
      pts.push({
        x: cx + hw * Math.cos(a),
        y: baseY + straightH + hw * Math.sin(a),
      });
    }
    pts.push({ x: cx - hw, y: baseY + straightH });
    return pts;
  }

  if (kind === "gothic") {
    const { leftSpring, rightSpring, leftLeaf, rightLeaf } = gothicArchLeaves(
      cx, baseY, w, h, segments, 0.25, 0.2,
    );
    return [
      { x: cx - hw, y: baseY },
      { x: cx + hw, y: baseY },
      rightSpring,
      ...rightLeaf,
      ...leftLeaf,
      leftSpring,
    ];
  }

  if (kind === "trefoil") {
    // Tres lóbulos semicirculares contenidos dentro del ancho w.
    // Cada lóbulo ocupa w/3 → radio = hw/3.
    // Derecho: [cx+hw/3, cx+hw]; Central: [cx-hw/3, cx+hw/3]; Izquierdo: [cx-hw, cx-hw/3].
    const straightH = h * 0.25;
    const lobeBaseY = baseY + straightH;
    const lobeR = hw / 3; // tres lóbulos caben exactamente en el ancho
    const rcx = cx + hw - lobeR; // centro del lóbulo derecho (cx + 2*hw/3)
    const lcx = cx - hw + lobeR; // centro del lóbulo izquierdo (cx - 2*hw/3)
    const seg3 = Math.max(3, Math.floor(segments / 3));

    /** @type {FPoint[]} */
    const pts = [
      { x: cx - hw, y: baseY },
      { x: cx + hw, y: baseY },
      { x: cx + hw, y: lobeBaseY },
    ];

    // Lóbulo derecho: de (cx+hw, lobeBaseY) a (cx+hw/3, lobeBaseY)
    for (let i = 0; i <= seg3; i++) {
      const a = (i / seg3) * Math.PI;
      pts.push({ x: rcx + lobeR * Math.cos(a), y: lobeBaseY + lobeR * Math.sin(a) });
    }
    // Lóbulo central: de (cx+hw/3, lobeBaseY) a (cx-hw/3, lobeBaseY), ligeramente más alto
    for (let i = 0; i <= seg3; i++) {
      const a = (i / seg3) * Math.PI;
      pts.push({ x: cx + lobeR * Math.cos(a), y: lobeBaseY + lobeR * 1.25 * Math.sin(a) });
    }
    // Lóbulo izquierdo: de (cx-hw/3, lobeBaseY) a (cx-hw, lobeBaseY)
    for (let i = 0; i <= seg3; i++) {
      const a = (i / seg3) * Math.PI;
      pts.push({ x: lcx + lobeR * Math.cos(a), y: lobeBaseY + lobeR * Math.sin(a) });
    }

    // pts termina en (cx-hw, lobeBaseY) → Z cierra al punto inicial (cx-hw, baseY) ✓
    return pts;
  }

  // Fallback: flat
  return rect(cx, baseY, w, h);
}

/**
 * Contorno abierto de arco gótico (trazo, sin relleno).
 * Ojiva puntiaguda: jambas cortas + dos arcos ojivales con curvatura hacia fuera.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} [segments]
 * @returns {FPoint[]}
 */
export function gothicArchOutline(cx, baseY, w, h, segments = 16) {
  const hw = w / 2;
  const { leftSpring, rightSpring, leftLeaf, rightLeaf } = gothicArchLeaves(
    cx, baseY, w, h, segments, 0.18, 0.34,
  );
  const apex = rightLeaf[rightLeaf.length - 1];

  return [
    { x: cx - hw, y: baseY },
    leftSpring,
    ...leftLeaf.slice().reverse().slice(1),
    apex,
    ...rightLeaf.slice(0, -1).reverse(),
    rightSpring,
    { x: cx + hw, y: baseY },
  ];
}

/**
 * Recorta un contorno de arco a [minX, maxX] (arcos exteriores → medio arco con lado vertical).
 * @param {FPoint[]} pts
 * @param {number} minX
 * @param {number} maxX
 * @returns {FPoint[]}
 */
export function clampOutlineX(pts, minX, maxX) {
  return pts.map((pt) => ({
    x: Math.max(minX, Math.min(maxX, pt.x)),
    y: pt.y,
  }));
}

/**
 * Fila de arcos entrecruzados recortada al tramo (como arcadas del zócalo en el envelope).
 * @param {number} baseY
 * @param {number} archH
 * @param {number} spanStart
 * @param {number} spanEnd
 * @param {number} [count]
 * @returns {FPoint[][]}
 */
export function gothicBoundedInterlaceRow(
  baseY, archH, spanStart, spanEnd, count = 3,
) {
  const rows = gothicFlankInterlaceRow(baseY, archH, spanStart, spanEnd, "left", count);
  return rows.map((pts) => clampOutlineX(pts, spanStart, spanEnd));
}

/**
 * Fila de arcos góticos en trazo a lo largo de [spanStart, spanEnd].
 * Centros equidistantes de A a B; ancho > paso para que las curvas se crucen.
 * @param {number} baseY
 * @param {number} archH
 * @param {number} spanStart  punto A
 * @param {number} spanEnd    punto B
 * @param {'left' | 'right'} side
 * @param {number} [count]
 * @returns {FPoint[][]}
 */
export function gothicFlankInterlaceRow(
  baseY, archH, spanStart, spanEnd, side, count = 5,
) {
  const span = spanEnd - spanStart;
  const minH = 4;
  const h = Math.max(minH, archH);
  /** @type {FPoint[][]} */
  const outlines = [];

  if (count <= 0 || span <= 0) return outlines;

  const pitch = count > 1 ? span / (count - 1) : span;
  const archW = Math.max(3, pitch * 1.62);

  for (let i = 0; i < count; i++) {
    const cx = count > 1
      ? spanStart + i * pitch
      : spanStart + span / 2;
    outlines.push(gothicArchOutline(cx, baseY, archW, h, 8));
  }

  void side;
  return outlines;
}

/**
 * Arcadas laterales: 5 arcos entrecruzados por flanco, desde el borde del arco
 * central hasta el extremo del zócalo.
 * @param {number} axis
 * @param {number} baseY
 * @param {number} doorW
 * @param {number} archH
 * @param {number} envLeft
 * @param {number} envRight
 * @param {number} [count]
 * @returns {FPoint[][]}
 */
export function gothicFlankInterlaceOutlines(
  axis, baseY, doorW, archH, envLeft, envRight, count = 5,
) {
  const centralLeft = axis - doorW / 2;
  const centralRight = axis + doorW / 2;
  const left = gothicFlankInterlaceRow(baseY, archH, envLeft, centralLeft, "left", count);
  const right = gothicFlankInterlaceRow(baseY, archH, centralRight, envRight, "right", count);
  return [...left, ...right];
}

/**
 * Contorno abierto de tejado trapezoidal regular (base y cumbrera paralelas).
 * @param {number} spanStart
 * @param {number} spanEnd
 * @param {number} baseY  borde inferior del tejado (cima de las arcadas)
 * @param {number} roofH  altura uniforme del trapecio
 * @param {number} [topInsetRatio]
 * @returns {FPoint[]}
 */
export function elfTrapezoidRoofOutline(
  spanStart, spanEnd, baseY, roofH, topInsetRatio = 0.12,
) {
  const span = spanEnd - spanStart;
  if (span <= 0 || roofH <= 0) return [];
  const topInset = Math.max(1, span * topInsetRatio);
  const topY = baseY + roofH;
  return [
    { x: spanStart, y: baseY },
    { x: spanEnd, y: baseY },
    { x: spanEnd - topInset, y: topY },
    { x: spanStart + topInset, y: topY },
    { x: spanStart, y: baseY },
  ];
}

/**
 * Una teja en escama de pez (pico hacia abajo), trazo abierto.
 * @param {number} cx
 * @param {number} topY  borde superior de la escama
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[]}
 */
export function fishScaleOutline(cx, topY, w, h) {
  const hw = w / 2;
  const midY = topY + h * 0.36;
  return [
    { x: cx - hw, y: topY },
    { x: cx - hw * 0.14, y: midY },
    { x: cx, y: topY + h },
    { x: cx + hw * 0.14, y: midY },
    { x: cx + hw, y: topY },
  ];
}

/**
 * Rellena un trapecio regular de tejado con filas de tejas en escama de pez.
 * @param {number} spanStart
 * @param {number} spanEnd
 * @param {number} baseY
 * @param {number} roofH
 * @param {number} topInsetRatio
 * @param {{ rows?: number; cols?: number; padRatio?: number }} [opts]
 * @returns {FPoint[][]}
 */
export function fishScaleFillTrapezoid(
  spanStart, spanEnd, baseY, roofH, topInsetRatio,
  opts = {},
) {
  const { rows = 3, cols = 0, padRatio = 0.06 } = opts;
  const span = spanEnd - spanStart;
  if (span <= 0 || rows <= 0 || roofH <= 0) return [];

  const topInset = Math.max(1, span * topInsetRatio);
  const padY = roofH * padRatio;
  const innerBaseY = baseY + padY * 0.35;
  const innerRoofH = roofH - padY;
  const rowH = innerRoofH / rows;
  /** @type {FPoint[][]} */
  const scales = [];

  for (let r = 0; r < rows; r++) {
    const y = innerBaseY + innerRoofH - (r + 0.5) * rowH;
    const t = Math.min(1, Math.max(0, (y - baseY) / roofH));
    const leftX = spanStart + topInset * t;
    const rightX = spanEnd - topInset * t;
    const rowW = rightX - leftX;
    if (rowW < 1.5) continue;

    const nCols = cols > 0
      ? cols
      : Math.max(2, Math.round(rowW / (rowH * 1.25)));
    const scaleW = rowW / nCols;
    const scaleH = rowH * 0.88;
    const yTop = y - scaleH * 0.4;
    const offset = (r % 2) * scaleW * 0.5;

    for (let c = 0; c < nCols; c++) {
      const cx = leftX + offset + (c + 0.5) * scaleW;
      const half = scaleW * 0.44;
      if (cx - half < leftX || cx + half > rightX) continue;
      scales.push(fishScaleOutline(cx, yTop, scaleW * 0.9, scaleH));
    }
  }

  return scales;
}

/**
 * Tejados trapezoidales + tejas en escama para ambos flancos laterales.
 * @param {number} axis
 * @param {number} baseY
 * @param {number} doorW
 * @param {number} archH
 * @param {number} envLeft
 * @param {number} envRight
 * @param {{ roofHRatio?: number; topInsetRatio?: number; rows?: number }} [opts]
 * @returns {FPoint[][]}
 */
export function elfFlankRoofOutlines(
  axis, baseY, doorW, archH, envLeft, envRight,
  opts = {},
) {
  const {
    roofHRatio = 0.34,
    topInsetRatio = 0.12,
    rows = 3,
  } = opts;

  const roofBase = baseY + archH;
  const centralLeft = axis - doorW / 2;
  const centralRight = axis + doorW / 2;
  const roofH = Math.max(2, archH * roofHRatio);
  const fillOpts = { rows };

  const leftOutline = elfTrapezoidRoofOutline(
    envLeft, centralLeft, roofBase, roofH, topInsetRatio,
  );
  const rightOutline = elfTrapezoidRoofOutline(
    centralRight, envRight, roofBase, roofH, topInsetRatio,
  );
  const leftScales = fishScaleFillTrapezoid(
    envLeft, centralLeft, roofBase, roofH, topInsetRatio, fillOpts,
  );
  const rightScales = fishScaleFillTrapezoid(
    centralRight, envRight, roofBase, roofH, topInsetRatio, fillOpts,
  );

  return [leftOutline, rightOutline, ...leftScales, ...rightScales];
}

/**
 * Rectángulo en trazo abierto (cierra el lado izquierdo).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[]}
 */
export function rectOutline(cx, baseY, w, h) {
  const hw = w / 2;
  return [
    { x: cx - hw, y: baseY },
    { x: cx + hw, y: baseY },
    { x: cx + hw, y: baseY + h },
    { x: cx - hw, y: baseY + h },
    { x: cx - hw, y: baseY },
  ];
}

/**
 * Líneas verticales en trazo dentro del rectángulo de torre élfica.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {() => number} rng
 * @returns {FPoint[][]}
 */
export function elfTowerBodyVerticalLines(cx, baseY, w, h, rng) {
  const count = 3 + Math.floor(rng() * 3);
  const margin = w * 0.1;
  const left = cx - w / 2 + margin;
  const right = cx + w / 2 - margin;
  /** @type {FPoint[][]} */
  const lines = [];

  for (let i = 0; i < count; i++) {
    const x = count <= 1
      ? cx
      : left + (i / (count - 1)) * (right - left);
    const jitter = (rng() - 0.5) * w * 0.035;
    lines.push([
      { x: x + jitter, y: baseY },
      { x: x + jitter, y: baseY + h },
    ]);
  }

  return lines;
}

/**
 * Torre élfica sobre tejado: contorno rectangular + líneas verticales + arcada de 3 arcos recortada.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {() => number} rng
 * @param {number} [crownArchCount]
 * @returns {FPoint[][]}
 */
export function elfRoofTowerOutlines(cx, baseY, w, h, rng, crownArchCount = 3) {
  const shell = rectOutline(cx, baseY, w, h);
  const body = elfTowerBodyVerticalLines(cx, baseY, w, h, rng);
  const crownArchH = Math.max(2, w * (0.34 + rng() * 0.16));
  const crownBase = baseY + h;
  const leftX = cx - w / 2;
  const rightX = cx + w / 2;
  const crown = gothicBoundedInterlaceRow(
    crownBase, crownArchH, leftX, rightX, crownArchCount,
  );
  return [shell, ...body, ...crown];
}

/**
 * Número aleatorio de torres élficas por castillo (1, 2 o 3).
 * @param {() => number} rng
 * @returns {1 | 2 | 3}
 */
export function planElfRoofTowerTargetCount(rng) {
  return /** @type {1 | 2 | 3} */ (1 + Math.floor(rng() * 3));
}

/**
 * Posición horizontal sobre la cumbrera: reparte en huecos para evitar siempre el centro.
 * @param {() => number} rng
 * @param {number} minCx
 * @param {number} maxCx
 * @param {Set<number>} [usedSlots] slots ya ocupados en esta cumbrera (0..slots-1)
 * @returns {number|null}
 */
function pickTowerCxAlongRidge(rng, minCx, maxCx, usedSlots = new Set()) {
  const span = maxCx - minCx;
  if (span <= 0.4) return (minCx + maxCx) / 2;

  const slots = Math.max(3, Math.min(8, Math.floor(span / 1.8)));
  /** @type {number[]} */
  const free = [];
  for (let i = 0; i < slots; i += 1) {
    if (!usedSlots.has(i)) free.push(i);
  }
  if (free.length === 0) return null;

  const slot = free[Math.floor(rng() * free.length)];
  usedSlots.add(slot);
  const t0 = slot / slots;
  const t1 = (slot + 1) / slots;
  const innerPad = 0.1 + rng() * 0.12;
  const t = t0 + innerPad + rng() * Math.max(0.08, (t1 - t0) - 2 * innerPad);
  return minCx + Math.min(1, Math.max(0, t)) * span;
}

/**
 * Planifica 1–3 torres sobre la cumbrera de los tejados laterales.
 * @param {number} axis
 * @param {number} baseY
 * @param {number} doorW
 * @param {number} archH
 * @param {number} envLeft
 * @param {number} envRight
 * @param {number} roofHRatio
 * @param {number} topInsetRatio
 * @param {() => number} rng
 * @param {{ widthFrac?: { min: number; max: number }; pairWidthFrac?: { min: number; max: number }; tripleWidthFrac?: { min: number; max: number }; heightFrac?: { min: number; max: number }; targetCount?: number }} [opts]
 * @returns {{ cx: number; baseY: number; w: number; h: number }[]}
 */
export function planElfRoofTowerPlacements(
  axis, baseY, doorW, archH, envLeft, envRight, roofHRatio, topInsetRatio, rng,
  opts = {},
) {
  const widthFrac = opts.widthFrac ?? { min: 0.24, max: 0.42 };
  const pairWidthFrac = opts.pairWidthFrac ?? { min: 0.2, max: 0.34 };
  const tripleWidthFrac = opts.tripleWidthFrac ?? { min: 0.14, max: 0.22 };
  const heightFrac = opts.heightFrac ?? { min: 2.8, max: 5.2 };
  const targetCount = opts.targetCount ?? planElfRoofTowerTargetCount(rng);
  const roofBase = baseY + archH;
  const roofH = Math.max(2, archH * roofHRatio);
  const towerBaseY = roofBase + roofH;
  const centralLeft = axis - doorW / 2;
  const centralRight = axis + doorW / 2;

  const roofSpans = [
    { spanStart: envLeft, spanEnd: centralLeft },
    { spanStart: centralRight, spanEnd: envRight },
  ];

  /** @type {{ cx: number; baseY: number; w: number; h: number }[]} */
  const towers = [];

  const roofTopBand = (roof) => {
    const span = roof.spanEnd - roof.spanStart;
    const topInset = Math.max(1, span * topInsetRatio);
    return {
      topStart: roof.spanStart + topInset,
      topEnd: roof.spanEnd - topInset,
      topW: roof.spanEnd - roof.spanStart - 2 * topInset,
    };
  };

  const dimsDistinct = (w, h) => {
    if (towers.length === 0) return true;
    return towers.every(
      (t) => Math.abs(t.w - w) > w * 0.05 || Math.abs(t.h - h) > h * 0.07,
    );
  };

  const widthRangeForRemaining = (remaining) => {
    if (remaining >= 3) return tripleWidthFrac;
    if (remaining === 2) return pairWidthFrac;
    return widthFrac;
  };

  /** @type [Set<number>, Set<number>] */
  const ridgeSlots = [new Set(), new Set()];

  const tryPlaceSingle = (roofIdx, roof, widthRange) => {
    const { topStart, topEnd, topW } = roofTopBand(roof);
    if (topW < 3.5) return false;

    for (let attempt = 0; attempt < 24; attempt++) {
      const w = topW * randRange(rng, widthRange.min, widthRange.max);
      const h = roofH * randRange(rng, heightFrac.min, heightFrac.max);
      if (!dimsDistinct(w, h)) continue;

      const minCx = topStart + w / 2;
      const maxCx = topEnd - w / 2;
      if (maxCx <= minCx) continue;

      const cx = pickTowerCxAlongRidge(rng, minCx, maxCx, ridgeSlots[roofIdx]);
      if (cx == null) continue;

      const overlaps = towers.some(
        (t) => Math.abs(t.cx - cx) < (t.w + w) / 2 + 0.5,
      );
      if (!overlaps) {
        towers.push({ cx, baseY: towerBaseY, w, h });
        return true;
      }
    }
    return false;
  };

  const pickRoofOrder = (remaining) => {
    const counts = roofSpans.map((roof, idx) => ({
      idx,
      count: towers.filter((t) => t.cx >= roof.spanStart && t.cx <= roof.spanEnd).length,
    }));
    counts.sort((a, b) => a.count - b.count);

    // Con 2+ torres pendientes, a veces apilar en el mismo tejado.
    if (remaining >= 2 && rng() < 0.42) {
      const host = counts[Math.floor(rng() * Math.min(2, counts.length))].idx;
      return [host, host, 1 - host, 1 - host];
    }

    const shuffled = rng() < 0.5 ? [0, 1] : [1, 0];
    if (counts[0].count > counts[1].count) return [counts[0].idx, counts[1].idx];
    return shuffled;
  };

  let guard = 0;
  while (towers.length < targetCount && guard < 50) {
    guard += 1;
    const remaining = targetCount - towers.length;
    const widthRange = widthRangeForRemaining(remaining);
    let placed = false;

    for (const idx of pickRoofOrder(remaining)) {
      if (tryPlaceSingle(idx, roofSpans[idx], widthRange)) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      for (const idx of [0, 1]) {
        if (tryPlaceSingle(idx, roofSpans[idx], tripleWidthFrac)) {
          placed = true;
          break;
        }
      }
    }

    if (!placed) break;
  }

  return towers;
}

/**
 * Ventana o puerta como anillo de sustracción.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {'rect'|'gothic'|'romanesque'|'flat'} [kind]
 * @returns {FPoint[]}
 */
export function aperture(cx, baseY, w, h, kind = "rect") {
  if (kind === "rect") return rect(cx, baseY, w, h);
  return arch(cx, baseY, w, h, /** @type {any} */ (kind));
}

/**
 * Remate decorativo.  Devuelve uno o más anillos (todos aditivos).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} h
 * @param {'needle'|'ball'} [kind]
 * @returns {FPoint[][]}
 */
export function finial(cx, baseY, h, kind = "needle") {
  if (kind === "ball") {
    const r = h / 2;
    return [dome(cx, baseY, r, r * 0.85)];
  }
  // needle (default)
  return [[
    { x: cx - h * 0.07, y: baseY },
    { x: cx + h * 0.07, y: baseY },
    { x: cx, y: baseY + h },
  ]];
}

/**
 * Dos arcos ojivales superpuestos (fachada élfica). Devuelve dos anillos aditivos.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[][]}
 */
export function crossingArches(cx, baseY, w, h) {
  const hw = w / 2;
  const archH = h * 0.9;
  const archW = w * 0.52;
  return [
    arch(cx - hw * 0.2, baseY, archW, archH, "gothic", 5),
    arch(cx + hw * 0.2, baseY, archW, archH, "gothic", 5),
  ];
}

/**
 * Fila de pinchos triangulares sobre una línea (fuerzas malignas).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} count
 * @param {number} spikeH
 * @returns {FPoint[][]}
 */
export function spikeRow(cx, baseY, w, count, spikeH) {
  const hw = w / 2;
  const n = Math.max(2, count);
  const step = w / (n + 1);
  const halfW = step * 0.22;
  /** @type {FPoint[][]} */
  const spikes = [];
  for (let i = 0; i < n; i++) {
    const sx = cx - hw + (i + 1) * step;
    spikes.push([
      { x: sx - halfW, y: baseY },
      { x: sx, y: baseY + spikeH },
      { x: sx + halfW, y: baseY },
    ]);
  }
  return spikes;
}

/**
 * Contrafuerte triangular (refuerzo de muro).
 * @param {number} wallCx
 * @param {number} wallEdgeX  borde del muro donde se apoya
 * @param {number} baseY
 * @param {number} w  anchura hacia fuera
 * @param {number} h
 * @returns {FPoint[]}
 */
export function buttress(wallCx, wallEdgeX, baseY, w, h) {
  const outward = wallEdgeX < wallCx ? -1 : 1;
  const outerX = wallEdgeX + outward * w;
  const midX = wallEdgeX + outward * w * 0.52;
  return [
    { x: wallEdgeX, y: baseY },
    { x: outerX, y: baseY },
    { x: midX, y: baseY + h },
    { x: wallEdgeX, y: baseY + h },
  ];
}

/**
 * Remate de torre élfica: silueta de arco gótico sólido.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[]}
 */
export function gothicArchCap(cx, baseY, w, h) {
  return arch(cx, baseY, w * 0.9, h * 1.15, "gothic", 7);
}

/**
 * Remate en forma de flecha/chevron con pinchos laterales (corona de agujas).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[][]}
 */
export function elfSpireCluster(cx, baseY, w, h) {
  /** @type {FPoint[][]} */
  const spikes = [];
  const mainH = h * 1.22;
  const halfMain = Math.max(w * 0.1, 1.0);
  spikes.push([
    { x: cx - halfMain, y: baseY },
    { x: cx, y: baseY + mainH },
    { x: cx + halfMain, y: baseY },
  ]);
  const sides = [
    [-0.44, 0.78],
    [-0.24, 0.62],
    [0.24, 0.62],
    [0.44, 0.78],
  ];
  for (const [frac, hFrac] of sides) {
    const sx = cx + frac * w;
    const sh = h * hFrac;
    const sw = Math.max(w * 0.08, 0.7);
    const lean = frac > 0 ? sw * 0.35 : -sw * 0.35;
    spikes.push([
      { x: sx - sw, y: baseY },
      { x: sx + lean, y: baseY + sh },
      { x: sx + sw, y: baseY },
    ]);
  }
  return spikes;
}

/**
 * Remate en forma de flecha/chevron simple (alias del pico central).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[]}
 */
export function invertedArrowCap(cx, baseY, w, h) {
  const hw = w / 2;
  return [
    { x: cx - hw, y: baseY },
    { x: cx, y: baseY + h },
    { x: cx + hw, y: baseY },
  ];
}

/**
 * Podio elevado: pilares laterales, arcadas de sustentación y terraza superior.
 * Los vanos entre arcos dejan ver el fondo (separación del terreno blanco).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} stiltH
 * @param {number} slabH
 * @param {number} archCount
 * @returns {{ piers: FPoint[][]; arches: FPoint[][]; slab: FPoint[] }}
 */
export function elfPodium(cx, baseY, w, stiltH, slabH, archCount) {
  const pierW = w * 0.06;
  const totalH = stiltH + slabH;
  const piers = [
    rect(cx - w / 2 + pierW / 2, baseY, pierW, totalH),
    rect(cx + w / 2 - pierW / 2, baseY, pierW, totalH),
  ];
  /** @type {FPoint[][]} */
  const arches = [];
  const n = Math.max(3, archCount);
  const innerW = w - pierW * 2.4;
  const step = innerW / n;
  const startX = cx - innerW / 2 + step / 2;
  for (let i = 0; i < n; i++) {
    const ax = startX + i * step;
    arches.push(arch(ax, baseY, step * 0.72, stiltH * 0.96, "gothic", 8));
  }
  const slab = rect(cx, baseY + stiltH, w, slabH);
  return { piers, arches, slab };
}

/**
 * Corona de costillas: arcos góticos finos que se cruzan (cúpula abierta élfica).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[][]}
 */
export function elfRibCrown(cx, baseY, w, h) {
  /** @type {FPoint[][]} */
  const rings = [];
  const ribs = 6;
  for (let i = 0; i < ribs; i++) {
    const t = ribs > 1 ? i / (ribs - 1) : 0.5;
    const ox = (t - 0.5) * w * 0.68;
    const ribW = w * (0.16 + Math.abs(t - 0.5) * 0.1);
    rings.push(arch(cx + ox, baseY, ribW, h, "gothic", 6));
  }
  rings.push(...crossingArches(cx, baseY + h * 0.04, w * 0.52, h * 0.88));
  rings.push(...crossingArches(cx, baseY + h * 0.18, w * 0.38, h * 0.62));
  return rings;
}

/**
 * Pétalos decorativos que abren desde el fuste de la torre.
 * @param {number} cx
 * @param {number} midY
 * @param {number} w
 * @param {number} h
 * @returns {FPoint[][]}
 */
export function elfPetalFlare(cx, midY, w, h) {
  const spread = w * 0.64;
  const tipY = midY + h;
  const curl = h * 0.14;
  return [
    [
      { x: cx - spread, y: midY },
      { x: cx - w * 0.1, y: midY - curl },
      { x: cx - w * 0.02, y: tipY },
      { x: cx - spread * 0.7, y: midY + h * 0.1 },
    ],
    [
      { x: cx + spread, y: midY },
      { x: cx + w * 0.1, y: midY - curl },
      { x: cx + w * 0.02, y: tipY },
      { x: cx + spread * 0.7, y: midY + h * 0.1 },
    ],
  ];
}

/**
 * Arbotante curvo (arco exterior entre torre y muro).
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} thick
 * @returns {FPoint[]}
 */
export function elfFlyingButtress(x0, y0, x1, y1, thick) {
  const mx = (x0 + x1) / 2;
  const span = Math.hypot(x1 - x0, y1 - y0);
  const my = Math.min(y0, y1) - span * 0.24;
  const samples = 8;
  /** @type {FPoint[]} */
  const upper = [];
  /** @type {FPoint[]} */
  const lower = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const omt = 1 - t;
    const bx = omt * omt * x0 + 2 * omt * t * mx + t * t * x1;
    const by = omt * omt * y0 + 2 * omt * t * my + t * t * y1;
    const dx = 2 * omt * (mx - x0) + 2 * t * (x1 - mx);
    const dy = 2 * omt * (my - y0) + 2 * t * (y1 - my);
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * thick * 0.5;
    const ny = (dx / len) * thick * 0.5;
    upper.push({ x: bx + nx, y: by + ny });
    lower.unshift({ x: bx - nx, y: by - ny });
  }
  return [...upper, ...lower];
}

/**
 * Arbotante: puente inclinado entre torre y muro (pieza aditiva fina).
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} thick
 * @returns {FPoint[]}
 */
export function flyingButtress(x0, y0, x1, y1, thick) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * thick * 0.5;
  const ny = (dx / len) * thick * 0.5;
  return [
    { x: x0 + nx, y: y0 + ny },
    { x: x1 + nx, y: y1 + ny },
    { x: x1 - nx, y: y1 - ny },
    { x: x0 - nx, y: y0 - ny },
  ];
}

/**
 * Fila de arcos finos (arcada / claustro élfico).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} totalW
 * @param {number} archW
 * @param {number} archH
 * @param {number} count
 * @returns {FPoint[][]}
 */
export function arcadeRow(cx, baseY, totalW, archW, archH, count) {
  /** @type {FPoint[][]} */
  const rings = [];
  const n = Math.max(2, count);
  const step = totalW / n;
  const startX = cx - totalW / 2 + step / 2;
  for (let i = 0; i < n; i++) {
    rings.push(arch(startX + i * step, baseY, archW * 0.92, archH, "gothic", 4));
  }
  return rings;
}

/**
 * Arcadas cruzadas orgánicas: varias filas de arcos finos superpuestos.
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} [rows]
 * @returns {FPoint[][]}
 */
export function elfArcadeCluster(cx, baseY, w, h, rows = 2) {
  /** @type {FPoint[][]} */
  const rings = [];
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 2 + r;
    const rowY = baseY + r * rowH * 0.82;
    const archW = w / (cols + 1.2);
    rings.push(...arcadeRow(cx, rowY, w * 0.96, archW * 0.86, rowH * 0.95, cols));
    const step = (w * 0.96) / cols;
    const startX = cx - (w * 0.96) / 2 + step / 2;
    for (let c = 1; c < cols; c++) {
      const colX = startX + c * step - step * 0.5;
      rings.push(rect(colX, rowY, archW * 0.1, rowH * 0.32));
    }
    if (r > 0) {
      rings.push(...crossingArches(cx, rowY + rowH * 0.18, w * 0.42, rowH * 0.58));
    }
  }
  rings.push(...crossingArches(cx, baseY + h * 0.1, w * 0.74, h * 0.8));
  rings.push(...crossingArches(cx, baseY + h * 0.26, w * 0.52, h * 0.52));
  return rings;
}

/**
 * Puente o basamento con arcadas altas (entrada élfica).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} totalW
 * @param {number} archH
 * @param {number} count
 * @returns {FPoint[][]}
 */
export function elfBridgeArcade(cx, baseY, totalW, archH, count) {
  return arcadeRow(cx, baseY, totalW, totalW / (count + 2.2), archH, count);
}

/**
 * Forma libre (pasa los puntos tal cual).
 * @param {FPoint[]} points
 * @returns {FPoint[]}
 */
export function polygon(points) {
  return [...points];
}

/**
 * Aplica jitter aleatorio a un anillo de puntos.
 * @param {FPoint[]} points
 * @param {() => number} rng  función que devuelve valores en [0, 1)
 * @param {number} amount  desplazamiento máximo por eje (unidades locales)
 * @param {{ lockY?: number[]; freezeSeams?: boolean; tolerance?: number }} [opts]
 *   lockY: valores Y de aristas compartidas entre piezas.
 *   freezeSeams: si true, los puntos en lockY no se desplazan (evita huecos).
 * @returns {FPoint[]}
 */
export function jitterRing(points, rng, amount, opts = {}) {
  const { lockY = [], freezeSeams = false, tolerance = 0.05 } = opts;
  return points.map((p) => {
    const onSeam = lockY.some((ly) => Math.abs(p.y - ly) <= tolerance);
    if (onSeam && freezeSeams) return { x: p.x, y: p.y };
    const jitterY = onSeam ? 0 : (rng() - 0.5) * 2 * amount;
    return {
      x: p.x + (rng() - 0.5) * 2 * amount,
      y: p.y + jitterY,
    };
  });
}

// ---------------------------------------------------------------------------
// Normalización y construcción de paths
// ---------------------------------------------------------------------------

/**
 * Bounding box de grupos de puntos en espacio local.
 * @param {FPoint[][]} groups
 * @returns {{ minX: number; minY: number; maxX: number; maxY: number }}
 */
export function boundsOfFantasyGroups(groups) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pts of groups) {
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

export const DEFAULT_TERRAIN_HEIGHT_PX = 48;
export const DEFAULT_CASTLE_SIZE_PX = 120;

/** Tras el cálculo de altura del zócalo, escala en pantalla (−20 %). */
export const PLINTH_SCREEN_HEIGHT_FACTOR = 0.8;

/**
 * Altura local del zócalo para que en pantalla ocupe terrainHeightPx (castillo en y≥0).
 * @param {number} heightAbove
 * @param {number} [terrainHeightPx]
 * @param {number} [castleSizePx]
 * @returns {number}
 */
export function computePlinthLocalHeight(heightAbove, terrainHeightPx, castleSizePx) {
  const terrain = terrainHeightPx ?? DEFAULT_TERRAIN_HEIGHT_PX;
  const castle = Math.max(castleSizePx ?? DEFAULT_CASTLE_SIZE_PX, 1);
  const r = Math.min(0.48, Math.max(0.05, terrain / castle));
  const above = Math.max(heightAbove, 1);
  const raw = Math.max(6, (above * r) / (1 - r));
  return raw * PLINTH_SCREEN_HEIGHT_FACTOR;
}

/**
 * Recorta piezas al ancho del zócalo (excepto el propio plinth).
 * @param {{ role: string; outer: FPoint[] }[]} parts
 * @param {number} left
 * @param {number} right
 */
export function clampPartsToEnvelope(parts, left, right) {
  for (const p of parts) {
    if (p.role === "plinth") continue;
    p.outer = p.outer.map((pt) => ({
      x: Math.max(left, Math.min(right, pt.x)),
      y: pt.y,
    }));
  }
}

/**
 * @param {{ outer: FPoint[] }[]} parts
 * @returns {{ minX: number; maxX: number }}
 */
export function localBoundsFromParts(parts) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of parts) {
    for (const pt of p.outer) {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
    }
  }
  return { minX, maxX };
}

/**
 * Escala piezas en espacio local (Y desde el suelo y=0; X relativo a un eje).
 * @param {{ outer: FPoint[]; holes: FPoint[][] }[]} parts
 * @param {number} axis
 * @param {number} scale
 */
export function scaleFantasyPartsLocal(parts, axis, scale) {
  for (const p of parts) {
    const mapPt = (pt) => ({
      x: axis + (pt.x - axis) * scale,
      y: pt.y * scale,
    });
    p.outer = p.outer.map(mapPt);
    p.holes = p.holes.map((ring) => ring.map(mapPt));
  }
}

/**
 * Normaliza grupos de puntos en espacio local y-up al espacio SVG (y-down) 0..100.
 * Por defecto ancla el suelo local (minY) al borde inferior del viewBox (y=100).
 * @param {FPoint[][]} groups
 * @param {{ anchorY?: 'bottom' | 'center'; scaleBy?: 'max' | 'height'; bottomInset?: number; heightFloor?: number }} [opts]
 * @returns {FPoint[][]}
 */
export function normalizeFantasyGroups(groups, opts = {}) {
  const { anchorY = "bottom", scaleBy = "max", bottomInset = 0, heightFloor = 0 } = opts;
  if (groups.length === 0 || groups.every((g) => g.length === 0)) return [];

  const { minX, minY, maxX, maxY } = boundsOfFantasyGroups(groups);
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;
  const size = scaleBy === "height"
    ? Math.max(contentH, heightFloor)
    : Math.max(contentW, contentH, heightFloor);
  const usable = Math.max(1, 100 - bottomInset);
  const scale = usable / size;
  const padX = (100 - contentW * scale) / 2;
  const floorY = 100 - bottomInset;

  if (anchorY === "bottom") {
    return groups.map((pts) =>
      pts.map((p) => ({
        x: (p.x - minX) * scale + padX,
        y: floorY - (p.y - minY) * scale,
      })),
    );
  }

  // Modo legacy: centrado en el cuadrado
  const padY = (size - contentH) / 2;
  const padXLegacy = (size - contentW) / 2;
  return groups.map((pts) =>
    pts.map((p) => ({
      x: ((p.x - minX + padXLegacy) / size) * 100,
      y: ((maxY - p.y + padY) / size) * 100,
    })),
  );
}

/**
 * Convierte un array de puntos SVG normalizados a un string de path SVG.
 * @param {FPoint[]} points
 * @param {boolean} [closed]
 * @returns {string}
 */
export function pointsToPath(points, closed = true) {
  if (points.length === 0) return "";
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  if (closed) d += " Z";
  return d;
}

/**
 * Construye el `d` de un `<path>` con sustracción evenodd:
 * primer subpath = forma exterior; subpaths siguientes = huecos.
 * @param {FPoint[]} outerRing  puntos en SVG space (normalizados)
 * @param {FPoint[][]} holeRings
 * @returns {string}
 */
export function buildPartPath(outerRing, holeRings, opts = {}) {
  const closed = !opts.open;
  const parts = [pointsToPath(outerRing, closed)];
  for (const hole of holeRings) {
    if (hole.length > 0) parts.push(pointsToPath(hole));
  }
  return parts.join(" ");
}
