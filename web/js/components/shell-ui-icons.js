/**
 * Catálogo procedural de iconos UI del shell (sci-fi | fantasy).
 * @module shell-ui-icons
 */

/** @typedef {'sci-fi' | 'fantasy'} UiIconTheme */
/** @typedef {'menu'|'theme-to-fantasy'|'theme-to-scifi'|'account'|'home'|'crew'|'settings'|'legal'|'signout'|'chevron'|'save'|'danger'|'add'|'close'} UiIconId */

export const SHELL_UI_ICON_THEMES = Object.freeze(
  /** @type {UiIconTheme[]} */ (["sci-fi", "fantasy"]),
);

export const SHELL_UI_ICON_IDS = Object.freeze(
  /** @type {UiIconId[]} */ ([
    "menu",
    "theme-to-fantasy",
    "theme-to-scifi",
    "account",
    "home",
    "crew",
    "settings",
    "legal",
    "signout",
    "chevron",
    "save",
    "danger",
    "add",
    "close",
  ]),
);

const BASE_SIZE = 100;

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
function pointsToPath(points, closed = true) {
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
 * @param {number} toSize
 * @param {number} [fromSize]
 */
function scalePoints(points, toSize, fromSize = BASE_SIZE) {
  const s = toSize / fromSize;
  return points.map(({ x, y }) => ({ x: x * s, y: y * s }));
}

/**
 * @param {UiIconTheme} theme
 * @param {UiIconId} id
 * @returns {{ x: number; y: number }[][]}
 */
function buildGlyphGroups(theme, id) {
  const sci = theme === "sci-fi";

  switch (id) {
    case "menu":
      return sci
        ? [
            [
              { x: 18, y: 28 },
              { x: 82, y: 28 },
              { x: 82, y: 36 },
              { x: 18, y: 36 },
            ],
            [
              { x: 18, y: 46 },
              { x: 70, y: 46 },
              { x: 70, y: 54 },
              { x: 18, y: 54 },
            ],
            [
              { x: 18, y: 64 },
              { x: 82, y: 64 },
              { x: 82, y: 72 },
              { x: 18, y: 72 },
            ],
          ]
        : [
            [
              { x: 20, y: 30 },
              { x: 80, y: 28 },
              { x: 82, y: 36 },
              { x: 18, y: 38 },
            ],
            [
              { x: 22, y: 47 },
              { x: 78, y: 45 },
              { x: 80, y: 53 },
              { x: 20, y: 55 },
            ],
            [
              { x: 18, y: 64 },
              { x: 82, y: 62 },
              { x: 84, y: 70 },
              { x: 16, y: 72 },
            ],
          ];

    case "theme-to-fantasy":
      // Castillo / torre
      return sci
        ? [
            [
              { x: 30, y: 78 },
              { x: 30, y: 42 },
              { x: 38, y: 42 },
              { x: 38, y: 30 },
              { x: 46, y: 30 },
              { x: 46, y: 42 },
              { x: 54, y: 42 },
              { x: 54, y: 30 },
              { x: 62, y: 30 },
              { x: 62, y: 42 },
              { x: 70, y: 42 },
              { x: 70, y: 78 },
            ],
            [
              { x: 42, y: 58 },
              { x: 58, y: 58 },
              { x: 58, y: 78 },
              { x: 42, y: 78 },
            ],
          ]
        : [
            [
              { x: 28, y: 78 },
              { x: 28, y: 44 },
              { x: 36, y: 44 },
              { x: 36, y: 28 },
              { x: 44, y: 36 },
              { x: 50, y: 24 },
              { x: 56, y: 36 },
              { x: 64, y: 28 },
              { x: 64, y: 44 },
              { x: 72, y: 44 },
              { x: 72, y: 78 },
            ],
            [
              { x: 44, y: 56 },
              { x: 56, y: 56 },
              { x: 56, y: 78 },
              { x: 44, y: 78 },
            ],
          ];

    case "theme-to-scifi":
      // Nave / anillo
      return sci
        ? [
            [
              { x: 50, y: 22 },
              { x: 62, y: 48 },
              { x: 78, y: 52 },
              { x: 62, y: 56 },
              { x: 50, y: 78 },
              { x: 38, y: 56 },
              { x: 22, y: 52 },
              { x: 38, y: 48 },
            ],
            [
              { x: 44, y: 48 },
              { x: 56, y: 48 },
              { x: 56, y: 56 },
              { x: 44, y: 56 },
            ],
          ]
        : [
            [
              { x: 50, y: 20 },
              { x: 66, y: 46 },
              { x: 80, y: 50 },
              { x: 66, y: 54 },
              { x: 50, y: 80 },
              { x: 34, y: 54 },
              { x: 20, y: 50 },
              { x: 34, y: 46 },
            ],
          ];

    case "account":
      return sci
        ? [
            // cabeza
            [
              { x: 50, y: 22 },
              { x: 62, y: 28 },
              { x: 64, y: 42 },
              { x: 56, y: 50 },
              { x: 44, y: 50 },
              { x: 36, y: 42 },
              { x: 38, y: 28 },
            ],
            // hombros
            [
              { x: 28, y: 78 },
              { x: 28, y: 62 },
              { x: 40, y: 54 },
              { x: 60, y: 54 },
              { x: 72, y: 62 },
              { x: 72, y: 78 },
            ],
          ]
        : [
            [
              { x: 50, y: 20 },
              { x: 64, y: 30 },
              { x: 62, y: 46 },
              { x: 50, y: 52 },
              { x: 38, y: 46 },
              { x: 36, y: 30 },
            ],
            [
              { x: 26, y: 80 },
              { x: 30, y: 60 },
              { x: 50, y: 52 },
              { x: 70, y: 60 },
              { x: 74, y: 80 },
            ],
          ];

    case "home":
      return sci
        ? [
            [
              { x: 50, y: 18 },
              { x: 82, y: 46 },
              { x: 72, y: 46 },
              { x: 72, y: 78 },
              { x: 28, y: 78 },
              { x: 28, y: 46 },
              { x: 18, y: 46 },
            ],
            [
              { x: 44, y: 54 },
              { x: 56, y: 54 },
              { x: 56, y: 78 },
              { x: 44, y: 78 },
            ],
          ]
        : [
            [
              { x: 50, y: 16 },
              { x: 84, y: 48 },
              { x: 74, y: 48 },
              { x: 74, y: 80 },
              { x: 26, y: 80 },
              { x: 26, y: 48 },
              { x: 16, y: 48 },
            ],
          ];

    case "crew":
      return sci
        ? [
            [
              { x: 32, y: 28 },
              { x: 42, y: 28 },
              { x: 42, y: 40 },
              { x: 32, y: 40 },
            ],
            [
              { x: 26, y: 72 },
              { x: 26, y: 48 },
              { x: 48, y: 48 },
              { x: 48, y: 72 },
            ],
            [
              { x: 58, y: 28 },
              { x: 68, y: 28 },
              { x: 68, y: 40 },
              { x: 58, y: 40 },
            ],
            [
              { x: 52, y: 72 },
              { x: 52, y: 48 },
              { x: 74, y: 48 },
              { x: 74, y: 72 },
            ],
          ]
        : [
            [
              { x: 34, y: 24 },
              { x: 44, y: 30 },
              { x: 42, y: 42 },
              { x: 34, y: 46 },
              { x: 26, y: 42 },
              { x: 24, y: 30 },
            ],
            [
              { x: 22, y: 76 },
              { x: 24, y: 54 },
              { x: 44, y: 50 },
              { x: 46, y: 76 },
            ],
            [
              { x: 66, y: 24 },
              { x: 76, y: 30 },
              { x: 74, y: 42 },
              { x: 66, y: 46 },
              { x: 58, y: 42 },
              { x: 56, y: 30 },
            ],
            [
              { x: 54, y: 76 },
              { x: 56, y: 54 },
              { x: 76, y: 50 },
              { x: 78, y: 76 },
            ],
          ];

    case "settings":
      return sci
        ? [
            [
              { x: 50, y: 18 },
              { x: 58, y: 22 },
              { x: 62, y: 30 },
              { x: 72, y: 32 },
              { x: 76, y: 40 },
              { x: 72, y: 48 },
              { x: 76, y: 56 },
              { x: 72, y: 64 },
              { x: 62, y: 66 },
              { x: 58, y: 74 },
              { x: 50, y: 78 },
              { x: 42, y: 74 },
              { x: 38, y: 66 },
              { x: 28, y: 64 },
              { x: 24, y: 56 },
              { x: 28, y: 48 },
              { x: 24, y: 40 },
              { x: 28, y: 32 },
              { x: 38, y: 30 },
              { x: 42, y: 22 },
            ],
            [
              { x: 44, y: 42 },
              { x: 56, y: 42 },
              { x: 56, y: 54 },
              { x: 44, y: 54 },
            ],
          ]
        : [
            [
              { x: 50, y: 16 },
              { x: 60, y: 22 },
              { x: 66, y: 34 },
              { x: 78, y: 38 },
              { x: 80, y: 50 },
              { x: 78, y: 62 },
              { x: 66, y: 66 },
              { x: 60, y: 78 },
              { x: 50, y: 84 },
              { x: 40, y: 78 },
              { x: 34, y: 66 },
              { x: 22, y: 62 },
              { x: 20, y: 50 },
              { x: 22, y: 38 },
              { x: 34, y: 34 },
              { x: 40, y: 22 },
            ],
            [
              { x: 44, y: 42 },
              { x: 56, y: 42 },
              { x: 56, y: 54 },
              { x: 44, y: 54 },
            ],
          ];

    case "legal":
      return sci
        ? [
            [
              { x: 30, y: 20 },
              { x: 70, y: 20 },
              { x: 70, y: 80 },
              { x: 30, y: 80 },
            ],
            [
              { x: 38, y: 32 },
              { x: 62, y: 32 },
              { x: 62, y: 38 },
              { x: 38, y: 38 },
            ],
            [
              { x: 38, y: 46 },
              { x: 62, y: 46 },
              { x: 62, y: 52 },
              { x: 38, y: 52 },
            ],
            [
              { x: 38, y: 60 },
              { x: 54, y: 60 },
              { x: 54, y: 66 },
              { x: 38, y: 66 },
            ],
          ]
        : [
            [
              { x: 28, y: 22 },
              { x: 68, y: 18 },
              { x: 74, y: 78 },
              { x: 34, y: 82 },
            ],
            [
              { x: 38, y: 34 },
              { x: 62, y: 30 },
              { x: 63, y: 38 },
              { x: 39, y: 42 },
            ],
            [
              { x: 40, y: 48 },
              { x: 64, y: 44 },
              { x: 65, y: 52 },
              { x: 41, y: 56 },
            ],
          ];

    case "signout":
      return sci
        ? [
            [
              { x: 22, y: 28 },
              { x: 48, y: 28 },
              { x: 48, y: 36 },
              { x: 30, y: 36 },
              { x: 30, y: 64 },
              { x: 48, y: 64 },
              { x: 48, y: 72 },
              { x: 22, y: 72 },
            ],
            [
              { x: 52, y: 42 },
              { x: 70, y: 42 },
              { x: 70, y: 34 },
              { x: 84, y: 50 },
              { x: 70, y: 66 },
              { x: 70, y: 58 },
              { x: 52, y: 58 },
            ],
          ]
        : [
            [
              { x: 20, y: 26 },
              { x: 50, y: 26 },
              { x: 50, y: 36 },
              { x: 32, y: 36 },
              { x: 32, y: 64 },
              { x: 50, y: 64 },
              { x: 50, y: 74 },
              { x: 20, y: 74 },
            ],
            [
              { x: 54, y: 40 },
              { x: 68, y: 40 },
              { x: 68, y: 30 },
              { x: 86, y: 50 },
              { x: 68, y: 70 },
              { x: 68, y: 60 },
              { x: 54, y: 60 },
            ],
          ];

    case "chevron":
      return sci
        ? [
            [
              { x: 30, y: 38 },
              { x: 50, y: 58 },
              { x: 70, y: 38 },
              { x: 76, y: 44 },
              { x: 50, y: 70 },
              { x: 24, y: 44 },
            ],
          ]
        : [
            [
              { x: 28, y: 36 },
              { x: 50, y: 60 },
              { x: 72, y: 36 },
              { x: 78, y: 44 },
              { x: 50, y: 72 },
              { x: 22, y: 44 },
            ],
          ];

    case "save":
      return sci
        ? [
            [
              { x: 24, y: 24 },
              { x: 76, y: 24 },
              { x: 76, y: 78 },
              { x: 24, y: 78 },
            ],
            [
              { x: 40, y: 16 },
              { x: 60, y: 16 },
              { x: 60, y: 26 },
              { x: 40, y: 26 },
            ],
            [
              { x: 32, y: 36 },
              { x: 68, y: 36 },
              { x: 68, y: 44 },
              { x: 32, y: 44 },
            ],
            [
              { x: 32, y: 50 },
              { x: 68, y: 50 },
              { x: 68, y: 58 },
              { x: 32, y: 58 },
            ],
          ]
        : [
            [
              { x: 26, y: 22 },
              { x: 74, y: 18 },
              { x: 78, y: 76 },
              { x: 30, y: 80 },
            ],
            [
              { x: 36, y: 36 },
              { x: 66, y: 34 },
              { x: 68, y: 44 },
              { x: 38, y: 46 },
            ],
            [
              { x: 38, y: 50 },
              { x: 66, y: 48 },
              { x: 68, y: 58 },
              { x: 40, y: 60 },
            ],
          ];

    case "danger":
      return sci
        ? [
            [
              { x: 50, y: 16 },
              { x: 84, y: 78 },
              { x: 16, y: 78 },
            ],
            [
              { x: 47, y: 40 },
              { x: 53, y: 40 },
              { x: 53, y: 60 },
              { x: 47, y: 60 },
            ],
            [
              { x: 47, y: 66 },
              { x: 53, y: 66 },
              { x: 53, y: 72 },
              { x: 47, y: 72 },
            ],
          ]
        : [
            [
              { x: 50, y: 14 },
              { x: 82, y: 74 },
              { x: 18, y: 74 },
            ],
            [
              { x: 46, y: 38 },
              { x: 54, y: 38 },
              { x: 54, y: 58 },
              { x: 46, y: 58 },
            ],
            [
              { x: 46, y: 64 },
              { x: 54, y: 64 },
              { x: 54, y: 72 },
              { x: 46, y: 72 },
            ],
          ];

    case "add":
      return sci
        ? [
            [
              { x: 44, y: 22 },
              { x: 56, y: 22 },
              { x: 56, y: 44 },
              { x: 78, y: 44 },
              { x: 78, y: 56 },
              { x: 56, y: 56 },
              { x: 56, y: 78 },
              { x: 44, y: 78 },
              { x: 44, y: 56 },
              { x: 22, y: 56 },
              { x: 22, y: 44 },
              { x: 44, y: 44 },
            ],
          ]
        : [
            [
              { x: 46, y: 20 },
              { x: 54, y: 22 },
              { x: 54, y: 44 },
              { x: 76, y: 42 },
              { x: 78, y: 50 },
              { x: 56, y: 52 },
              { x: 58, y: 78 },
              { x: 48, y: 80 },
              { x: 46, y: 54 },
              { x: 22, y: 56 },
              { x: 20, y: 46 },
              { x: 44, y: 44 },
            ],
          ];

    case "close":
      return sci
        ? [
            [
              { x: 28, y: 22 },
              { x: 36, y: 22 },
              { x: 50, y: 40 },
              { x: 64, y: 22 },
              { x: 72, y: 22 },
              { x: 56, y: 50 },
              { x: 72, y: 78 },
              { x: 64, y: 78 },
              { x: 50, y: 60 },
              { x: 36, y: 78 },
              { x: 28, y: 78 },
              { x: 44, y: 50 },
            ],
          ]
        : [
            [
              { x: 26, y: 24 },
              { x: 36, y: 20 },
              { x: 50, y: 38 },
              { x: 64, y: 20 },
              { x: 74, y: 24 },
              { x: 58, y: 50 },
              { x: 74, y: 76 },
              { x: 64, y: 80 },
              { x: 50, y: 62 },
              { x: 36, y: 80 },
              { x: 26, y: 76 },
              { x: 42, y: 50 },
            ],
          ];

    default:
      return [
        [
          { x: 40, y: 40 },
          { x: 60, y: 40 },
          { x: 60, y: 60 },
          { x: 40, y: 60 },
        ],
      ];
  }
}

/**
 * @param {{
 *   id: UiIconId;
 *   theme: UiIconTheme;
 *   viewSize?: number;
 *   fill?: string;
 * }} opts
 */
export function renderShellUiIconSvgInner(opts) {
  const viewSize = opts.viewSize ?? 40;
  const fill = opts.fill ?? "#fff";
  const groups = buildGlyphGroups(opts.theme, opts.id).map((pts) =>
    viewSize === BASE_SIZE ? pts : scalePoints(pts, viewSize, BASE_SIZE),
  );
  return groups
    .map((pts) => `<path class="shell-ui-icon__glyph" d="${pointsToPath(pts)}" fill="${fill}"/>`)
    .join("");
}
