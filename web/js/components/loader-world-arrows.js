/**
 * Generador procedural de flechas HUD (sci-fi) y heráldicas (fantasía).
 *
 * Sci-fi: doble chevron angular (navegación HUD).
 * Fantasía: flecha con aletas en la base (heráldica).
 *
 * @module loader-world-arrows
 */

/** @typedef {'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right'} ArrowDirection */
/** @typedef {'sci-fi' | 'fantasy'} ArrowTheme */

export const ARROW_DIRECTIONS = Object.freeze(
  /** @type {ArrowDirection[]} */ ([
    "up",
    "down",
    "left",
    "right",
    "up-left",
    "up-right",
    "down-left",
    "down-right",
  ]),
);

export const ARROW_THEMES = Object.freeze(/** @type {ArrowTheme[]} */ (["sci-fi", "fantasy"]));

const BASE_SIZE = 100;
const BASE_CENTER = BASE_SIZE / 2;

/** @type {Record<ArrowDirection, number>} */
const DIRECTION_DEG = {
  right: 0,
  "down-right": 45,
  down: 90,
  "down-left": 135,
  left: 180,
  "up-left": -135,
  "up-right": -45,
  up: -90,
};

/**
 * @param {number} n
 */
function fmt(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {{ x: number; y: number }[]} points
 * @param {boolean} [closed]
 */
export function pointsToPath(points, closed = true) {
  if (points.length === 0) return "";
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  if (closed) d += " Z";
  return d;
}

/**
 * @param {{ x: number; y: number }[]} points
 * @param {number} cx
 * @param {number} cy
 * @param {number} deg
 */
export function rotatePoints(points, cx, cy, deg) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map(({ x, y }) => {
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  });
}

/**
 * @param {{ x: number; y: number }[]} points
 * @param {number} toSize
 * @param {number} [fromSize]
 */
export function scalePoints(points, toSize, fromSize = BASE_SIZE) {
  const s = toSize / fromSize;
  return points.map(({ x, y }) => ({ x: x * s, y: y * s }));
}

/**
 * Chevron angular simple (bloque HUD).
 * @param {number} x0
 * @param {number} yTop
 * @param {number} yBot
 * @param {number} xTip
 * @param {number} xInner
 * @returns {{ x: number; y: number }[]}
 */
function sciFiChevron(x0, yTop, yBot, xTip, xInner) {
  const yMid = (yTop + yBot) / 2;
  const notch = (yBot - yTop) * 0.22;
  return [
    { x: x0, y: yTop },
    { x: xInner, y: yTop },
    { x: xInner, y: yMid - notch },
    { x: xTip, y: yMid },
    { x: xInner, y: yMid + notch },
    { x: xInner, y: yBot },
    { x: x0, y: yBot },
  ];
}

/**
 * Sci-fi: doble chevron `>>` apuntando a la derecha.
 * @returns {{ x: number; y: number }[][]}
 */
function buildSciFiGlyphRight() {
  return [
    sciFiChevron(16, 30, 70, 58, 40),
    sciFiChevron(44, 34, 66, 84, 62),
  ];
}

/**
 * Fantasía: flecha heráldica con aletas en la base.
 * @returns {{ x: number; y: number }[][]}
 */
function buildFantasyGlyphRight() {
  return [
    [
      { x: 30, y: 28 },
      { x: 18, y: 42 },
      { x: 28, y: 50 },
      { x: 18, y: 58 },
      { x: 30, y: 72 },
      { x: 80, y: 50 },
    ],
  ];
}

/**
 * @param {ArrowTheme} theme
 * @returns {{ x: number; y: number }[][]}
 */
function baseGlyphGroups(theme) {
  return theme === "sci-fi" ? buildSciFiGlyphRight() : buildFantasyGlyphRight();
}

/**
 * @param {ArrowTheme} theme
 * @param {ArrowDirection} direction
 * @param {number} [viewSize]
 * @returns {{ x: number; y: number }[][]}
 */
export function buildWorldArrowGlyphGroups(theme, direction, viewSize = BASE_SIZE) {
  const deg = DIRECTION_DEG[direction];
  const groups = baseGlyphGroups(theme).map((pts) =>
    rotatePoints(pts, BASE_CENTER, BASE_CENTER, deg),
  );
  if (viewSize === BASE_SIZE) return groups;
  return groups.map((pts) => scalePoints(pts, viewSize, BASE_SIZE));
}

/**
 * @param {ArrowTheme} theme
 * @param {ArrowDirection} direction
 * @param {number} [viewSize]
 * @returns {string[]}
 */
export function generateWorldArrowGlyphPaths(theme, direction, viewSize = BASE_SIZE) {
  return buildWorldArrowGlyphGroups(theme, direction, viewSize).map((pts) => pointsToPath(pts));
}

/**
 * Silueta principal (primer path o unión lógica para tests).
 * @param {ArrowTheme} theme
 * @param {ArrowDirection} direction
 * @param {number} [viewSize]
 */
export function generateWorldArrowGlyph(theme, direction, viewSize = BASE_SIZE) {
  const paths = generateWorldArrowGlyphPaths(theme, direction, viewSize);
  return paths[0] ?? "";
}

/**
 * @param {ArrowTheme} theme
 * @param {ArrowDirection} direction
 * @param {number} [viewSize]
 * @returns {{ glyphs: string[]; viewSize: number }}
 */
export function generateWorldArrowFab(theme, direction, viewSize = 40) {
  const glyphs = generateWorldArrowGlyphPaths(theme, direction, viewSize);
  return { glyphs, viewSize };
}

/**
 * @param {number} [viewSize]
 */
export function buildWorldArrowCatalog(viewSize = 40) {
  /** @type {Record<string, { glyphs: string[] }>} */
  const catalog = {};
  for (const theme of ARROW_THEMES) {
    for (const direction of ARROW_DIRECTIONS) {
      const key = `${theme}/${direction}`;
      catalog[key] = { glyphs: generateWorldArrowGlyphPaths(theme, direction, viewSize) };
    }
  }
  return catalog;
}

/**
 * SVG interno del FAB: solo flecha(s) en positivo, sin placa.
 * @param {{
 *   theme: ArrowTheme;
 *   direction: ArrowDirection;
 *   viewSize?: number;
 *   fill?: string;
 * }} opts
 */
export function renderWorldArrowFabSvgInner(opts) {
  const { glyphs } = generateWorldArrowFab(opts.theme, opts.direction, opts.viewSize ?? 40);
  const fill = opts.fill ?? "#fff";
  return glyphs
    .map((d) => `<path class="legal-fab__glyph" d="${d}" fill="${fill}"/>`)
    .join("");
}
