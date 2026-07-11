import { subscribeLoaderAnimationFrame } from "./loader-animation-frame.js";
import { generateShipForSlot, randomRollSeed } from "./loader-ship-procedural.js";
import {
  collectPlanetPositions,
  createProximityLinesLayer,
  createShipProximityHud,
  HUD_SCREEN_ROTATION_DEG,
  HUD_SIZE_SCALE,
  nearestPlanetProximity,
  PROXIMITY_VISUAL_OPACITY,
  rectCenterInLayer,
} from "./loader-ship-proximity-hud.js";

/**
 * @typedef {'fighter' | 'interceptor' | 'gunship' | 'shuttle'} ShipArchetype
 */

/**
 * @typedef {{
 *   id: string;
 *   orbitId: string;
 *   archetype?: ShipArchetype;
 *   size: number;
 *   parallelOffset: number;
 *   durationMs: number;
 *   delayMs: number;
 *   phase: number;
 *   flightStart: number;
 *   flightEnd: number;
 * }} ShipFlightSpec
 */

/**
 * @typedef {{
 *   id: string;
 *   path: SVGPathElement;
 *   durationMs: number;
 *   delayMs: number;
 * }} OrbitPathBinding
 */

/** @type {ShipFlightSpec[]} */
const SPACESHIPS = [
  {
    id: "alpha",
    orbitId: "main",
    archetype: "fighter",
    size: 50,
    parallelOffset: -30,
    durationMs: 17000,
    delayMs: 800,
    phase: 0.12,
    flightStart: 0.04,
    flightEnd: 0.96,
  },
  {
    id: "beta",
    orbitId: "secondary",
    archetype: "interceptor",
    size: 52,
    parallelOffset: 28,
    durationMs: 15000,
    delayMs: 3200,
    phase: 0.38,
    flightStart: 0.06,
    flightEnd: 0.94,
  },
  {
    id: "gamma",
    orbitId: "tertiary",
    archetype: "gunship",
    size: 54,
    parallelOffset: -26,
    durationMs: 19000,
    delayMs: 4500,
    phase: 0.55,
    flightStart: 0.05,
    flightEnd: 0.95,
  },
  {
    id: "delta",
    orbitId: "quaternary",
    archetype: "shuttle",
    size: 51,
    parallelOffset: 26,
    durationMs: 16000,
    delayMs: 7500,
    phase: 0.22,
    flightStart: 0.08,
    flightEnd: 0.92,
  },
  {
    id: "epsilon",
    orbitId: "quinary",
    archetype: "fighter",
    size: 48,
    parallelOffset: -28,
    durationMs: 14000,
    delayMs: 2100,
    phase: 0.68,
    flightStart: 0.07,
    flightEnd: 0.93,
  },
  {
    id: "zeta",
    orbitId: "main",
    archetype: "interceptor",
    size: 50,
    parallelOffset: 32,
    durationMs: 18000,
    delayMs: 10000,
    phase: 0.74,
    flightStart: 0.1,
    flightEnd: 0.9,
  },
];

/**
 * @param {ShipFlightSpec} spec
 * @param {number} rollSeed
 */
function createShipElement(spec, rollSeed) {
  const generated = generateShipForSlot(spec.id, rollSeed, {
    hintArchetype: spec.archetype,
    baseSize: spec.size,
  });
  const ship = document.createElement("div");
  ship.className = `loader-spaceship loader-spaceship--${spec.id} loader-spaceship--${generated.archetype}`;
  ship.style.setProperty("--ship-w", `${generated.display.w}px`);
  ship.style.setProperty("--ship-h", `${generated.display.h}px`);
  ship.style.setProperty("--ship-size", `${Math.max(generated.display.w, generated.display.h)}px`);
  ship.dataset.archetype = generated.archetype;
  ship.dataset.style = generated.style;
  ship.dataset.orbitId = spec.orbitId;

  const body = document.createElement("div");
  body.className = "loader-spaceship__body";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", generated.viewBox);
  svg.setAttribute("class", "loader-spaceship__svg");
  svg.setAttribute("aria-hidden", "true");

  for (const d of generated.paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "#fff");
    svg.appendChild(path);
  }

  body.appendChild(svg);
  ship.appendChild(body);
  return ship;
}

