import { createRng, hashSeed, randPick, randRange } from "./loader-ship-rng.js";

/** @typedef {'fighter' | 'interceptor' | 'gunship' | 'shuttle'} ShipArchetype */

/** @typedef {{ along: number; beam: number }} ABPoint */

/** @typedef {{ x: number; y: number }} Point */

/** @typedef {{ seed: number; archetype: ShipArchetype; lengthScale?: number; widthScale?: number; styleHint?: string }} ShipGenOptions */

/** @typedef {{ viewBox: string; paths: string[]; width: number; height: number; archetype: ShipArchetype; style: string; lengthScale: number; widthScale: number }} GeneratedShip */

const DISPLAY_SCALE = 1.5;

const ARCHETYPES = /** @type {const} */ (["fighter", "interceptor", "gunship", "shuttle"]);

/**
 * Perfil lateral: `along` 0→100 = AFT→FWD; `beam` = perpendicular (±).
 * @param {ABPoint} p
 * @returns {Point}
 */
function toSvg(p) {
  return { x: p.beam + 50, y: 100 - p.along };
}

/**
 * @param {number} along
 * @param {number} beam
 * @param {number} lenAlong
 * @param {number} lenBeam
 * @param {number} [rotDeg]
 * @returns {ABPoint[]}
 */
function rectAB(along, beam, lenAlong, lenBeam, rotDeg = 0) {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ha = lenAlong / 2;
  const hb = lenBeam / 2;
  return [
    { along: -ha, beam: -hb },
    { along: ha, beam: -hb },
    { along: ha, beam: hb },
    { along: -ha, beam: hb },
  ].map(({ along: a, beam: b }) => ({
    along: along + a * cos - b * sin,
    beam: beam + a * sin + b * cos,
  }));
}

/**
 * @param {number} along
 * @param {number} beam
 * @param {number} rx
 * @param {number} ry
 * @param {number} [segments]
 * @returns {ABPoint[]}
 */
function ellipseAB(along, beam, rx, ry, segments = 8) {
  /** @type {ABPoint[]} */
  const pts = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ along: along + rx * Math.cos(a), beam: beam + ry * Math.sin(a) });
  }
  return pts;
}

/**
 * @param {Point[][]} groups
 */
