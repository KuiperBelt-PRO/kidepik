/**
 * Catálogo de módulos arquitectónicos para composición por grafo.
 *
 * Cada módulo es una pieza suelta (plataforma, fuste, aguja, arcada, arbotante…)
 * que se instancia en coordenadas locales y emite partes al ensamblador.
 *
 * @module loader-fantasy-modules
 */

import { registerModule } from "./loader-fantasy-compose.js";
import {
  aperture,
  arch,
  chamferRect,
  crossingArches,
  elfArcadeCluster,
  elfBridgeArcade,
  elfFlyingButtress,
  elfFlankRoofOutlines,
  elfPodium,
  elfRibCrown,
  elfRoofTowerOutlines,
  elfSpireCluster,
  finial,
  gableRoof,
  gothicArchCap,
  gothicArchOutline,
  gothicFlankInterlaceOutlines,
  hollowRect,
  jitterRing,
  rect,
  spikeRow,
} from "./loader-fantasy-geom.js";
import { randRange } from "./loader-ship-rng.js";

const SEAM = 1.4;

/**
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {import('./loader-fantasy-castle-factions.js').FactionProfile} profile
 */
function bodyShell(cx, baseY, w, h, profile) {
  if (profile.bodyShape === "chamfer") {
    return chamferRect(cx, baseY, w, h, profile.chamfer);
  }
  return rect(cx, baseY, w, h);
}

/**
 * Flecha invertida sólida (relleno dentro de un vano).
 * @param {number} cx
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 */
function elfArrowInlay(cx, baseY, w, h) {
  const hw = w / 2;
  return [
    { x: cx - hw, y: baseY },
    { x: cx, y: baseY + h },
    { x: cx + hw, y: baseY },
  ];
}

/**
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleCorePlinth(ctx, node) {
  const { w, h } = /** @type {{ w: number; h: number }} */ (node.params);
  let outer = rect(node.cx, node.baseY, w, h);
  outer = jitterRing(outer, ctx.rng, ctx.jitterAmt * 0.15, {
    lockY: [node.baseY],
    freezeSeams: true,
  });
  ctx.asm.addPart("plinth", outer);
}

/**
 * Puerta élfica: arco gótico central en trazo (sin relleno).
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfDoorOutline(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const { cx, baseY } = node;
  const outline = gothicArchOutline(cx, baseY, w, h, 8);
  ctx.asm.addPart("decoration", outline, [], { stroke: true, strokeWidth: 2.2, buildSequence: 1 });
  ctx.arches.gothic += 1;
  ctx.counters.doorCount += 1;
}

/**
 * Arcadas laterales élficas: 5 arcos góticos en trazo por flanco, entrecruzados,
 * desde el borde del arco central hasta el extremo del zócalo.
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfFlankArcades(ctx, node) {
  const doorW = /** @type {number} */ (node.params.doorW);
  const archH = /** @type {number} */ (node.params.archH);
  const envLeft = /** @type {number} */ (node.params.envLeft);
  const envRight = /** @type {number} */ (node.params.envRight);
  const archCount = /** @type {number} */ (node.params.archCount ?? 5);
  const { cx, baseY } = node;

  const outlines = gothicFlankInterlaceOutlines(
    cx, baseY, doorW, archH, envLeft, envRight, archCount,
  );
  for (const outline of outlines) {
    ctx.asm.addPart("decoration", outline, [], { stroke: true, strokeWidth: 2.2, buildSequence: 1 });
    ctx.arches.gothic += 1;
  }
  ctx.counters.windowCount += outlines.length;
}

/**
 * Tejados trapezoidales en trazo sobre las arcadas laterales, con tejas en escama de pez.
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfFlankRoofs(ctx, node) {
  const doorW = /** @type {number} */ (node.params.doorW);
  const archH = /** @type {number} */ (node.params.archH);
  const envLeft = /** @type {number} */ (node.params.envLeft);
  const envRight = /** @type {number} */ (node.params.envRight);
  const hInnerRatio = /** @type {number} */ (node.params.roofHRatio ?? 0.5);
  const topInsetRatio = /** @type {number} */ (node.params.topInsetRatio ?? 0.12);
  const rows = /** @type {number} */ (node.params.rows ?? 3);
  const { cx, baseY } = node;

  const outlines = elfFlankRoofOutlines(
    cx, baseY, doorW, archH, envLeft, envRight,
    { roofHRatio: hInnerRatio, topInsetRatio, rows },
  );
  for (const outline of outlines) {
    ctx.asm.addPart("decoration", outline, [], { stroke: true, strokeWidth: 2, buildSequence: 2 });
  }
}

