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
  const n = Math.max(2, count);
  const merW = (w / n) * 0.55;
  const span = w - merW;

  /** @type {FPoint[]} */
  const pts = [];

  pts.push({ x: cx - hw, y: baseY });

  for (let i = 0; i < n; i++) {
    const left = (cx - hw) + (n === 1 ? 0 : (i / (n - 1)) * span);
    const right = left + merW;
    pts.push(
      { x: left, y: baseY },
      { x: left, y: baseY + merH },
      { x: right, y: baseY + merH },
      { x: right, y: baseY },
    );
    if (i < n - 1) {
      const nextLeft = (cx - hw) + ((i + 1) / (n - 1)) * span;
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

/**
 * Normaliza grupos de puntos en espacio local y-up al espacio SVG (y-down) 0..100.
 * Por defecto ancla el suelo local (minY) al borde inferior del viewBox (y=100).
 * @param {FPoint[][]} groups
 * @param {{ anchorY?: 'bottom' | 'center'; scaleBy?: 'max' | 'height'; bottomInset?: number }} [opts]
 * @returns {FPoint[][]}
 */
export function normalizeFantasyGroups(groups, opts = {}) {
  const { anchorY = "bottom", scaleBy = "max", bottomInset = 0 } = opts;
  if (groups.length === 0 || groups.every((g) => g.length === 0)) return [];

  const { minX, minY, maxX, maxY } = boundsOfFantasyGroups(groups);
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;
  const size = scaleBy === "height" ? contentH : Math.max(contentW, contentH);
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
export function buildPartPath(outerRing, holeRings) {
  const parts = [pointsToPath(outerRing)];
  for (const hole of holeRings) {
    if (hole.length > 0) parts.push(pointsToPath(hole));
  }
  return parts.join(" ");
}
