/**
 * Render DOM/SVG del motor FX del loader.
 *
 * @module loader-fx-render
 */

import {
  adjustSceneParticleBudget,
  maxParticlesPerHost,
  maxParticlesScene,
} from "./loader-fx-engine.js";
import { subscribeLoaderAnimationFrame } from "./loader-animation-frame.js";
import { createRng, randRange } from "./loader-ship-rng.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const FX_WHITE = "#ffffff";
/** Vida infinita para motas que acompañan al host todo el ciclo. */
const PERPETUAL_LIFE = Number.POSITIVE_INFINITY;
const REFLECTION_FADE_IN_MS = 950;
const MOTE_FADE_IN_MS = 520;
const MOTE_FADE_OUT_MS = 680;
const BURST_FADE_IN_MS = 240;
const BURST_FADE_OUT_MS = 200;
const SCATTER_FADE_IN_MS = 300;
const SCATTER_FADE_OUT_MS = 340;
const PORTAL_INFLOW_FADE_IN_MS = 100;
const PORTAL_INFLOW_FADE_OUT_MS = 220;

/**
 * @param {number} t 0..1
 */
function smoothstep(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** @typedef {import('./loader-fx-engine.js').FxRecipe} FxRecipe */

/**
 * @param {number} n
 */
function fmt(n) {
  return String(Math.round(n * 100) / 100);
}

/**
 * @typedef {{
 *   el: SVGCircleElement;
 *   x: number;
 *   y: number;
 *   vx: number;
 *   vy: number;
 *   life: number;
 *   maxLife: number;
 *   kind: string;
 *   wobble: number;
 *   age: number;
 *   fadeInMs: number;
 *   fadeOutMs: number;
 *   retireAt: number;
 *   targetX?: number;
 *   targetY?: number;
 *   lastOpacity?: number;
 * }} FxParticle
 */

/**
 * @typedef {{
 *   basePath: SVGPathElement;
 *   gradStops: SVGStopElement[];
 *   cx: number;
 *   cy: number;
 *   ux: number;
 *   uy: number;
 *   halfLen: number;
 *   phase: number;
 *   drift: number;
 *   maskId: string;
 * }} FxCrystalReflection
 */

/**
 * @param {SVGStopElement} stop
 * @param {number} offset
 * @param {number} opacity
 */
function setGradStop(stop, offset, opacity) {
  stop.setAttribute("offset", fmt(Math.min(1, Math.max(0, offset))));
  stop.setAttribute("stop-color", FX_WHITE);
  stop.setAttribute("stop-opacity", fmt(opacity));
}

/**
 * @param {FxRecipe} recipe
 * @param {{ reducedMotion?: boolean }} opts
 */
function createNoopBundle(recipe, opts = {}) {
  return {
    onPhase() {},
    setErosionProgress() {},
    setErosionMask() {},
    destroy() {},
    recipe,
    reducedMotion: !!opts.reducedMotion,
  };
}

/**
 * @param {HTMLElement} hostEl
 * @param {SVGSVGElement} hostSvg
 * @param {FxRecipe} recipe
 * @param {{ reducedMotion?: boolean; displayScalePx?: number }} opts
 */
export function mountFxBundle(hostEl, hostSvg, recipe, opts = {}) {
  const { reducedMotion = false, displayScalePx = 80 } = opts;
  if (reducedMotion || typeof document === "undefined") {
    return createNoopBundle(recipe, { reducedMotion });
  }

  const budget = recipe.effects.reduce((s, e) => s + (e.particleBudget ?? 0), 0);
  const hostParticleCap = maxParticlesPerHost(recipe.hostKind);
  const sceneParticleCap = maxParticlesScene(recipe.hostKind);
  if (budget > hostParticleCap) {
    return createNoopBundle(recipe);
  }

  function adjustHostSceneBudget(delta) {
    adjustSceneParticleBudget(delta, sceneParticleCap);
  }

  let destroyed = false;
  let unsubFrame = () => {};
  let loopActive = false;
  let phase = "building";
  let erosionT = 0;
  let fxStartMs = 0;
  let scatterCooldown = 0;
  let activeParticles = 0;
  let portalInflowCount = 0;
  let erosionMaskUrl = null;
  let reflectionStartMs = 0;
  let portalSpawnAccum = 0;

  const hasPortalInflow = recipe.effects.some((e) => e.type === "portal_inflow");

  const rng = createRng(recipe.seed ^ 0xf09e21);
  const intensity = recipe.intensity ?? 1;

  const fxSvg = document.createElementNS(SVG_NS, "svg");
  fxSvg.setAttribute("class", "loader-fx-layer");
  fxSvg.setAttribute("viewBox", "0 0 100 100");
  fxSvg.setAttribute("preserveAspectRatio", hostSvg.getAttribute("preserveAspectRatio") ?? "xMidYMax meet");
  fxSvg.style.width = hostSvg.style.width || `${displayScalePx}px`;
  fxSvg.style.height = hostSvg.style.height || `${displayScalePx}px`;
  fxSvg.style.position = "absolute";
  fxSvg.style.inset = "0";
  fxSvg.style.pointerEvents = "none";
  fxSvg.style.overflow = "visible";

  const particleGroup = document.createElementNS(SVG_NS, "g");
  particleGroup.setAttribute("class", "loader-fx-particles");

  fxSvg.appendChild(particleGroup);
  hostEl.appendChild(fxSvg);

  let hostDefs = hostSvg.querySelector("defs");
  if (!hostDefs) {
    hostDefs = document.createElementNS(SVG_NS, "defs");
    hostSvg.insertBefore(hostDefs, hostSvg.firstChild);
  }

  const reflectionOverlayRoot = document.createElementNS(SVG_NS, "g");
  reflectionOverlayRoot.setAttribute("class", "loader-fx-reflections");
  hostSvg.appendChild(reflectionOverlayRoot);

  const crystalPartPaths = [...hostSvg.querySelectorAll('.loader-fantasy-part[data-role="crystal"] > path')];

  /** @type {FxCrystalReflection[]} */
  const crystalReflections = [];
  const bodies = recipe.anchors.filter((a) => a.role === "crystal_body" && a.path);

  for (const body of bodies) {
    const idx = Number(body.id.replace("body-", ""));
    const basePath = crystalPartPaths[idx];
    if (!basePath) continue;

    const centerAnchor = recipe.anchors.find((a) => a.id === `center-${idx}`);
    const axisAnchor = recipe.anchors.find((a) => a.id === `axis-${idx}`);
    if (!centerAnchor || !axisAnchor) continue;

    const edx = (axisAnchor.x2 ?? axisAnchor.x) - axisAnchor.x;
    const edy = (axisAnchor.y2 ?? axisAnchor.y) - axisAnchor.y;
    const elen = Math.hypot(edx, edy) || 1;
    const ux = edx / elen;
    const uy = edy / elen;
    const halfLen = elen * 0.55;

    const maskId = `fx-refl-mask-${recipe.seed}-${idx}`;
    const gradId = `fx-refl-grad-${recipe.seed}-${idx}`;
    const mask = document.createElementNS(SVG_NS, "mask");
    mask.setAttribute("id", maskId);
    mask.setAttribute("maskUnits", "userSpaceOnUse");

    const grad = document.createElementNS(SVG_NS, "linearGradient");
    grad.setAttribute("id", gradId);
    grad.setAttribute("gradientUnits", "userSpaceOnUse");
    grad.setAttribute("x1", fmt(centerAnchor.x - ux * halfLen));
    grad.setAttribute("y1", fmt(centerAnchor.y - uy * halfLen));
    grad.setAttribute("x2", fmt(centerAnchor.x + ux * halfLen));
    grad.setAttribute("y2", fmt(centerAnchor.y + uy * halfLen));

    /** @type {SVGStopElement[]} */
    const gradStops = [];
    for (let s = 0; s < 5; s += 1) {
      const stop = /** @type {SVGStopElement} */ (document.createElementNS(SVG_NS, "stop"));
      setGradStop(stop, s / 4, 1);
      grad.appendChild(stop);
      gradStops.push(stop);
    }
    hostDefs.appendChild(grad);

    const maskFill = document.createElementNS(SVG_NS, "path");
    maskFill.setAttribute("d", body.path);
    maskFill.setAttribute("fill", `url(#${gradId})`);
    maskFill.setAttribute("fill-rule", "evenodd");
    mask.appendChild(maskFill);
    hostDefs.appendChild(mask);

    crystalReflections.push({
      basePath,
      gradStops,
      cx: centerAnchor.x,
      cy: centerAnchor.y,
      ux,
      uy,
      halfLen,
      phase: axisAnchor.phase ?? rng() * Math.PI * 2,
      drift: randRange(rng, 0.26, 0.42),
      maskId,
    });
  }

  function resetReflectionMaskNeutral() {
    for (const crystal of crystalReflections) {
      for (const stop of crystal.gradStops) {
        setGradStop(stop, parseFloat(stop.getAttribute("offset") || "0"), 1);
      }
    }
  }

  function setReflectionMaskActive(active) {
    for (const crystal of crystalReflections) {
      if (active) {
        resetReflectionMaskNeutral();
        crystal.basePath.setAttribute("mask", `url(#${crystal.maskId})`);
      } else {
        crystal.basePath.removeAttribute("mask");
        resetReflectionMaskNeutral();
      }
    }
  }

  /** @type {FxParticle[]} */
  const particles = [];

  function spawnParticle(x, y, vx, vy, lifeMs, kind, radius = 0.8) {
    if (destroyed || activeParticles >= hostParticleCap) return;
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", fmt(x));
    circle.setAttribute("cy", fmt(y));
    circle.setAttribute("r", fmt(radius));
    circle.setAttribute("fill", FX_WHITE);
    circle.setAttribute("class", "loader-fx-particle");
    circle.style.opacity = "0";
    particleGroup.appendChild(circle);

    const fadeInMs = kind === "mote"
      ? MOTE_FADE_IN_MS
      : kind === "burst"
        ? BURST_FADE_IN_MS
        : SCATTER_FADE_IN_MS;
    const fadeOutMs = kind === "mote"
      ? MOTE_FADE_OUT_MS
      : kind === "burst"
        ? BURST_FADE_OUT_MS
        : SCATTER_FADE_OUT_MS;
    const retireAt = kind === "mote"
      ? randRange(rng, 4200, 8800)
      : lifeMs;

    particles.push({
      el: circle,
      x,
      y,
      vx,
      vy,
      life: lifeMs,
      maxLife: lifeMs,
      kind,
      wobble: rng() * Math.PI * 2,
      age: 0,
      fadeInMs,
      fadeOutMs,
      retireAt,
    });
    activeParticles += 1;
    adjustHostSceneBudget(1);
  }

  /**
   * @param {FxParticle} p
   * @param {number} baseOpacity
   * @param {number} erosionFade
   */
  function particleOpacity(p, baseOpacity, erosionFade) {
    const fadeIn = smoothstep(p.age / p.fadeInMs);
    let fadeOut = 1;
    if (p.kind === "mote") {
      if (p.age > p.retireAt) {
        fadeOut = 1 - smoothstep((p.age - p.retireAt) / p.fadeOutMs);
      }
    } else if (Number.isFinite(p.life)) {
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio < 0.38) {
        fadeOut = smoothstep(lifeRatio / 0.38);
      }
    }
    return Math.max(0, baseOpacity * fadeIn * fadeOut * erosionFade);
  }

  function spawnBurst() {
    const burstFx = recipe.effects.find((e) => e.type === "burst" && e.phase === "building_end");
    if (!burstFx || (burstFx.particleBudget ?? 0) <= 0) return;
    const count = burstFx.particleBudget ?? 8;
    const tips = recipe.anchors.filter((a) => a.role === "crystal_tip");
    for (let i = 0; i < count; i += 1) {
      const tip = tips[i % tips.length];
      const angle = randRange(rng, -Math.PI, Math.PI);
      const speed = randRange(rng, 0.14, 0.28) * intensity;
      spawnParticle(
        tip.x,
        tip.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        burstFx.durationMs ?? 350,
        "burst",
        randRange(rng, 0.9, 1.6),
      );
    }
  }

  function spawnMote() {
    const bounds = clusterBounds();
    const x = randRange(rng, bounds.minX, bounds.maxX);
    const y = randRange(rng, bounds.minY, bounds.maxY);
    const drift = (recipe.meta?.moteDrift ?? 1) * intensity;
    const angle = randRange(rng, 0, Math.PI * 2);
    const speed = randRange(rng, 0.09, 0.2) * drift;
    spawnParticle(
      x,
      y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      PERPETUAL_LIFE,
      "mote",
      randRange(rng, 0.5, 1.05),
    );
  }

  function ensureMotes(targetCount) {
    const moteFx = recipe.effects.find((e) => e.type === "mote");
    if (!moteFx) return;
    const want = Math.min(moteFx.particleBudget ?? 8, targetCount);
    while (particles.filter((p) => p.kind === "mote").length < want) {
      spawnMote();
    }
  }

  function clusterBounds() {
    const tips = recipe.anchors.filter((a) => a.role === "crystal_tip");
    if (tips.length === 0) {
      return { minX: 30, maxX: 70, minY: 20, maxY: 90 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const t of tips) {
      minX = Math.min(minX, t.x);
      maxX = Math.max(maxX, t.x);
      minY = Math.min(minY, t.y);
      maxY = Math.max(maxY, t.y);
    }
    const pad = 8;
    return {
      minX: minX - pad,
      maxX: maxX + pad,
      minY: minY - pad,
      maxY: maxY + pad + 14,
    };
  }

  function wrapParticle(p) {
    const bounds = clusterBounds();
    if (p.x < bounds.minX) p.x = bounds.maxX;
    if (p.x > bounds.maxX) p.x = bounds.minX;
    if (p.y < bounds.minY) p.y = bounds.maxY;
    if (p.y > bounds.maxY) p.y = bounds.minY;
  }

  function spawnScatter() {
    const scatterFx = recipe.effects.find((e) => e.type === "scatter" && e.phase === "eroding");
    if (!scatterFx || erosionT > 0.9) return;
    const tips = recipe.anchors.filter((a) => a.role === "crystal_tip");
    const pool = tips;
    if (pool.length === 0) return;
    const src = pool[Math.floor(rng() * pool.length)];
    const x = src.x2 != null ? src.x + (src.x2 - src.x) * rng() : src.x;
    const y = src.y2 != null ? src.y + (src.y2 - src.y) * rng() : src.y;
    spawnParticle(
      x,
      y,
      randRange(rng, -0.1, 0.1),
      randRange(rng, -0.22, -0.1),
      randRange(rng, 500, 1100),
      "scatter",
      randRange(rng, 0.7, 1.2),
    );
  }

  function resetPortalInflowParticle(p) {
    const spawns = recipe.anchors.filter((a) => a.role === "portal_rock_spawn");
    const target = recipe.anchors.find((a) => a.role === "portal_aperture");
    if (!spawns.length || !target) return false;

    const src = spawns[Math.floor(rng() * spawns.length)];
    p.x = src.x + randRange(rng, -0.7, 0.7);
    p.y = src.y + randRange(rng, -0.7, 0.7);
    p.targetX = target.x + randRange(rng, -1.4, 1.4);
    p.targetY = target.y + randRange(rng, -1.4, 1.4);
    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = randRange(rng, 0.95, 1.75) * intensity;
    p.vx = (dx / dist) * speed;
    p.vy = (dy / dist) * speed;
    p.age = 0;
    p.wobble = rng() * Math.PI * 2;
    p.lastOpacity = 0;
    p.el.setAttribute("transform", `translate(${fmt(p.x)} ${fmt(p.y)})`);
    p.el.style.opacity = "0";
    return true;
  }

  function spawnPortalInflow() {
    if (destroyed || activeParticles >= hostParticleCap) return;
    const spawns = recipe.anchors.filter((a) => a.role === "portal_rock_spawn");
    const target = recipe.anchors.find((a) => a.role === "portal_aperture");
    if (!spawns.length || !target) return;

    const radiusMin = typeof recipe.meta?.particleRadiusMin === "number"
      ? recipe.meta.particleRadiusMin
      : 0.85;
    const radiusMax = typeof recipe.meta?.particleRadiusMax === "number"
      ? recipe.meta.particleRadiusMax
      : 1.45;

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "0");
    circle.setAttribute("r", fmt(randRange(rng, radiusMin, radiusMax)));
    circle.setAttribute("fill", FX_WHITE);
    circle.setAttribute("class", "loader-fx-particle loader-fx-portal-particle");
    circle.style.opacity = "0";
    particleGroup.appendChild(circle);

    /** @type {FxParticle} */
    const p = {
      el: circle,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: PERPETUAL_LIFE,
      maxLife: PERPETUAL_LIFE,
      kind: "portal_inflow",
      targetX: 0,
      targetY: 0,
      wobble: 0,
      age: 0,
      fadeInMs: PORTAL_INFLOW_FADE_IN_MS,
      fadeOutMs: PORTAL_INFLOW_FADE_OUT_MS,
      retireAt: PERPETUAL_LIFE,
    };
    resetPortalInflowParticle(p);
    particles.push(p);
    activeParticles += 1;
    portalInflowCount += 1;
    adjustHostSceneBudget(1);
  }

  function portalInflowBudgetForPhase() {
    const fx = recipe.effects.find(
      (e) => e.type === "portal_inflow" && e.phase === phase,
    );
    return fx?.particleBudget ?? 0;
  }

  function tick(now, dt = 16) {
    if (destroyed) return;
    if (fxStartMs === 0) fxStartMs = now;
    const elapsed = (now - fxStartMs) / 1000;
    const frameDt = Math.min(48, Math.max(1, dt));
    const isAlive = phase === "holding" || phase === "eroding";
    const erosionFade = erosionMaskUrl
      ? 1
      : phase === "eroding"
        ? Math.max(0, 1 - erosionT * 0.95)
        : 1;

    if (isAlive) {
      if (reflectionStartMs === 0) reflectionStartMs = now;
      const reflectionFade = smoothstep((now - reflectionStartMs) / REFLECTION_FADE_IN_MS);

      for (const crystal of crystalReflections) {
        const travel = 0.5 + 0.5 * Math.sin(elapsed * crystal.drift + crystal.phase);
        const bandHalf = 0.13;
        const baseLum = 1 - reflectionFade * 0.44;
        const peakPulse = 0.88 + 0.12 * Math.sin(elapsed * 0.36 + crystal.phase);
        const peakLum = Math.min(1, baseLum + reflectionFade * peakPulse * (1 - baseLum));

        setGradStop(crystal.gradStops[0], 0, baseLum);
        setGradStop(crystal.gradStops[1], Math.max(0, travel - bandHalf), baseLum);
        setGradStop(crystal.gradStops[2], travel, peakLum);
        setGradStop(crystal.gradStops[3], Math.min(1, travel + bandHalf), baseLum);
        setGradStop(crystal.gradStops[4], 1, baseLum);
      }
      ensureMotes(recipe.effects.find((e) => e.type === "mote")?.particleBudget ?? 12);
    } else {
      reflectionStartMs = 0;
      resetReflectionMaskNeutral();
    }

    if (phase === "eroding" && scatterCooldown <= 0) {
      spawnScatter();
      scatterCooldown = randRange(rng, 35, 65);
    }
    scatterCooldown = Math.max(0, scatterCooldown - frameDt);

    if (hasPortalInflow && (phase === "holding" || phase === "eroding")) {
      const budget = portalInflowBudgetForPhase();
      let inflowCount = portalInflowCount;
      const spawnInterval = typeof recipe.meta?.spawnIntervalMs === "number"
        ? recipe.meta.spawnIntervalMs
        : 4;
      const spawnBurst = typeof recipe.meta?.spawnBurst === "number"
        ? recipe.meta.spawnBurst
        : 1;
      portalSpawnAccum += frameDt;
      while (
        portalSpawnAccum >= spawnInterval
        && inflowCount < budget
        && activeParticles < hostParticleCap
      ) {
        for (let b = 0; b < spawnBurst && inflowCount < budget && activeParticles < hostParticleCap; b += 1) {
          spawnPortalInflow();
          inflowCount += 1;
        }
        portalSpawnAccum -= spawnInterval;
      }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.age += frameDt;

      if (Number.isFinite(p.life)) {
        p.life -= frameDt;
      }

      if (p.kind === "mote" && isAlive) {
        const wobble = Math.sin(elapsed * 2.8 + p.wobble) * 0.028 * intensity;
        p.vx += wobble;
        p.vy += Math.cos(elapsed * 2.4 + p.wobble) * 0.02 * intensity;
        const speed = Math.hypot(p.vx, p.vy);
        const minSpeed = 0.075 * intensity;
        if (speed < minSpeed) {
          const angle = randRange(rng, 0, Math.PI * 2);
          p.vx = Math.cos(angle) * minSpeed;
          p.vy = Math.sin(angle) * minSpeed;
        }
        const maxSpeed = 0.3 * intensity;
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }
      } else if (p.kind === "burst") {
        p.vx *= 0.94;
        p.vy *= 0.94;
      } else if (p.kind === "scatter") {
        p.vy -= 0.004 * intensity;
      } else if (p.kind === "portal_inflow") {
        const tx = p.targetX ?? p.x;
        const ty = p.targetY ?? p.y;
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.35) {
          const pull = 0.11 * intensity;
          p.vx += (dx / dist) * pull;
          p.vy += (dy / dist) * pull;
          const sp = Math.hypot(p.vx, p.vy);
          const maxSp = 2.4 * intensity;
          if (sp > maxSp) {
            p.vx = (p.vx / sp) * maxSp;
            p.vy = (p.vy / sp) * maxSp;
          }
        }
        const wobble = Math.sin(elapsed * 4.2 + p.wobble) * 0.014 * intensity;
        p.vx += wobble;
        p.vy += Math.cos(elapsed * 3.6 + p.wobble) * 0.012 * intensity;
      }

      p.x += p.vx;
      p.y += p.vy;

      if (p.kind === "portal_inflow") {
        const tx = p.targetX ?? p.x;
        const ty = p.targetY ?? p.y;
        const dist = Math.hypot(tx - p.x, ty - p.y);
        const nearCore = dist < 2.2;
        const fadeIn = smoothstep(p.age / p.fadeInMs);
        const coreFade = nearCore ? Math.max(0.08, dist / 2.2) : 1;
        const op = fadeIn * coreFade * 0.88 * intensity * erosionFade;
        if (Math.abs((p.lastOpacity ?? -1) - op) > 0.02) {
          p.lastOpacity = op;
          p.el.style.opacity = String(op);
        }
        p.el.setAttribute("transform", `translate(${fmt(p.x)} ${fmt(p.y)})`);
        if (nearCore && phase === "holding") {
          resetPortalInflowParticle(p);
        } else if (nearCore || (phase === "eroding" && erosionFade < 0.12)) {
          p.el.remove();
          particles.splice(i, 1);
          activeParticles -= 1;
          portalInflowCount -= 1;
          adjustHostSceneBudget(-1);
        }
        continue;
      }

      if (p.kind === "mote") {
        wrapParticle(p);
        const moteOp = particleOpacity(p, Math.max(0.32, 0.62 * intensity), erosionFade);
        p.el.style.opacity = String(moteOp);
        if (p.age > p.retireAt + p.fadeOutMs) {
          p.el.remove();
          particles.splice(i, 1);
          activeParticles -= 1;
          adjustHostSceneBudget(-1);
          continue;
        }
      } else if (p.kind === "scatter") {
        p.el.style.opacity = String(
          particleOpacity(p, intensity * 0.9, erosionFade),
        );
      } else {
        p.el.style.opacity = String(particleOpacity(p, intensity, 1));
      }

      p.el.setAttribute("cx", fmt(p.x));
      p.el.setAttribute("cy", fmt(p.y));

      if (Number.isFinite(p.life) && p.life <= 0) {
        p.el.remove();
        particles.splice(i, 1);
        activeParticles -= 1;
        adjustHostSceneBudget(-1);
      }
    }
  }

  function startLoop() {
    if (loopActive) return;
    loopActive = true;
    unsubFrame = subscribeLoaderAnimationFrame(tick);
  }

  function stopLoop() {
    if (!loopActive) return;
    loopActive = false;
    unsubFrame();
    unsubFrame = () => {};
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    setReflectionMaskActive(false);
    while (particles.length > 0) {
      particles.pop()?.el.remove();
      adjustHostSceneBudget(-1);
    }
    activeParticles = 0;
    reflectionOverlayRoot.remove();
    fxSvg.remove();
  }

  return {
    onPhase(nextPhase) {
      if (destroyed) return;
      if (nextPhase === "building_end") {
        spawnBurst();
        startLoop();
      }
      if (nextPhase === "holding") {
        phase = "holding";
        reflectionStartMs = 0;
        portalSpawnAccum = 0;
        setReflectionMaskActive(true);
        ensureMotes(recipe.effects.find((e) => e.type === "mote")?.particleBudget ?? 12);
        startLoop();
      }
      if (nextPhase === "eroding") {
        phase = "eroding";
        setReflectionMaskActive(true);
        startLoop();
      }
      if (nextPhase === "gone") {
        destroy();
      }
    },
    setErosionProgress(t) {
      erosionT = Math.min(1, Math.max(0, t));
    },
    setErosionMask(maskUrl) {
      erosionMaskUrl = maskUrl;
      fxSvg.setAttribute("mask", maskUrl || "");
      if (!maskUrl) {
        fxSvg.removeAttribute("mask");
      }
    },
    destroy,
    recipe,
  };
}
