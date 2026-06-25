/** Opacidad máxima del HUD y la línea (40 % visible). */
export const PROXIMITY_VISUAL_OPACITY = 0.4;

/** Distancia efectiva (px) a la que el HUD alcanza opacidad plena. */
export const PROXIMITY_INNER_PX = 68;

/** Distancia efectiva (px) a la que el HUD desaparece por completo. */
export const PROXIMITY_OUTER_PX = 172;

/**
 * Opacidad 0→1 al acercarse y 1→0 al alejarse (fade in/out lineal).
 * @param {number} distancePx Distancia centro-centro menos radios aproximados.
 * @param {number} [inner]
 * @param {number} [outer]
 */
export function proximityFade(distancePx, inner = PROXIMITY_INNER_PX, outer = PROXIMITY_OUTER_PX) {
  if (distancePx >= outer) return 0;
  if (distancePx <= inner) return 1;
  return 1 - (distancePx - inner) / (outer - inner);
}

/**
 * @param {DOMRect} rect
 * @param {DOMRect} layerRect
 */
export function rectCenterInLayer(rect, layerRect) {
  return {
    x: rect.left + rect.width / 2 - layerRect.left,
    y: rect.top + rect.height / 2 - layerRect.top,
  };
}

/**
 * @param {HTMLElement} layer
 * @returns {{ id: string; x: number; y: number; radius: number }[]}
 */
export function collectPlanetPositions(layer) {
  const layerRect = layer.getBoundingClientRect();
  if (!layerRect.width || !layerRect.height) return [];

  /** @type {{ id: string; x: number; y: number; radius: number }[]} */
  const planets = [];

  for (const runner of layer.querySelectorAll(".loader-orbit-runner")) {
    const id = runner.dataset.planetId;
    if (!id) continue;

    const planetEl = runner.querySelector(".loader-planet");
    const target = planetEl ?? runner;
    const rect = target.getBoundingClientRect();
    if (!rect.width) continue;

    const center = rectCenterInLayer(rect, layerRect);
    planets.push({
      id,
      x: center.x,
      y: center.y,
      radius: Math.max(rect.width, rect.height) / 2,
    });
  }

  return planets;
}

/**
 * @param {{ x: number; y: number; radius: number }} ship
 * @param {{ x: number; y: number; radius: number }} planet
 */
export function effectiveProximityDistance(ship, planet) {
  const d = Math.hypot(ship.x - planet.x, ship.y - planet.y);
  return Math.max(0, d - ship.radius - planet.radius);
}

/**
 * @param {{ x: number; y: number; radius: number }} ship
 * @param {{ id: string; x: number; y: number; radius: number }[]} planets
 */
export function nearestPlanetProximity(ship, planets) {
  let best = /** @type {{ planet: typeof planets[number]; fade: number } | null} */ (null);

  for (const planet of planets) {
    const fade = proximityFade(effectiveProximityDistance(ship, planet));
    if (fade <= 0) continue;
    if (!best || fade > best.fade) {
      best = { planet, fade };
    }
  }

  return best;
}

/** Escala del HUD respecto a la silueta de la nave. */
export const HUD_SIZE_SCALE = 1.755;

/** Rotación fija en espacio de pantalla (base del hexágono paralela al borde inferior). */
export const HUD_SCREEN_ROTATION_DEG = 60;

/** Hexágono con borde inferior plano (vértices a 0°, 60°, …). */
const HEX_POINTS = "92,50 71,86 29,86 8,50 29,14 71,14";

/** Compensa HUD_SCREEN_ROTATION_DEG para dejar la base horizontal en pantalla. */
const HEX_INNER_ROTATION_DEG = -HUD_SCREEN_ROTATION_DEG;

/**
 * HUD en espacio de pantalla (hermano de la nave en la capa, sin heredar rotación).
 * @param {string} shipId
 */
export function createShipProximityHud(shipId) {
  const hud = document.createElement("div");
  hud.className = `loader-ship-hud loader-ship-hud--${shipId}`;
  hud.dataset.shipId = shipId;
  hud.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "loader-ship-hud__svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("transform", `rotate(${HEX_INNER_ROTATION_DEG} 50 50)`);

  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  poly.setAttribute("class", "loader-ship-hud__hex");
  poly.setAttribute("points", HEX_POINTS);
  group.appendChild(poly);
  svg.appendChild(group);
  hud.appendChild(svg);

  return hud;
}

/**
 * Capa SVG para líneas discontinuas HUD → planeta.
 * @param {HTMLElement} layer
 */
export function createProximityLinesLayer(layer) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "loader-proximity-lines");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  layer.appendChild(svg);

  /** @type {Map<string, SVGLineElement>} */
  const lines = new Map();

  function ensureLine(shipId) {
    let line = lines.get(shipId);
    if (!line) {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "loader-proximity-line");
      line.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(line);
      lines.set(shipId, line);
    }
    return line;
  }

  return {
    /**
     * @param {number} w
     * @param {number} h
     */
    resize(w, h) {
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    },

    /**
     * @param {string} shipId
     * @param {{ x: number; y: number }} from
     * @param {{ x: number; y: number }} to
     * @param {number} opacity
     */
    updateLine(shipId, from, to, opacity) {
      const line = ensureLine(shipId);
      line.setAttribute("x1", String(from.x));
      line.setAttribute("y1", String(from.y));
      line.setAttribute("x2", String(to.x));
      line.setAttribute("y2", String(to.y));
      line.style.opacity = String(opacity);
      line.style.display = opacity > 0.01 ? "" : "none";
    },

    /** @param {string} shipId */
    hideLine(shipId) {
      const line = lines.get(shipId);
      if (line) {
        line.style.opacity = "0";
        line.style.display = "none";
      }
    },

    hideAll() {
      for (const line of lines.values()) {
        line.style.opacity = "0";
        line.style.display = "none";
      }
    },

    destroy() {
      svg.remove();
      lines.clear();
    },
  };
}