/**
 * Torres sobre los tejados laterales: rectángulo en trazo, arcos góticos cruzados y arcada de 3 arcos.
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfRoofTowers(ctx, node) {
  const towers = /** @type {{ cx: number; baseY: number; w: number; h: number }[]} */ (
    node.params.towers ?? []
  );
  const crownArchCount = /** @type {number} */ (node.params.crownArchCount ?? 3);

  for (const tower of towers) {
    const outlines = elfRoofTowerOutlines(
      tower.cx, tower.baseY, tower.w, tower.h, ctx.rng, crownArchCount,
    );
    for (const outline of outlines) {
      ctx.asm.addPart("decoration", outline, [], { stroke: true, strokeWidth: 2, buildSequence: 3 });
      if (outline.length > 6) {
        ctx.arches.gothic += 1;
        ctx.counters.windowCount += 1;
      }
    }
  }
}

/**
 * Plataforma baja: columnata abierta con arcadas (no bloque macizo).
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfDeck(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const { cx, baseY } = node;

  const pierW = w * randRange(ctx.rng, 0.05, 0.065);
  const pierH = h * randRange(ctx.rng, 0.92, 1.02);
  const leftPier = rect(cx - w / 2 + pierW / 2, baseY, pierW, pierH);
  const rightPier = rect(cx + w / 2 - pierW / 2, baseY, pierW, pierH);
  ctx.asm.addPart(
    "block",
    jitterRing(leftPier, ctx.rng, ctx.jitterAmt * 0.2, { lockY: [baseY, baseY + pierH], freezeSeams: true }),
  );
  ctx.asm.addPart(
    "block",
    jitterRing(rightPier, ctx.rng, ctx.jitterAmt * 0.2, { lockY: [baseY, baseY + pierH], freezeSeams: true }),
  );

  const lintelH = h * randRange(ctx.rng, 0.1, 0.14);
  const lintelY = baseY + h - lintelH * 0.35;
  let lintel = rect(cx, lintelY, w * 0.96, lintelH);
  lintel = jitterRing(lintel, ctx.rng, ctx.jitterAmt * 0.18, {
    lockY: [baseY + h - lintelH, baseY + h],
    freezeSeams: true,
  });

  /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
  const lintelHoles = [];
  const cols = 4 + Math.floor(ctx.rng() * 2);
  const step = w / cols;
  for (let i = 0; i < cols; i++) {
    const ax = cx - w / 2 + step / 2 + i * step;
    const aw = step * randRange(ctx.rng, 0.68, 0.78);
    const ah = h * randRange(ctx.rng, 0.82, 0.96);
    lintelHoles.push(arch(ax, baseY, aw, ah, "gothic", 7));
    ctx.arches.gothic += 1;
    if (i === Math.floor(cols / 2)) ctx.counters.doorCount += 1;
    else ctx.counters.windowCount += 1;
  }
  ctx.asm.addPart("base", lintel, lintelHoles);
}

/**
 * Podio elevado con arcadas de sustentación y terraza (base visible sobre el suelo).
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfPodium(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const stiltH = /** @type {number} */ (node.params.stiltH);
  const slabH = /** @type {number} */ (node.params.slabH);
  const archCount = /** @type {number} */ (node.params.archCount ?? 4);
  const { cx, baseY } = node;

  const parts = elfPodium(cx, baseY, w, stiltH, slabH, archCount);
  for (const pier of parts.piers) {
    ctx.asm.addPart(
      "block",
      jitterRing(pier, ctx.rng, ctx.jitterAmt * 0.15, {
        lockY: [baseY, baseY + stiltH + slabH],
        freezeSeams: true,
      }),
    );
  }
  for (const a of parts.arches) {
    ctx.asm.addPart("decoration", a);
    ctx.arches.gothic += 1;
  }
  ctx.asm.addPart(
    "base",
    jitterRing(parts.slab, ctx.rng, ctx.jitterAmt * 0.12, {
      lockY: [baseY + stiltH, baseY + stiltH + slabH],
      freezeSeams: true,
    }),
  );
  ctx.counters.doorCount += 1;
}