/**
 * @param {number} p
 */
function fadeAtEnds(p) {
  const edge = 0.08;
  if (p < edge) return p / edge;
  if (p > 1 - edge) return (1 - p) / edge;
  return 1;
}

/**
 * @param {ShipFlightSpec} spec
 * @param {number} now
 */
function shipProgress(spec, now) {
  const cycle = ((now + spec.delayMs) % spec.durationMs) / spec.durationMs;
  const along = (cycle + spec.phase) % 1;
  if (along < spec.flightStart || along > spec.flightEnd) return null;
  const span = spec.flightEnd - spec.flightStart;
  const local = (along - spec.flightStart) / span;
  return { t: along, opacity: fadeAtEnds(local) };
}

function pathLengthCached(path) {
  const raw = path.dataset.loaderPathLen;
  if (raw) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  const length = path.getTotalLength() || 0;
  if (length > 0) path.dataset.loaderPathLen = String(length);
  return length;
}

/**
 * @param {SVGPathElement} path
 * @param {HTMLElement} layer
 * @param {number} t
 * @param {number} offsetPx
 */
function placeOnParallelPath(path, layer, t, offsetPx) {
  const length = pathLengthCached(path);
  if (!length) return null;

  const w = layer.clientWidth;
  const h = layer.clientHeight;
  if (!w || !h) return null;

  const dist = length * t;
  const point = path.getPointAtLength(dist);
  const aheadDist = Math.min(dist + Math.max(length * 0.004, 2), length);
  const ahead = path.getPointAtLength(aheadDist);
  const dx = ahead.x - point.x;
  const dy = ahead.y - point.y;
  const segLen = Math.hypot(dx, dy) || 1;
  const nx = -dy / segLen;
  const ny = dx / segLen;
  const x = point.x + nx * offsetPx;
  const y = point.y + ny * offsetPx;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

  return {
    left: `${(x / w) * 100}%`,
    top: `${(y / h) * 100}%`,
    angle,
  };
}

/**
 * Naves procedurales en carriles paralelos a los arcos orbitales.
 * @param {HTMLElement} layer
 * @param {{ reducedMotion?: boolean; orbits?: OrbitPathBinding[] }} [options]
 */
