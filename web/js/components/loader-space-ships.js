import { generateShipForSlot, randomRollSeed } from "./loader-ship-procedural.js";

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

  ship.appendChild(svg);
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

/**
 * @param {SVGPathElement} path
 * @param {HTMLElement} layer
 * @param {number} t
 * @param {number} offsetPx
 */
function placeOnParallelPath(path, layer, t, offsetPx) {
  const length = path.getTotalLength();
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

  const ships = SPACESHIPS.map((spec) => ({
    spec,
    el: createShipElement(spec, rollSeed),
    lastProgress: spec.phase,
  }));

  for (const { el } of ships) {
    el.style.opacity = "0";
    layer.appendChild(el);
  }

  if (reducedMotion) {
    return { destroy() {}, sync() {} };
  }

  let rafId = 0;

  function sync() {
    for (const ship of ships) {
      const orbit = orbitById.get(ship.spec.orbitId);
      if (!orbit) continue;
      const pos = placeOnParallelPath(
        orbit.path,
        layer,
        ship.lastProgress,
        ship.spec.parallelOffset,
      );
      if (!pos) continue;
      ship.el.style.left = pos.left;
      ship.el.style.top = pos.top;
      ship.el.style.transform = `translate(-50%, -50%) rotate(${pos.angle}deg)`;
    }
  }

  function frame(now) {
    for (const ship of ships) {
      const orbit = orbitById.get(ship.spec.orbitId);
      if (!orbit) {
        ship.el.style.opacity = "0";
        continue;
      }

      const state = shipProgress(ship.spec, now);
      if (!state) {
        ship.el.style.opacity = "0";
        continue;
      }

      ship.lastProgress = state.t;
      const pos = placeOnParallelPath(
        orbit.path,
        layer,
        state.t,
        ship.spec.parallelOffset,
      );
      if (!pos) continue;

      ship.el.style.left = pos.left;
      ship.el.style.top = pos.top;
      ship.el.style.opacity = String(state.opacity);
      ship.el.style.transform = `translate(-50%, -50%) rotate(${pos.angle}deg)`;
    }
    rafId = requestAnimationFrame(frame);
  }

  sync();
  rafId = requestAnimationFrame(frame);

  return {
    sync,
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}

export { SPACESHIPS };
