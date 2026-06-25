/**
 * Arco circular (radio igual en X e Y). Centro fuera de pantalla.
 */
function orbitArc(cx, cy, r, startDeg, endDeg, sweep = 1) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const px = (deg) => cx + r * Math.cos(rad(deg));
  const py = (deg) => cy + r * Math.sin(rad(deg));
  const x1 = px(startDeg);
  const y1 = py(startDeg);
  const x2 = px(endDeg);
  const y2 = py(endDeg);
  let delta = endDeg - startDeg;
  if (sweep === 1 && delta < 0) delta += 360;
  if (sweep === 0 && delta > 0) delta -= 360;
  const large = Math.abs(delta) > 180 ? 1 : 0;
  const fmt = (n) => Math.round(n * 10) / 10;
  return `M ${fmt(x1)} ${fmt(y1)} A ${r} ${r} 0 ${large} ${sweep} ${fmt(x2)} ${fmt(y2)}`;
}

/** @type {const} */
const ORBIT_SYSTEMS = [
  {
    id: "main",
    anchor: "logo",
    entryAboveLogo: 50,
    exitAboveLogo: 150,
    blockRaisePx: 200,
    edgePad: 40,
    openness: 3.2,
    planet: 52,
    gas: true,
    duration: 56,
    delay: 0,
    still: 0.5,
    moonBands: [
      { orbitR: 34, dur: 8, moons: [{ size: 5, phase: 0 }, { size: 3, phase: 0.5 }] },
      { orbitR: 48, dur: 10, moons: [{ size: 6, phase: 0.15 }, { size: 4, phase: 0.65 }] },
      { orbitR: 62, dur: 12, moons: [{ size: 3, phase: 0.35 }, { size: 5, phase: 0.85 }] },
      { orbitR: 76, dur: 14, moons: [{ size: 2, phase: 0.55 }, { size: 4, phase: 0.05 }] },
    ],
  },
  {
    id: "secondary",
    anchor: "absolute",
    entryY: 16,
    exitY: 178,
    edgePad: 36,
    openness: 2.35,
    planet: 30,
    gas: false,
    duration: 44,
    delay: -18,
    still: 0.35,
    moonBands: [
      { orbitR: 22, dur: 9, moons: [{ size: 6, phase: 0.1 }] },
      { orbitR: 34, dur: 12, moons: [{ size: 7, phase: 0.35 }, { size: 5, phase: 0.72 }] },
    ],
  },
  {
    id: "tertiary",
    anchor: "custom",
    entryXPad: 36,
    entryY: 172,
    exitX: 0.5,
    exitY: -88,
    openness: 2.15,
    planet: 16,
    gas: false,
    duration: 40,
    delay: -12,
    still: 0.42,
    moonBands: [{ orbitR: 21, dur: 11, moons: [{ size: 14, phase: 0.25 }] }],
  },
  {
    id: "quaternary",
    anchor: "custom",
    entryXF: 0.6,
    entryY: -52,
    exitSide: "right",
    exitXPad: 36,
    exitY: 232,
    openness: 2.25,
    planet: 28,
    gas: false,
    duration: 48,
    delay: -8,
    still: 0.48,
    moonBands: [],
  },
  {
    id: "quinary",
    anchor: "custom",
    entryXPad: 36,
    entryY: 215,
    exitSide: "right",
    exitXPad: 36,
    exitY: 172,
    blockOffsetY: 100,
    openness: 1.9,
    bulgeYF: 0.035,
    planet: 32,
    gas: false,
    duration: 52,
    delay: -14,
    still: 0.45,
    moonBands: [
      { orbitR: 22, dur: 8, moons: [{ size: 3, phase: 0 }, { size: 5, phase: 0.5 }] },
      { orbitR: 32, dur: 10, moons: [{ size: 4, phase: 0.15 }, { size: 2, phase: 0.62 }] },
      { orbitR: 42, dur: 13, moons: [{ size: 6, phase: 0.28 }, { size: 3, phase: 0.75 }, { size: 4, phase: 0.4 }] },
    ],
  },
];

/**
 * Centro del logo en coords Y de la capa orbital (px desde arriba de la capa).
 * @param {HTMLElement} layer
 */