export function mountSpaceShips(layer, { reducedMotion = false, orbits = [] } = {}) {
  const orbitById = new Map(orbits.map((o) => [o.id, o]));
  const rollSeed = randomRollSeed();

  const ships = SPACESHIPS.map((spec) => {
    const el = createShipElement(spec, rollSeed);
    const hud = createShipProximityHud(spec.id);
    hud.style.setProperty("--ship-w", el.style.getPropertyValue("--ship-w"));
    hud.style.setProperty("--ship-h", el.style.getPropertyValue("--ship-h"));
    hud.style.setProperty("--ship-size", el.style.getPropertyValue("--ship-size"));
    hud.style.setProperty("--hud-scale", String(HUD_SIZE_SCALE));
    return {
      spec,
      el,
      body: /** @type {HTMLElement} */ (el.querySelector(".loader-spaceship__body")),
      hud,
      lastProgress: spec.phase,
    };
  });

  const proximityLines = createProximityLinesLayer(layer);

  for (const ship of ships) {
    ship.el.style.opacity = "0";
    ship.hud.style.opacity = "0";
    layer.appendChild(ship.hud);
    layer.appendChild(ship.el);
  }

  if (reducedMotion) {
    return {
      destroy() {
        proximityLines.destroy();
        for (const ship of ships) {
          ship.hud.remove();
        }
      },
      sync() {},
    };
  }

  /**
   * @param {HTMLElement} shipEl
   * @param {HTMLElement} layerEl
   */
  function shipCenterInLayer(shipEl, layerEl) {
    const layerRect = layerEl.getBoundingClientRect();
    const rect = shipEl.getBoundingClientRect();
    return {
      ...rectCenterInLayer(rect, layerRect),
      radius: Math.max(rect.width, rect.height) / 2,
    };
  }

  /**
   * @param {typeof ships[number]} ship
   * @param {number} shipOpacity
   * @param {{ id: string; x: number; y: number; radius: number }[]} planets
   */
  function updateProximityHud(ship, shipOpacity, planets) {
    const hud = ship.hud;
    if (!hud) return;

    if (shipOpacity <= 0.02) {
      hud.style.opacity = "0";
      proximityLines.hideLine(ship.spec.id);
      return;
    }

    const center = shipCenterInLayer(ship.el, layer);
    const match = nearestPlanetProximity(center, planets);

    if (!match) {
      hud.style.opacity = "0";
      proximityLines.hideLine(ship.spec.id);
      return;
    }

    const fade = match.fade * shipOpacity * PROXIMITY_VISUAL_OPACITY;
    hud.style.opacity = String(fade);
    proximityLines.updateLine(
      ship.spec.id,
      center,
      { x: match.planet.x, y: match.planet.y },
      fade,
    );
  }

  /**
   * @param {typeof ships[number]} ship
   * @param {{ left: string; top: string; angle: number }} pos
   */
  function placeShip(ship, pos) {
    ship.el.style.left = pos.left;
    ship.el.style.top = pos.top;
    ship.el.style.transform = "translate(-50%, -50%)";
    ship.body.style.transform = `rotate(${pos.angle}deg)`;
    ship.hud.style.left = pos.left;
    ship.hud.style.top = pos.top;
    ship.hud.style.transform = `translate(-50%, -50%) rotate(${HUD_SCREEN_ROTATION_DEG}deg)`;
  }

  function sync() {
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    if (w && h) proximityLines.resize(w, h);
    const planets = collectPlanetPositions(layer);

    for (const ship of ships) {
      const orbit = orbitById.get(ship.spec.orbitId);
      if (!orbit) {
        ship.el.style.opacity = "0";
        updateProximityHud(ship, 0, planets);
        continue;
      }
      const pos = placeOnParallelPath(
        orbit.path,
        layer,
        ship.lastProgress,
        ship.spec.parallelOffset,
      );
      if (!pos) continue;
      placeShip(ship, pos);
      const opacity = parseFloat(ship.el.style.opacity) || 0;
      updateProximityHud(ship, opacity, planets);
    }
  }

  let unsub = subscribeLoaderAnimationFrame((now) => {
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    if (w && h) proximityLines.resize(w, h);
    const planets = collectPlanetPositions(layer);

    for (const ship of ships) {
      const orbit = orbitById.get(ship.spec.orbitId);
      if (!orbit) {
        ship.el.style.opacity = "0";
        updateProximityHud(ship, 0, planets);
        continue;
      }

      const state = shipProgress(ship.spec, now);
      if (!state) {
        ship.el.style.opacity = "0";
        updateProximityHud(ship, 0, planets);
        continue;
      }

      ship.lastProgress = state.t;
      const pos = placeOnParallelPath(
        orbit.path,
        layer,
        state.t,
        ship.spec.parallelOffset,
      );
      if (!pos) {
        updateProximityHud(ship, 0, planets);
        continue;
      }

      placeShip(ship, pos);
      ship.el.style.opacity = String(state.opacity);
      updateProximityHud(ship, state.opacity, planets);
    }
  });

  sync();

  return {
    sync,
    destroy() {
      unsub();
      proximityLines.destroy();
      for (const ship of ships) {
        ship.hud.remove();
      }
    },
  };
}

export { SPACESHIPS };
