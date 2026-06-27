/**
 * Primitivas de geometría procedural para elementos de fantasía.
 *
 * Espacio de coordenadas local: x = horizontal, y = altura desde el suelo (y-up).
 * La función `normalizeFantasyGroups` convierte a SVG (y-down) y normaliza 0..100.
 *
 * @module loader-fantasy-geom
 */

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
 * Contorno de almenas (merlones + cuerpo base).
 * @param {number} cx
 * @param {number} baseY  base del parapeto (suelo de la franja de almenas)
 * @param {number} w
 * @param {number} count  número de merlones
 * @param {number} merH  altura del merlón
 * @returns {FPoint[]}
 */
export function merlons(cx, baseY, w, count, merH) {
  const hw = w / 2;
  const step = w / count;
  const merW = step * 0.55;
  const gapW = step - merW;

  /** @type {FPoint[]} */
  const pts = [];

  pts.push({ x: cx - hw, y: baseY });

  for (let i = 0; i < count; i++) {
    const left = cx - hw + i * step;
    const right = left + merW;
    pts.push(
      { x: left, y: baseY },
      { x: left, y: baseY + merH },
      { x: right, y: baseY + merH },
      { x: right, y: baseY },
    );
    if (i < count - 1) {
      const nextLeft = right + gapW;
      pts.push({ x: nextLeft, y: baseY });
    }
  }

  pts.push({ x: cx + hw, y: baseY });
  return pts;
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
    // Arco ojival: parte recta + dos segmentos curvos que se cruzan en la cima
    const straightH = h * 0.25;
    const apexY = baseY + h;
    /** @type {FPoint[]} */
    const pts = [
      { x: cx - hw, y: baseY },
      { x: cx + hw, y: baseY },
      { x: cx + hw, y: baseY + straightH },
    ];
    // Lado derecho: de (cx+hw, baseY+straightH) hacia el ápice
    const segs = Math.max(4, Math.floor(segments / 2));
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const x = (cx + hw) + (cx - (cx + hw)) * t;
      const y = (baseY + straightH) + (apexY - (baseY + straightH)) * t;
      // Curvatura hacia afuera (característica del gótico)
      const bulge = Math.sin(t * Math.PI) * hw * 0.2;
      pts.push({ x: x + bulge, y });
    }
    // Lado izquierdo: de la cima hacia (cx-hw, baseY+straightH)
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const x = cx + (cx - hw - cx) * t;
      const y = apexY + ((baseY + straightH) - apexY) * t;
      const bulge = Math.sin((1 - t) * Math.PI) * hw * 0.2;
      pts.push({ x: x - bulge, y });
    }
    pts.push({ x: cx - hw, y: baseY + straightH });
    return pts;
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
 * @param {'needle'|'ball'|'cross'} [kind]
 * @returns {FPoint[][]}
 */
export function finial(cx, baseY, h, kind = "needle") {
  if (kind === "ball") {
    const r = h / 2;
    return [dome(cx, baseY, r, r * 0.85)];
  }
  if (kind === "cross") {
    const vW = h * 0.15;
    const hW = h * 0.45;
    const hH = h * 0.15;
    return [
      rect(cx, baseY, vW, h),          // palo vertical
      rect(cx, baseY + h * 0.55, hW, hH), // travesaño horizontal
    ];
  }
  // needle (default)
  return [[
    { x: cx - h * 0.07, y: baseY },
    { x: cx + h * 0.07, y: baseY },
    { x: cx, y: baseY + h },
  ]];
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

/**
 * Normaliza grupos de puntos en espacio local y-up al espacio SVG (y-down) 0..100.
 * Por defecto ancla el suelo local (minY) al borde inferior del viewBox (y=100).
 * @param {FPoint[][]} groups
 * @param {{ anchorY?: 'bottom' | 'center' }} [opts]
 * @returns {FPoint[][]}
 */
export function normalizeFantasyGroups(groups, opts = {}) {
  const { anchorY = "bottom" } = opts;
  if (groups.length === 0 || groups.every((g) => g.length === 0)) return [];

  const { minX, minY, maxX, maxY } = boundsOfFantasyGroups(groups);
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;
  const size = Math.max(contentW, contentH);
  const scale = 100 / size;
  const padX = (100 - contentW * scale) / 2;

  if (anchorY === "bottom") {
    return groups.map((pts) =>
      pts.map((p) => ({
        x: (p.x - minX) * scale + padX,
        // minY (suelo local) → y=100; sube hacia arriba en SVG
        y: 100 - (p.y - minY) * scale,
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
export function buildPartPath(outerRing, holeRings) {
  const parts = [pointsToPath(outerRing)];
  for (const hole of holeRings) {
    if (hole.length > 0) parts.push(pointsToPath(hole));
  }
  return parts.join(" ");
}