function measureLogoCenterY(layer) {
  const scene = layer.closest(".scene-loader");
  const focal = scene?.querySelector(".loader-focal");
  if (focal) {
    const layerRect = layer.getBoundingClientRect();
    const focalRect = focal.getBoundingClientRect();
    return focalRect.top + focalRect.height / 2 - layerRect.top;
  }
  const sceneHeight = scene?.clientHeight ?? window.innerHeight;
  return sceneHeight * 0.5;
}

/**
 * Arco circular abierto entre dos puntos (entrada izq, salida dcha).
 * @param {number} w
 * @param {number} y1
 * @param {number} y2
 * @param {number} edgePad
 * @param {number} openness
 */
function computeOpenOrbitFromPoints(w, y1, y2, edgePad, openness) {
  const x1 = -edgePad;
  const x2 = w + edgePad;

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const chord = Math.hypot(dx, dy) || 1;
  const radius = chord * openness;
  const distMtoC = Math.sqrt(Math.max(radius * radius - (chord / 2) ** 2, 0));

  const px = -dy / chord;
  const py = dx / chord;

  let cx = mx + px * distMtoC;
  let cy = my + py * distMtoC;
  if (cy >= Math.min(y1, y2)) {
    cx = mx - px * distMtoC;
    cy = my - py * distMtoC;
  }

  const startDeg = (Math.atan2(y1 - cy, x1 - cx) * 180) / Math.PI;
  const endDeg = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;

  return { cx, cy, r: radius, startDeg, endDeg, sweep: 0 };
}

/**
 * @param {number} w
 * @param {number} logoY
 * @param {number} entryAbove
 * @param {number} exitAbove
 * @param {number} edgePad
 * @param {number} openness
 * @param {number} raisePx
 */
function computeLogoAnchoredOrbit(w, logoY, entryAbove, exitAbove, edgePad, openness, raisePx = 0) {
  const y1 = logoY - entryAbove - raisePx;
  const y2 = logoY - exitAbove - raisePx;
  return computeOpenOrbitFromPoints(w, y1, y2, edgePad, openness);
}

/**
 * Punto intermedio sobre un arco circular.
 */
function arcPointAt(cx, cy, r, startDeg, endDeg, sweep, t) {
  const sd = (startDeg * Math.PI) / 180;
  const ed = (endDeg * Math.PI) / 180;
  let delta = ed - sd;
  if (sweep === 1 && delta < 0) delta += Math.PI * 2;
  if (sweep === 0 && delta > 0) delta -= Math.PI * 2;
  const ang = sd + delta * t;
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
}

/**
 * Arco entre dos puntos arbitrarios, curvado hacia un foco (centro de imagen).
 */
function computeCustomArc(x1, y1, x2, y2, openness, bulgeTarget) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const chord = Math.hypot(dx, dy) || 1;
  const radius = chord * openness;
  const distMtoC = Math.sqrt(Math.max(radius * radius - (chord / 2) ** 2, 0));
  const px = -dy / chord;
  const py = dx / chord;

  const centers = [
    { cx: mx + px * distMtoC, cy: my + py * distMtoC },
    { cx: mx - px * distMtoC, cy: my - py * distMtoC },
  ];

  let bestGeom = /** @type {{ cx: number; cy: number; r: number; startDeg: number; endDeg: number; sweep: number } | null} */ (null);
  let bestDist = Infinity;

  for (const { cx, cy } of centers) {
    const startDeg = (Math.atan2(y1 - cy, x1 - cx) * 180) / Math.PI;
    const endDeg = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;
    for (const sweep of [0, 1]) {
      const mid = arcPointAt(cx, cy, radius, startDeg, endDeg, sweep, 0.5);
      const d = Math.hypot(mid.x - bulgeTarget.x, mid.y - bulgeTarget.y);
      if (d < bestDist) {
        bestDist = d;
        bestGeom = { cx, cy, r: radius, startDeg, endDeg, sweep };
      }
    }
  }

  return bestGeom ?? { cx: mx, cy: my, r: radius, startDeg: 0, endDeg: 0, sweep: 0 };
}

/**
 * Resuelve extremos de órbitas custom (izq, dcha, arriba, etc.).
 * @param {typeof ORBIT_SYSTEMS[number]} spec
 * @param {number} w
 */