/**
 * Torre central: fuste esbelto y cúpula de costillas dominante.
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfTowerCentral(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const { cx, baseY } = node;
  const tilt = (ctx.rng() - 0.5) * 0.6 * ctx.imperfection * ctx.profile.tiltScale;

  const shell = hollowRect(cx, baseY, w, h, w * 0.2);
  const lancetH = h * randRange(ctx.rng, 0.38, 0.48);
  const lancetY = baseY + h * randRange(ctx.rng, 0.34, 0.4);
  shell.holes.push(arch(cx, lancetY, w * 0.72, lancetH, "gothic", 9));
  ctx.arches.gothic += 1;
  ctx.asm.addPart("tower", jitterRing(shell.outer, ctx.rng, ctx.jitterAmt * 0.08, {
    lockY: [baseY, baseY + h],
    freezeSeams: true,
  }), shell.holes, { tiltDeg: tilt });

  const crownBase = baseY + h - SEAM;
  const crownW = w * randRange(ctx.rng, 2.6, 3.2);
  const crownH = h * randRange(ctx.rng, 0.26, 0.34);
  for (const ring of elfRibCrown(cx, crownBase, crownW, crownH)) {
    ctx.asm.addPart("decoration", jitterRing(ring, ctx.rng, ctx.jitterAmt * 0.08), [], { tiltDeg: tilt });
  }
  for (const ring of finial(cx, crownBase + crownH * 0.82, crownH * 0.95, "needle")) {
    ctx.asm.addPart("decoration", ring, [], { tiltDeg: tilt });
  }
  ctx.counters.windowCount += 1;
}

/**
 * Torre lateral: aguja única sobre fuste hueco (sin bosque de pinchos).
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfTowerFlank(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const { cx, baseY } = node;
  const tilt = (ctx.rng() - 0.5) * 0.8 * ctx.imperfection * ctx.profile.tiltScale;

  const shell = hollowRect(cx, baseY, w, h, w * 0.22);
  const lancetH = h * randRange(ctx.rng, 0.36, 0.46);
  const lancetY = baseY + h * randRange(ctx.rng, 0.32, 0.38);
  shell.holes.push(arch(cx, lancetY, w * 0.68, lancetH, "gothic", 8));
  ctx.arches.gothic += 1;
  ctx.asm.addPart("tower", jitterRing(shell.outer, ctx.rng, ctx.jitterAmt * 0.08, {
    lockY: [baseY, baseY + h],
    freezeSeams: true,
  }), shell.holes, { tiltDeg: tilt });

  const capBase = baseY + h - SEAM;
  const spireH = h * randRange(ctx.rng, 0.22, 0.3);
  const spireW = w * randRange(ctx.rng, 0.55, 0.72);
  ctx.asm.addPart("decoration", arch(cx, capBase, spireW, spireH, "gothic", 7), [], { tiltDeg: tilt });
  for (const ring of finial(cx, capBase + spireH * 0.88, spireH * 0.75, "needle")) {
    ctx.asm.addPart("decoration", ring, [], { tiltDeg: tilt });
  }
  ctx.counters.windowCount += 1;
}

/**
 * Torre élfica legacy (grafo antiguo / tests de módulo).
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfTower(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const capKind = /** @type {string} */ (node.params.capKind ?? "spire_cluster");
  const isCentral = !!node.params.isCentral;
  const { cx, baseY } = node;
  const tilt = (ctx.rng() - 0.5) * 1.0 * ctx.imperfection * ctx.profile.tiltScale;

  const shell = hollowRect(cx, baseY, w, h, w * randRange(ctx.rng, 0.18, 0.24));
  shell.outer = jitterRing(shell.outer, ctx.rng, ctx.jitterAmt * 0.1, {
    lockY: [baseY, baseY + h],
    freezeSeams: true,
  });

  const lancetH = h * randRange(ctx.rng, 0.42, 0.52);
  const lancetW = w * randRange(ctx.rng, 0.62, 0.78);
  const lancetY = baseY + h * randRange(ctx.rng, 0.38, 0.44);
  shell.holes.push(arch(cx, lancetY, lancetW, lancetH, "gothic", 8));
  ctx.arches.gothic += 1;

  ctx.asm.addPart("tower", shell.outer, shell.holes, { tiltDeg: tilt });

  const pilasterW = w * randRange(ctx.rng, 0.14, 0.18);
  for (const side of [-1, 1]) {
    const px = cx + side * (w / 2 + pilasterW * 0.35);
    ctx.asm.addPart(
      "decoration",
      rect(px, baseY + h * 0.08, pilasterW, h * randRange(ctx.rng, 0.72, 0.84)),
      [],
      { tiltDeg: tilt },
    );
  }

  const arrowH = lancetH * randRange(ctx.rng, 0.85, 0.96);
  const arrowW = lancetW * randRange(ctx.rng, 0.5, 0.64);
  const arrowY = lancetY + lancetH * 0.02;
  ctx.asm.addPart("decoration", elfArrowInlay(cx, arrowY, arrowW, arrowH), [], { tiltDeg: tilt });

  const ribN = 3 + Math.floor(ctx.rng() * 2);
  const ribBottom = baseY + h * 0.06;
  const ribTop = lancetY - h * 0.02;
  const ribH = Math.max(h * 0.08, ribTop - ribBottom);
  for (let r = 0; r < ribN; r++) {
    const t = ribN > 1 ? r / (ribN - 1) : 0.5;
    const rx = cx + (t - 0.5) * w * 0.55;
    ctx.asm.addPart("decoration", rect(rx, ribBottom, Math.max(w * 0.11, 0.9), ribH), [], { tiltDeg: tilt });
  }

  const capBaseY = baseY + h - SEAM;
  const needleH = h * randRange(ctx.rng, isCentral ? 0.32 : 0.24, isCentral ? 0.46 : 0.36);
  const crownW = Math.max(w * randRange(ctx.rng, 2.2, 2.9), 7.5);

  if (capKind === "rib_crown") {
    for (const ring of elfRibCrown(cx, capBaseY, crownW, needleH * 0.7)) {
      ctx.asm.addPart("decoration", jitterRing(ring, ctx.rng, ctx.jitterAmt * 0.12), [], { tiltDeg: tilt });
    }
  } else if (capKind === "gothic_arch") {
    const archCap = gothicArchCap(cx, capBaseY, crownW * 0.85, needleH * 0.72);
    ctx.asm.addPart("decoration", archCap, [], { tiltDeg: tilt });
    for (const ring of crossingArches(cx, capBaseY + needleH * 0.08, crownW * 0.48, needleH * 0.48)) {
      ctx.asm.addPart("decoration", ring, [], { tiltDeg: tilt });
    }
  } else if (capKind === "inverted_arrow" || capKind === "spire_cluster") {
    for (const ring of elfSpireCluster(cx, capBaseY, crownW, needleH * 0.9)) {
      ctx.asm.addPart("decoration", ring, [], { tiltDeg: tilt });
    }
  }

  const spikeN = isCentral ? 5 + Math.floor(ctx.rng() * 2) : 4 + Math.floor(ctx.rng() * 2);
  const spikeSpread = Math.max(w * (1.5 + spikeN * 0.1), crownW * 0.9);
  for (const spike of spikeRow(cx, capBaseY, spikeSpread, spikeN, needleH)) {
    ctx.asm.addPart("decoration", spike, [], { tiltDeg: tilt });
  }
  for (const ring of finial(cx, capBaseY + needleH * 0.88, needleH * 1.05, "needle")) {
    ctx.asm.addPart("decoration", ring, [], { tiltDeg: tilt });
  }
}