function boundsOfPoints(groups) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pts of groups) {
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * @param {ABPoint[][]} groups
 */
function normalizeGroups(groups) {
  const svgGroups = groups.map((pts) => pts.map(toSvg));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pts of svgGroups) {
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const size = Math.max(w, h);
  const offsetX = (size - w) / 2;
  const offsetY = (size - h) / 2;

  return svgGroups.map((pts) =>
    pts.map((p) => ({
      x: ((p.x - minX + offsetX) / size) * 100,
      y: ((p.y - minY + offsetY) / size) * 100,
    })),
  );
}

/**
 * @param {Point[]} points
 * @param {boolean} [closed]
 */
function pointsToPath(points, closed = true) {
  if (points.length === 0) return "";
  const fmt = (n) => Math.round(n * 10) / 10;
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  if (closed) d += " Z";
  return d;
}

/**
 * @param {ABPoint[][]} layers
 * @param {number} lengthScale
 * @param {number} widthScale
 */
function scaleLayers(layers, lengthScale, widthScale) {
  return layers.map((pts) =>
    pts.map((p) => ({
      along: p.along * lengthScale,
      beam: p.beam * widthScale,
    })),
  );
}

/**
 * @param {() => number} rng
 * @param {{ t: number; w: number }[]} base
 */
function jitterStations(rng, base) {
  /** @type {{ t: number; w: number }[]} */
  const out = base.map(({ t, w }) => ({
    t: Math.max(0, Math.min(1, t + randRange(rng, -0.04, 0.04))),
    w: w * randRange(rng, 0.72, 1.32),
  }));

  if (rng() > 0.55 && out.length > 5) {
    const idx = 1 + Math.floor(rng() * (out.length - 2));
    out.splice(idx, 0, {
      t: randRange(rng, out[idx - 1].t + 0.03, out[idx].t - 0.03),
      w: randRange(rng, 3, 16),
    });
  }

  return out.sort((a, b) => a.t - b.t);
}

/**
 * @param {() => number} rng
 */
function pickProw(rng) {
  return /** @type {const} */ (randPick(rng, ["needle", "fork", "blunt", "hammer"]));
}

/**
 * @param {ABPoint[][]} layers
 * @param {number} along
 * @param {number} beam
 * @param {number} lenAlong
 * @param {number} lenBeam
 * @param {number} [rot]
 */
function addRect(layers, along, beam, lenAlong, lenBeam, rot = 0) {
  layers.push(rectAB(along, beam, lenAlong, lenBeam, rot));
}

/**
 * @param {ABPoint[][]} layers
 * @param {number} along
 * @param {number} beam
 * @param {number} rx
 * @param {number} ry
 */
function addPod(layers, along, beam, rx, ry) {
  layers.push(ellipseAB(along, beam, rx, ry, 8));
}

/**
 * Truss fino entre dos puntos.
 * @param {ABPoint[][]} layers
 * @param {number} a0
 * @param {number} b0
 * @param {number} a1
 * @param {number} b1
 * @param {number} [thick]
 */
function addTruss(layers, a0, b0, a1, b1, thick = 0.9) {
  const dx = a1 - a0;
  const db = b1 - b0;
  const len = Math.hypot(dx, db) || 1;
  const px = (-db / len) * thick;
  const pb = (dx / len) * thick;
  layers.push([
    { along: a0 + px, beam: b0 + pb },
    { along: a1 + px, beam: b1 + pb },
    { along: a1 - px, beam: b1 - pb },
    { along: a0 - px, beam: b0 - pb },
  ]);
}

/**
 * Casco simétrico escalonado (capital-ship + industrial sketch).
 * Estaciones de ancho medio a lo largo del eje AFT→FWD.
 * @param {() => number} rng
 * @param {{ t: number; w: number }[]} stations t∈[0,1], w=semi-ancho
 * @returns {ABPoint[]}
 */
function buildSteppedHull(rng, stations) {
  /** @type {{ along: number; w: number }[]} */
  const sorted = stations
    .map(({ t, w }) => ({
      along: t * 100,
      w: w * randRange(rng, 0.92, 1.06),
    }))
    .sort((a, b) => a.along - b.along);

  /** @type {ABPoint[]} */
  const upper = [];
  /** @type {ABPoint[]} */
  const lower = [];

  for (const { along, w } of sorted) {
    const jag = randRange(rng, -0.6, 0.6);
    upper.push({ along, beam: w + jag });
    lower.push({ along, beam: -(w + jag) });
  }

  return [...upper, ...lower.reverse()];
}

/**
 * @param {{ t: number; w: number }[]} stations
 * @param {number} t
 */
function hullHalfWidthAt(stations, t) {
  if (stations.length === 0) return 6;
  if (t <= stations[0].t) return stations[0].w;
  if (t >= stations[stations.length - 1].t) return stations[stations.length - 1].w;
  for (let i = 0; i < stations.length - 1; i += 1) {
    const a = stations[i];
    const b = stations[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      return a.w + (b.w - a.w) * f;
    }
  }
  return stations[0].w;
}

/**
 * Ala / aleta lateral pegada al borde del casco.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} along
 * @param {number} hullW
 * @param {number} side
 * @param {number} span
 */
function attachWing(layers, rng, along, hullW, side, span) {
  const root = side * hullW;
  const tip = side * (hullW + span);
  layers.push([
    { along: along - 3, beam: root },
    { along: along + 4, beam: root },
    { along: along + 2, beam: tip },
    { along: along - 5, beam: tip * 0.82 },
  ]);
  addRect(layers, along, (root + tip) / 2, randRange(rng, 3, 5), Math.abs(tip - root) * 0.85, side * randRange(rng, -10, 10));
}

/**
 * Pod cápsula acoplado al casco (referencia modular color).
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} along
 * @param {number} hullW
 * @param {number} side
 */
function attachCapsulePod(layers, rng, along, hullW, side) {
  const reach = randRange(rng, 4, 7);
  const bx = side * (hullW + reach * 0.55);
  addTruss(layers, along, side * hullW * 0.85, along, bx, 1.1);
  addPod(layers, along, bx, randRange(rng, 2.5, 3.8), randRange(rng, 4, 6));
}

/**
 * Bloque de motores AFT integrado (múltiples toberas).
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} [scale]
 */
function addEngineBlock(layers, rng, scale = 1) {
  const s = scale;
  addRect(layers, 7 * s, 0, 12 * s, randRange(rng, 10, 14) * s);
  for (const side of [-1, 1]) {
    addPod(layers, 4 * s, side * randRange(rng, 4, 6) * s, 2.5 * s, 2.2 * s);
    addRect(layers, 2 * s, side * randRange(rng, 5, 8) * s, 3 * s, 4 * s);
  }
  addPod(layers, 10 * s, 0, 2 * s, 2 * s);
}

/**
 * Proa: needle, fork, blunt o hammerhead.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {'needle' | 'fork' | 'blunt' | 'hammer'} style
 * @param {number} fwdAlong
 */
function addProw(layers, rng, style, fwdAlong = 98) {
  if (style === "needle") {
    layers.push([
      { along: fwdAlong, beam: 0 },
      { along: fwdAlong - 8, beam: 2.5 },
      { along: fwdAlong - 8, beam: -2.5 },
    ]);
    addRect(layers, fwdAlong - 4, 0, 5, 1.4);
  } else if (style === "fork") {
    const spread = randRange(rng, 3.5, 5.5);
    for (const side of [-1, 1]) {
      layers.push([
        { along: fwdAlong, beam: side * 1.2 },
        { along: fwdAlong - 7, beam: side * spread },
        { along: fwdAlong - 3, beam: side * 1.8 },
      ]);
    }
  } else if (style === "hammer") {
    addRect(layers, fwdAlong - 5, 0, 10, randRange(rng, 14, 18));
    addRect(layers, fwdAlong - 2, randRange(rng, 8, 10), 4, 6);
    addRect(layers, fwdAlong - 2, randRange(rng, -10, -8), 4, 6);
  } else {
    addPod(layers, fwdAlong - 3, 0, 4, 5);
    addRect(layers, fwdAlong - 7, 0, 6, 8);
  }
}

/**
 * Espina segmentada visible sobre el casco (GAIA).
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} a0
 * @param {number} a1
 * @param {number} segments
 */
function addSpineDetail(layers, rng, a0, a1, segments) {
  const span = (a1 - a0) / segments;
  for (let i = 0; i < segments; i += 1) {
    const start = a0 + span * i + span * 0.1;
    const len = span * randRange(rng, 0.55, 0.75);
    addRect(layers, start + len / 2, 0, len, randRange(rng, 0.9, 1.3));
  }
}

/**
 * Greebles de borde pegados al casco.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {{ t: number; w: number }[]} stations
 * @param {number} count
 */
function addHullGreebles(layers, rng, stations, count) {
  for (let i = 0; i < count; i += 1) {
    const t = randRange(rng, 0.08, 0.92);
    const hw = hullHalfWidthAt(stations, t);
    const along = t * 100;
    const side = rng() > 0.5 ? 1 : -1;
    const beam = side * randRange(rng, hw * 0.75, hw * 1.05);
    if (rng() > 0.4) {
      addRect(layers, along, beam, randRange(rng, 0.8, 2), randRange(rng, 0.6, 1.6), randRange(rng, -25, 25));
    } else {
      const ang = side * Math.PI / 2 + randRange(rng, -0.35, 0.35);
      const len = randRange(rng, 2, 5);
      addTruss(layers, along, beam, along + Math.cos(ang) * len * 0.15, beam + Math.sin(ang) * len, 0.4);
    }
  }
}

/**
 * Canard / alerón delantero pequeño.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} along
 * @param {number} side
 * @param {number} hullW
 */
function addCanard(layers, rng, along, side, hullW) {
  const root = side * hullW * 0.88;
  const tip = side * (hullW + randRange(rng, 4, 8));
  layers.push([
    { along, beam: root },
    { along: along + randRange(rng, 5, 9), beam: tip },
    { along: along + 2.5, beam: root * 0.82 },
  ]);
}

/**
 * Alerón estabilizador AFT.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} along
 * @param {number} side
 * @param {number} [hullW]
 */
function addStabilizerFin(layers, rng, along, side, hullW = 6) {
  const reach = randRange(rng, 5, 9);
  const tip = side * (hullW + reach);
  attachWing(layers, rng, along, hullW, side, reach);
  addRect(layers, along - 1, tip * 0.92, randRange(rng, 3, 5), randRange(rng, 2.5, 4), side * randRange(rng, -18, -8));
}

/**
 * Mástil de antenas agrupadas.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} along
 * @param {number} beam
 * @param {number} count
 */
function addAntennaMast(layers, rng, along, beam, count) {
  addRect(layers, along, beam, 1.6, randRange(rng, 2, 4));
  for (let i = 0; i < count; i += 1) {
    const ang = randRange(rng, -Math.PI * 0.95, Math.PI * 0.95);
    const len = randRange(rng, 4, 11);
    addTruss(
      layers,
      along,
      beam,
      along + Math.cos(ang) * len * 0.12,
      beam + Math.sin(ang) * len,
      0.38,
    );
  }
}

/**
 * Ala en par simétrico.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} along
 * @param {number} hullW
 * @param {number} span
 */
function attachWingPair(layers, rng, along, hullW, span) {
  attachWing(layers, rng, along, hullW, -1, span * randRange(rng, 0.85, 1.1));
  attachWing(layers, rng, along, hullW, 1, span * randRange(rng, 0.85, 1.1));
}

/**
 * Paquete extra de accesorios: alas, alerones, antenas.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {{ t: number; w: number }[]} stations
 * @param {'light' | 'medium' | 'heavy'} [level]
 */
function sprinkleAccessories(layers, rng, stations, level = "medium") {
  /** @type {Record<string, { wings: number; canards: number; fins: number; masts: number; greebles: number }>} */
  const cfgByLevel = {
    light: { wings: 2, canards: 2, fins: 2, masts: 3, greebles: 6 },
    medium: { wings: 3, canards: 2, fins: 3, masts: 4, greebles: 10 },
    heavy: { wings: 4, canards: 3, fins: 4, masts: 5, greebles: 12 },
  };
  const cfg = cfgByLevel[level] ?? cfgByLevel.medium;

  for (let i = 0; i < cfg.wings; i += 1) {
    const t = randRange(rng, 0.16, 0.84);
    const hw = hullHalfWidthAt(stations, t);
    if (rng() > 0.35) {
      attachWingPair(layers, rng, t * 100, hw, randRange(rng, 5, 11));
    } else {
      const side = rng() > 0.5 ? 1 : -1;
      attachWing(layers, rng, t * 100, hw, side, randRange(rng, 6, 12));
    }
  }

  for (let i = 0; i < cfg.canards; i += 1) {
    const t = randRange(rng, 0.58, 0.92);
    const side = i % 2 === 0 ? -1 : 1;
    addCanard(layers, rng, t * 100, side, hullHalfWidthAt(stations, t));
  }

  for (let i = 0; i < cfg.fins; i += 1) {
    const side = rng() > 0.5 ? 1 : -1;
    addStabilizerFin(layers, rng, randRange(rng, 4, 20), side, randRange(rng, 5, 10));
  }

  const mastAlong = [
    randRange(rng, 8, 16),
    randRange(rng, 35, 52),
    randRange(rng, 62, 78),
    randRange(rng, 84, 94),
  ];
  for (let i = 0; i < cfg.masts; i += 1) {
    const along = mastAlong[i % mastAlong.length];
    const side = rng() > 0.5 ? 1 : -1;
    const hw = hullHalfWidthAt(stations, along / 100);
    addAntennaMast(layers, rng, along, side * hw * randRange(rng, 0.5, 0.95), Math.round(randRange(rng, 3, 6)));
  }

  addAntennas(layers, rng, randRange(rng, 86, 96), Math.round(randRange(rng, 4, 7)));
  addAntennas(layers, rng, randRange(rng, 10, 22), Math.round(randRange(rng, 3, 5)));
  addHullGreebles(layers, rng, stations, cfg.greebles);
}

/**
 * Antenas cortas desde proa o superestructura.
 * @param {ABPoint[][]} layers
 * @param {() => number} rng
 * @param {number} along
 * @param {number} count
 */
function addAntennas(layers, rng, along, count) {
  for (let i = 0; i < count; i += 1) {
    const ang = randRange(rng, -Math.PI * 0.9, Math.PI * 0.9);
    const len = randRange(rng, 4, 11);
    addTruss(layers, along, randRange(rng, -2.5, 2.5), along + Math.cos(ang) * len * 0.1, Math.sin(ang) * len, 0.42);
  }
}

/**
 * @param {() => number} rng
 * @param {{ t: number; w: number }[]} stations
 * @param {'needle' | 'fork' | 'blunt' | 'hammer'} prow
 */
function buildFromProfile(rng, stations, prow) {
  /** @type {ABPoint[][]} */
  const layers = [];

  layers.push(buildSteppedHull(rng, stations));
  addEngineBlock(layers, rng, randRange(rng, 0.85, 1.1));
  addProw(layers, rng, prow);

  return layers;
}

/**
 * Caza ligero — perfil fino, alas en X (capital grid + industrial).
 * @param {() => number} rng
 */
function buildLightCraft(rng) {
  const stations = jitterStations(rng, [
    { t: 0, w: 5.5 },
    { t: 0.1, w: 7 },
    { t: 0.35, w: 5 },
    { t: 0.55, w: 4 },
    { t: 0.78, w: 3 },
    { t: 0.92, w: 1.2 },
    { t: 1, w: 0.3 },
  ]);
  const layers = buildFromProfile(rng, stations, pickProw(rng));

  attachWing(layers, rng, 38, hullHalfWidthAt(stations, 0.38), -1, randRange(rng, 5, 8));
  attachWing(layers, rng, 38, hullHalfWidthAt(stations, 0.38), 1, randRange(rng, 5, 8));
  attachWing(layers, rng, 52, hullHalfWidthAt(stations, 0.52), -1, randRange(rng, 3, 5));
  attachWing(layers, rng, 52, hullHalfWidthAt(stations, 0.52), 1, randRange(rng, 3, 5));

  addSpineDetail(layers, rng, 14, 82, 6);
  sprinkleAccessories(layers, rng, stations, "medium");
  return layers;
}

/**
 * Interceptor — escalones marcados, aletas alternas, espina GAIA.
 * @param {() => number} rng
 */
function buildPatrolFrigate(rng) {
  const stations = jitterStations(rng, [
    { t: 0, w: 8 },
    { t: 0.12, w: 10 },
    { t: 0.28, w: 11 },
    { t: 0.42, w: 7 },
    { t: 0.58, w: 9 },
    { t: 0.72, w: 6 },
    { t: 0.88, w: 3.5 },
    { t: 1, w: 0.5 },
  ]);
  const layers = buildFromProfile(rng, stations, pickProw(rng));

  const finCount = Math.round(randRange(rng, 3, 5));
  for (let i = 0; i < finCount; i += 1) {
    const t = 0.22 + i * randRange(rng, 0.12, 0.16);
    const side = i % 2 === 0 ? -1 : 1;
    attachWing(layers, rng, t * 100, hullHalfWidthAt(stations, t), side, randRange(rng, 5, 9));
  }

  addRect(layers, 68, 0, randRange(rng, 8, 11), randRange(rng, 6, 9));
  addSpineDetail(layers, rng, 16, 88, 8);
  sprinkleAccessories(layers, rng, stations, "heavy");
  return layers;
}

/**
 * Crucero — cuerpo ancho tipo hammerhead / capital (referencia grid).
 * @param {() => number} rng
 */
function buildHeavyCruiser(rng) {
  const hammer = rng() > 0.45;
  const stations = jitterStations(
    rng,
    hammer
      ? [
          { t: 0, w: 10 },
          { t: 0.1, w: 12 },
          { t: 0.25, w: 11 },
          { t: 0.45, w: 13 },
          { t: 0.62, w: 14 },
          { t: 0.78, w: 10 },
          { t: 0.9, w: 6 },
          { t: 1, w: 1 },
        ]
      : [
          { t: 0, w: 11 },
          { t: 0.15, w: 13 },
          { t: 0.4, w: 14 },
          { t: 0.65, w: 12 },
          { t: 0.85, w: 7 },
          { t: 1, w: 0.8 },
        ],
  );

  const prow = hammer ? "hammer" : pickProw(rng);
  const layers = buildFromProfile(rng, stations, prow);

  const finSide = rng() > 0.5 ? 1 : -1;
  attachWing(layers, rng, 48, hullHalfWidthAt(stations, 0.48), finSide, randRange(rng, 8, 12));

  for (let i = 0; i < 4; i += 1) {
    addPod(layers, randRange(rng, 25, 55), randRange(rng, -8, 8), 2.2, 2);
  }

  addRect(layers, 55, 0, randRange(rng, 14, 18), randRange(rng, 8, 11));
  sprinkleAccessories(layers, rng, stations, "heavy");
  return layers;
}

/**
 * Transporte — cápsulas apiladas + losa ancha (referencia modular).
 * @param {() => number} rng
 */
function buildFreighter(rng) {
  const stations = jitterStations(rng, [
    { t: 0, w: 9 },
    { t: 0.14, w: 10 },
    { t: 0.35, w: 8 },
    { t: 0.55, w: 9 },
    { t: 0.75, w: 7 },
    { t: 0.9, w: 4 },
    { t: 1, w: 0.6 },
  ]);
  const layers = buildFromProfile(rng, stations, pickProw(rng));

  const pods = Math.round(randRange(rng, 4, 6));
  for (let i = 0; i < pods; i += 1) {
    const t = 0.2 + i * randRange(rng, 0.1, 0.13);
    const side = i % 2 === 0 ? -1 : 1;
    attachCapsulePod(layers, rng, t * 100, hullHalfWidthAt(stations, t), side);
  }

  if (rng() > 0.35) {
    addRect(layers, 58, randRange(rng, 10, 13), randRange(rng, 5, 7), randRange(rng, 10, 14), 90);
  }

  addSpineDetail(layers, rng, 18, 78, 5);
  sprinkleAccessories(layers, rng, stations, "medium");
  return layers;
}

/**
 * Explorador aguja — muy largo y estrecho.
 * @param {() => number} rng
 */
function buildNeedleScout(rng) {
  const stations = jitterStations(rng, [
    { t: 0, w: 4 },
    { t: 0.08, w: 4.5 },
    { t: 0.25, w: 3.2 },
    { t: 0.5, w: 2.8 },
    { t: 0.72, w: 2.2 },
    { t: 0.88, w: 1.2 },
    { t: 0.96, w: 0.5 },
    { t: 1, w: 0.15 },
  ]);
  const layers = buildFromProfile(rng, stations, "needle");
  addSpineDetail(layers, rng, 12, 92, Math.round(randRange(rng, 8, 12)));
  sprinkleAccessories(layers, rng, stations, "light");
  return layers;
}

/**
 * Corredor compacto — corto y ancho.
 * @param {() => number} rng
 */
function buildStubRunner(rng) {
  const stations = jitterStations(rng, [
    { t: 0, w: 11 },
    { t: 0.22, w: 14 },
    { t: 0.48, w: 15 },
    { t: 0.72, w: 12 },
    { t: 0.9, w: 8 },
    { t: 1, w: 2.5 },
  ]);
  const layers = buildFromProfile(rng, stations, rng() > 0.5 ? "blunt" : "hammer");
  attachWing(layers, rng, 42, hullHalfWidthAt(stations, 0.42), -1, randRange(rng, 6, 10));
  attachWing(layers, rng, 42, hullHalfWidthAt(stations, 0.42), 1, randRange(rng, 6, 10));
  sprinkleAccessories(layers, rng, stations, "heavy");
  return layers;
}

/**
 * Plataforma asimétrica — superestructura lateral marcada.
 * @param {() => number} rng
 */
function buildAsymmetricRig(rng) {
  const stations = jitterStations(rng, [
    { t: 0, w: 8 },
    { t: 0.2, w: 9 },
    { t: 0.45, w: 7 },
    { t: 0.68, w: 8.5 },
    { t: 0.88, w: 5 },
    { t: 1, w: 0.8 },
  ]);
  const layers = buildFromProfile(rng, stations, pickProw(rng));
  const heavySide = rng() > 0.5 ? 1 : -1;
  for (let i = 0; i < 3; i += 1) {
    attachCapsulePod(layers, rng, 28 + i * randRange(rng, 14, 18), hullHalfWidthAt(stations, 0.35 + i * 0.15), heavySide);
  }
  attachWing(layers, rng, 55, hullHalfWidthAt(stations, 0.55), -heavySide, randRange(rng, 4, 7));
  addRect(layers, 62, heavySide * randRange(rng, 10, 14), randRange(rng, 12, 16), randRange(rng, 6, 9));
  addSpineDetail(layers, rng, 14, 80, 5);
  sprinkleAccessories(layers, rng, stations, "medium");
  return layers;
}

/** @type {const} */
const SHIP_STYLES = [
  "lightCraft",
  "patrolFrigate",
  "heavyCruiser",
  "freighter",
  "needleScout",
  "stubRunner",
  "asymmetricRig",
];

/** @type {Record<string, (rng: () => number) => ABPoint[][]>} */
const STYLE_BUILDERS = {
  lightCraft: buildLightCraft,
  patrolFrigate: buildPatrolFrigate,
  heavyCruiser: buildHeavyCruiser,
  freighter: buildFreighter,
  needleScout: buildNeedleScout,
  stubRunner: buildStubRunner,
  asymmetricRig: buildAsymmetricRig,
};

/** @type {Record<ShipArchetype, readonly string[]>} */
const ARCHETYPE_STYLE_BIAS = {
  fighter: ["needleScout", "lightCraft", "patrolFrigate"],
  interceptor: ["patrolFrigate", "lightCraft", "needleScout", "asymmetricRig"],
  gunship: ["heavyCruiser", "stubRunner", "freighter"],
  shuttle: ["freighter", "asymmetricRig", "heavyCruiser", "stubRunner"],
};

/**
 * @param {() => number} rng
 * @param {ShipArchetype} archetype
 */
function pickStyle(rng, archetype) {
  if (rng() < 0.35) {
    return randPick(rng, SHIP_STYLES);
  }
  return randPick(rng, ARCHETYPE_STYLE_BIAS[archetype] ?? SHIP_STYLES);
}

/**
 * @param {ShipArchetype} archetype
 * @param {() => number} rng
 * @param {string} [styleHint]
 */
function buildShipLayers(archetype, rng, styleHint) {
  const style = styleHint ?? pickStyle(rng, archetype);
  const builder = STYLE_BUILDERS[style] ?? buildPatrolFrigate;
  return { layers: builder(rng), style };
}

/**
 * Siluetas blancas híbridas: casco simétrico + modular GAIA/industrial.
 * @param {ShipGenOptions} options
 * @returns {GeneratedShip}
 */
export function generateShip({ seed, archetype, lengthScale = 1, widthScale = 1, styleHint }) {
  const rng = createRng(seed);
  const { layers: raw, style } = buildShipLayers(archetype, rng, styleHint);
  const scaled = scaleLayers(raw, lengthScale, widthScale);
  const layers = scaled.filter((pts) => pts.length >= 3);
  const normalized = normalizeGroups(layers);
  const paths = normalized.map((pts) => pointsToPath(pts)).filter(Boolean);
  const { minX, minY, maxX, maxY } = boundsOfPoints(normalized);

  return {
    viewBox: "0 0 100 100",
    paths,
    width: maxX - minX,
    height: maxY - minY,
    archetype,
    style,
    lengthScale,
    widthScale,
  };
}

/**
 * @param {string} id
 * @param {number} rollSeed Semilla de sesión — distinta en cada recarga.
 * @param {{ hintArchetype?: ShipArchetype; baseSize?: number }} [options]
 */
export function generateShipForSlot(id, rollSeed, options = {}) {
  const slotRng = createRng(hashSeed(`${id}:${rollSeed}`));
  const archetype =
    options.hintArchetype && slotRng() > 0.82
      ? options.hintArchetype
      : randPick(slotRng, ARCHETYPES);
  const lengthScale = randRange(slotRng, 0.68, 1.42);
  const widthScale = randRange(slotRng, 0.62, 1.38);
  const style = pickStyle(slotRng, archetype);
  const seed = hashSeed(`${id}:${archetype}:${style}:${rollSeed}:${lengthScale}:${widthScale}`);

  const ship = generateShip({ seed, archetype, lengthScale, widthScale, styleHint: style });
  const display = computeDisplaySize(ship, slotRng, options.baseSize);

  return { ...ship, display };
}

/**
 * Tamaño en pantalla según silueta y variación aleatoria.
 * @param {Pick<GeneratedShip, 'width' | 'height' | 'lengthScale' | 'widthScale'>} ship
 * @param {() => number} rng
 * @param {number} [baseHint]
 */
export function computeDisplaySize(ship, rng, baseHint) {
  const along = Math.max(ship.width, ship.height);
  const cross = Math.max(1, Math.min(ship.width, ship.height));
  const aspect = along / cross;
  const base = (baseHint ?? randRange(rng, 42, 72)) * 1.14;
  const sizeJitter = randRange(rng, 0.92, 1.28);
  const alongPx = Math.round(
    base * sizeJitter * randRange(rng, 0.95, 1.2) * (0.88 + ship.lengthScale * 0.15) * DISPLAY_SCALE,
  );
  const crossPx = Math.round(
    (alongPx / aspect) * randRange(rng, 0.9, 1.14) * (0.88 + ship.widthScale * 0.15),
  );
  const tall = ship.height >= ship.width;
  const minPx = Math.round(28 * DISPLAY_SCALE);

  return {
    w: Math.max(minPx, Math.round(tall ? crossPx : alongPx)),
    h: Math.max(minPx, Math.round(tall ? alongPx : crossPx)),
  };
}

/** Semilla aleatoria por montaje / recarga. */
export function randomRollSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return (buf[0] ^ buf[1]) >>> 0;
  }
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

export { ARCHETYPES };

/**
 * @param {GeneratedShip} ship
 */
export function isValidGeneratedShip(ship) {
  if (!ship.paths.length) return false;
  if (!Number.isFinite(ship.width) || !Number.isFinite(ship.height)) return false;
  if (ship.width <= 0 || ship.height <= 0) return false;
  return ship.paths.every((d) => /^M[\d\s.L\-]+Z?$/.test(d));
}

/**
 * @param {ShipArchetype} a
 * @param {ShipArchetype} b
 * @param {number} seed
 */
export function compareArchetypeWidth(a, b, seed) {
  const sa = generateShip({ seed, archetype: a });
  const sb = generateShip({ seed, archetype: b });
  return sa.width - sb.width;
}