function resolveCustomEndpoints(spec, w) {
  const pad = spec.exitXPad ?? spec.edgePad ?? 36;
  const x1 = spec.entryXF != null ? w * spec.entryXF : -(spec.entryXPad ?? pad);
  const y1 = spec.entryY;
  const x2 =
    spec.exitSide === "right"
      ? w + pad
      : spec.exitXF != null
        ? w * spec.exitXF
        : w * (spec.exitX ?? 0.5);
  const y2 = spec.exitY;
  return { x1, y1, x2, y2 };
}

/**
 * @param {typeof ORBIT_SYSTEMS[number]} spec
 * @param {number} w
 * @param {number} h
 */
function resolveBulgeTarget(spec, w, h) {
  return {
    x: w * (spec.bulgeXF ?? 0.5),
    y: spec.bulgeY != null ? spec.bulgeY : h * (spec.bulgeYF ?? 0.52),
  };
}

/**
 * @param {typeof ORBIT_SYSTEMS[number]} spec
 * @param {number} w
 * @param {number} h
 * @param {number} logoY
 */
function orbitGeometry(spec, w, h, logoY) {
  if (spec.anchor === "custom") {
    const offsetY = spec.blockOffsetY ?? 0;
    const { x1, y1, x2, y2 } = resolveCustomEndpoints(spec, w);
    const bulge = resolveBulgeTarget(spec, w, h);
    return computeCustomArc(
      x1,
      y1 + offsetY,
      x2,
      y2 + offsetY,
      spec.openness,
      { x: bulge.x, y: bulge.y + offsetY },
    );
  }
  if (spec.anchor === "absolute") {
    return computeOpenOrbitFromPoints(w, spec.entryY, spec.exitY, spec.edgePad, spec.openness);
  }
  return computeLogoAnchoredOrbit(
    w,
    logoY,
    spec.entryAboveLogo,
    spec.exitAboveLogo,
    spec.edgePad,
    spec.openness,
    spec.blockRaisePx ?? 0,
  );
}

/**
 * Capa orbital: arcos izq→dcha y planetas con lunas.
 * @param {HTMLElement} container
 * @param {{ reducedMotion?: boolean }} [options]
 */
export function mountSpaceOrbitLayer(container, { reducedMotion = false } = {}) {
  const layer = document.createElement("div");
  layer.className = "loader-layer loader-layer--space-orbit";
  layer.setAttribute("aria-hidden", "true");

  const cleanups = [];
  const motionHandles = new Map();

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "loader-orbit-paths");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("aria-hidden", "true");
  layer.appendChild(svg);

  /** @type {{ spec: typeof ORBIT_SYSTEMS[number]; path: SVGPathElement; track: ReturnType<typeof createPlanetTrack> }[]} */
  const systems = [];

  for (const spec of ORBIT_SYSTEMS) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("id", `loader-orbit-path-${spec.id}`);
    path.setAttribute("class", `loader-orbit-path loader-orbit-path--${spec.id}`);
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(path);

    const track = createPlanetTrack(layer, spec, path, reducedMotion, motionHandles);
    systems.push({ spec, path, track });
  }

  container.appendChild(layer);

  function layoutOrbit() {
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    if (!w || !h) return;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const logoY = measureLogoCenterY(layer);

    for (const { spec, path } of systems) {
      const g = orbitGeometry(spec, w, h, logoY);
      path.setAttribute(
        "d",
        orbitArc(g.cx, g.cy, g.r, g.startDeg, g.endDeg, g.sweep),
      );
      motionHandles.get(spec.id)?.sync();
    }
  }

  const resizeObserver = new ResizeObserver(() => layoutOrbit());
  resizeObserver.observe(layer);
  const scene = container.closest(".scene-loader") ?? container.parentElement;
  if (scene) resizeObserver.observe(scene);
  cleanups.push(() => resizeObserver.disconnect());

  layoutOrbit();
  for (const { track } of systems) {
    cleanups.push(track.startMotion());
  }

  return {
    destroy() {
      for (const cleanup of cleanups) cleanup();
      layer.remove();
    },
  };
}

/**
 * @param {HTMLElement} layer
 * @param {typeof ORBIT_SYSTEMS[number]} spec
 * @param {SVGPathElement} path
 * @param {boolean} reducedMotion
 * @param {Map<string, { sync: () => void }>} motionHandles
 */