/**
 * Arco de unión entre dos torres (claustro aéreo).
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfSpanArch(ctx, node) {
  const x1 = /** @type {number} */ (node.params.x1);
  const x2 = /** @type {number} */ (node.params.x2);
  const archH = Math.max(/** @type {number} */ (node.params.h), 11);
  const midX = (x1 + x2) / 2;
  const spanW = Math.abs(x2 - x1) * 0.94;
  ctx.asm.addPart("decoration", arch(midX, node.baseY, spanW, archH, "gothic", 8));
  ctx.arches.gothic += 1;
}

/**
 * Cúpula de costillas sobre la torre central (remate dominante).
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfRibDome(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const { cx, baseY } = node;
  const drumH = h * randRange(ctx.rng, 0.14, 0.2);
  ctx.asm.addPart("decoration", rect(cx, baseY - drumH * 0.35, w * 1.08, drumH));
  for (const ring of elfRibCrown(cx, baseY, w, h)) {
    ctx.asm.addPart("decoration", jitterRing(ring, ctx.rng, ctx.jitterAmt * 0.1));
  }
  for (const ring of crossingArches(cx, baseY + h * 0.12, w * 0.62, h * 0.55)) {
    ctx.asm.addPart("decoration", ring);
  }
  ctx.arches.gothic += 4;
}

/**
 * Banda de arcadas (claustro) sobre la plataforma.
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfArcadeBand(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const rows = /** @type {number} */ (node.params.rows ?? 3);
  for (const ring of elfArcadeCluster(node.cx, node.baseY, w, h, rows)) {
    ctx.asm.addPart("decoration", jitterRing(ring, ctx.rng, ctx.jitterAmt * 0.2));
  }
  ctx.arches.gothic += rows * 2;
}

/**
 * Puente o basamento de arcadas delante de la entrada.
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfBridge(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const count = /** @type {number} */ (node.params.count ?? 3);
  for (const ring of elfBridgeArcade(node.cx, node.baseY, w, h, count)) {
    ctx.asm.addPart("decoration", jitterRing(ring, ctx.rng, ctx.jitterAmt * 0.18));
  }
  ctx.arches.gothic += count;
}