function createPlanetTrack(layer, spec, path, reducedMotion, motionHandles) {
  const track = document.createElement("div");
  track.className = `loader-orbit-track loader-orbit-track--${spec.id}`;
  track.style.setProperty("--planet-size", `${spec.planet}px`);

  const runner = document.createElement("div");
  runner.className = "loader-orbit-runner";
  runner.dataset.planetId = spec.id;
  runner.appendChild(buildPlanetCluster(spec, reducedMotion));
  track.appendChild(runner);
  layer.appendChild(track);

  return {
    startMotion() {
      return attachPathMotion(runner, path, layer, {
        durationMs: spec.duration * 1000,
        delayMs: spec.delay * 1000,
        still: spec.still,
        reducedMotion,
        motionHandles,
        planetId: spec.id,
      });
    },
  };
}

/**
 * @param {typeof ORBIT_SYSTEMS[number]} spec
 * @param {boolean} reducedMotion
 */
function buildPlanetCluster(spec, reducedMotion) {
  const maxR = spec.moonBands.length
    ? Math.max(...spec.moonBands.map((b) => b.orbitR))
    : Math.ceil(spec.planet / 2);
  const cluster = document.createElement("div");
  cluster.className = "loader-orbit-cluster";
  cluster.style.setProperty("--cluster-r", `${maxR}px`);

  for (const band of spec.moonBands) {
    const ring = document.createElement("div");
    ring.className = "loader-moon-orbit-ring";
    ring.style.setProperty("--moon-orbit-r", `${band.orbitR}px`);
    cluster.appendChild(ring);
  }

  const planet = document.createElement("div");
  planet.className = spec.gas ? "loader-planet loader-planet--gas" : "loader-planet";
  cluster.appendChild(planet);

  let moonIndex = 0;
  for (const band of spec.moonBands) {
    for (const moon of band.moons) {
      const moonArm = document.createElement("div");
      moonArm.className = "loader-moon-arm";
      moonArm.style.setProperty("--moon-orbit-r", `${band.orbitR}px`);
      moonArm.style.setProperty("--moon-size", `${moon.size}px`);
      moonArm.style.setProperty("--moon-phase", String(moon.phase));
      moonArm.style.setProperty("--moon-duration", `${band.dur}s`);
      if (!reducedMotion) {
        moonArm.style.animationDelay = `${moonIndex * 0.2}s`;
      } else {
        moonArm.style.animation = "none";
        moonArm.style.transform = `rotate(calc(${moon.phase} * 360deg))`;
      }

      const dot = document.createElement("div");
      dot.className = "loader-moon";
      moonArm.appendChild(dot);
      cluster.appendChild(moonArm);
      moonIndex += 1;
    }
  }

  return cluster;
}

/**
 * @param {HTMLElement} runner
 * @param {SVGPathElement} path
 * @param {HTMLElement} layer
 * @param {{
 *   durationMs: number;
 *   delayMs: number;
 *   still: number;
 *   reducedMotion: boolean;
 *   motionHandles: Map<string, { sync: () => void }>;
 *   planetId: string;
 * }} options
 */
function attachPathMotion(
  runner,
  path,
  layer,
  { durationMs, delayMs, still, reducedMotion, motionHandles, planetId },
) {
  let rafId = 0;
  let startTime = 0;
  let lastProgress = reducedMotion ? still : 0;

  function placeAt(progress) {
    lastProgress = progress;
    const length = path.getTotalLength();
    if (!length) return;
    const point = path.getPointAtLength(length * progress);
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    if (!w || !h) return;

    runner.style.left = `${(point.x / w) * 100}%`;
    runner.style.top = `${(point.y / h) * 100}%`;
  }

  motionHandles.set(planetId, { sync: () => placeAt(lastProgress) });

  function frame(now) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime - delayMs;
    const t = ((elapsed % durationMs) + durationMs) % durationMs / durationMs;
    placeAt(t);
    rafId = requestAnimationFrame(frame);
  }

  if (reducedMotion) {
    placeAt(still);
    return () => {
      motionHandles.delete(planetId);
    };
  }

  rafId = requestAnimationFrame(frame);
  return () => {
    motionHandles.delete(planetId);
    if (rafId) cancelAnimationFrame(rafId);
  };
}