/**
 * Arbotante curvo entre dos puntos.
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfButtress(ctx, node) {
  const x1 = /** @type {number} */ (node.params.x1);
  const y1 = /** @type {number} */ (node.params.y1);
  const thick = /** @type {number} */ (node.params.thick ?? 1.1);
  ctx.asm.addPart("decoration", elfFlyingButtress(node.cx, node.baseY, x1, y1, thick));
}

/**
 * Pabellón lateral: cuerpo bajo con arcadas y tejado muy inclinado.
 * @param {import('./loader-fantasy-compose.js').ComposeContext} ctx
 * @param {import('./loader-fantasy-compose.js').ComposeNode} node
 */
function moduleElfPavilion(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const { cx, baseY } = node;
  const tilt = (ctx.rng() - 0.5) * 1.6 * ctx.imperfection * ctx.profile.tiltScale;

  let outer = rect(cx, baseY, w, h);
  outer = jitterRing(outer, ctx.rng, ctx.jitterAmt * 0.5, { lockY: [baseY, baseY + h], freezeSeams: true });

  /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
  const holes = [];
  const archN = 2 + Math.floor(ctx.rng() * 2);
  for (let a = 0; a < archN; a++) {
    const ax = cx + (a - (archN - 1) / 2) * w * 0.28;
    holes.push(aperture(ax, baseY + h * 0.28, w * 0.18, h * 0.55, "gothic"));
    ctx.arches.gothic += 1;
    ctx.counters.windowCount += 1;
  }
  ctx.asm.addPart("block", outer, holes, { tiltDeg: tilt });

  const roofH = h * randRange(ctx.rng, 0.65, 0.95);
  let roof = gableRoof(cx, baseY + h - SEAM, w * 0.92, roofH + SEAM);
  roof = jitterRing(roof, ctx.rng, ctx.jitterAmt * 0.4, { lockY: [baseY + h - SEAM], freezeSeams: true });
  ctx.asm.addPart("roof", roof, [], { tiltDeg: tilt });
  for (const ring of finial(cx, baseY + h + roofH - SEAM, roofH * 0.55, "needle")) {
    ctx.asm.addPart("decoration", ring);
  }
}

function moduleElfSlabCrown(ctx, node) {
  const w = /** @type {number} */ (node.params.w);
  const h = /** @type {number} */ (node.params.h);
  const capKind = /** @type {string} */ (node.params.capKind ?? "rib_crown");
  const { cx, baseY } = node;

  /** @type {import('./loader-fantasy-geom.js').FPoint[][]} */
  let rings = [];
  if (capKind === "rib_crown" || capKind === "spire_cluster") {
    rings = elfRibCrown(cx, baseY - SEAM, w, h + SEAM);
  } else {
    rings = elfSpireCluster(cx, baseY - SEAM, w * 0.55, h + SEAM);
  }
  for (const ring of rings) {
    ctx.asm.addPart("decoration", jitterRing(ring, ctx.rng, ctx.jitterAmt * 0.1));
  }
  for (const ring of finial(cx, baseY + h * 0.7, h * 0.85, "needle")) {
    ctx.asm.addPart("decoration", ring);
  }
}

/** Registra todos los módulos en el registry global. */
export function registerAllModules() {
  registerModule("core.plinth", moduleCorePlinth);
  registerModule("elf.door_outline", moduleElfDoorOutline);
  registerModule("elf.flank_arcades", moduleElfFlankArcades);
  registerModule("elf.flank_roofs", moduleElfFlankRoofs);
  registerModule("elf.roof_towers", moduleElfRoofTowers);
  registerModule("elf.podium", moduleElfPodium);
  registerModule("elf.deck", moduleElfDeck);
  registerModule("elf.tower", moduleElfTower);
  registerModule("elf.tower_central", moduleElfTowerCentral);
  registerModule("elf.tower_flank", moduleElfTowerFlank);
  registerModule("elf.slab_crown", moduleElfSlabCrown);
  registerModule("elf.span_arch", moduleElfSpanArch);
  registerModule("elf.rib_dome", moduleElfRibDome);
  registerModule("elf.arcade_band", moduleElfArcadeBand);
  registerModule("elf.bridge", moduleElfBridge);
  registerModule("elf.buttress", moduleElfButtress);
  registerModule("elf.pavilion", moduleElfPavilion);
}

let registered = false;

/** Idempotente: registra módulos una sola vez. */
export function ensureModulesRegistered() {
  if (!registered) {
    registerAllModules();
    registered = true;
  }
}
