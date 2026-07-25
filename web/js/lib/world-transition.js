/**
 * Transiciones compartidas entre escenas del mundo (loader/auth ↔ legal).
 * @module world-transition
 */

import { getWorldSession } from "./world-session.js?v=156";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

/** @type {{ snapshot: WorldSnapshot | null; intent: WorldIntent | null }} */
const store = { snapshot: null, intent: null };

/**
 * @typedef {{
 *   left: number;
 *   top: number;
 *   width: number;
 *   height: number;
 * }} RectSnapshot
 */

/**
 * @typedef {{
 *   logo?: RectSnapshot | null;
 *   logoEl?: HTMLElement | null;
 *   from?: string;
 *   spaceBand?: number;
 *   fantasyBand?: number;
 *   bandsAlreadyExpanded?: boolean;
 * }} WorldSnapshot
 */

/**
 * @typedef {{
 *   to?: string;
 *   slug?: string;
 *   resumeAuth?: boolean;
 * }} WorldIntent
 */

/**
 * @param {Element | null | undefined} el
 * @returns {RectSnapshot | null}
 */
export function captureRect(el) {
  if (!(el instanceof Element)) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
  };
}

/**
 * @param {WorldSnapshot | null | undefined} snapshot
 * @param {WorldIntent | null | undefined} intent
 */
export function prepareWorldTransition(snapshot, intent) {
  store.snapshot = snapshot ?? null;
  store.intent = intent ?? null;
}

/**
 * @returns {{ snapshot: WorldSnapshot | null; intent: WorldIntent | null }}
 */
export function consumeWorldTransition() {
  const out = { snapshot: store.snapshot, intent: store.intent };
  store.snapshot = null;
  store.intent = null;
  return out;
}

/**
 * @returns {{ snapshot: WorldSnapshot | null; intent: WorldIntent | null }}
 */
export function peekWorldTransition() {
  return { snapshot: store.snapshot, intent: store.intent };
}

/**
 * @param {HTMLElement} scene
 * @param {boolean} compressed
 */
export function setWorldBandLayout(scene, compressed) {
  scene.classList.toggle("is-world-band-legal", compressed);
  scene.classList.toggle("is-world-band-loader", !compressed);
}

/**
 * Mide la posición final del logo en legal sin mutar bandas ni el layout orbital.
 * @param {HTMLElement} scene
 * @param {HTMLElement} logoEl
 * @returns {RectSnapshot | null}
 */
function measureLegalLogoTarget(scene, logoEl) {
  const sceneRect = scene.getBoundingClientRect();
  const logoRect = logoEl.getBoundingClientRect();
  if (!sceneRect.width || !logoRect.width) return captureRect(logoEl);

  const dvh = window.innerHeight / 100;
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const logoTopOffset = 21 * dvh + Math.max(0.25 * rootPx, Math.min(1.5 * dvh, rootPx));

  return {
    left: sceneRect.left + (sceneRect.width - logoRect.width) / 2,
    top: sceneRect.top + logoTopOffset,
    width: logoRect.width,
    height: logoRect.height,
  };
}

/**
 * Mide el destino del logo en auth sin mutar bandas (evita salto al volver de legal).
 * El logo ya debe estar en el brand de auth con clases finales.
 * @param {HTMLElement} logoEl
 * @returns {RectSnapshot | null}
 */
function measureAuthLogoTarget(logoEl) {
  return captureRect(logoEl);
}

/**
 * Congela el layout orbital en modo loader durante transiciones (evita salto al montar legal).
 * @param {HTMLElement} scene
 * @param {boolean} paused
 */
export function setOrbitLayoutPaused(scene, paused) {
  scene.classList.toggle("is-orbit-layout-paused", paused);
}

/**
 * @param {HTMLElement} scene
 * @param {HTMLElement} logoEl
 * @param {boolean} compressed
 * @returns {RectSnapshot | null}
 */
export function measureLogoRectAtBand(scene, logoEl, compressed) {
  setWorldBandLayout(scene, compressed);
  void scene.offsetWidth;
  return captureRect(logoEl);
}

/**
 * Aplica pin fixed en un rect (handoff entre escenas / morph).
 * @param {HTMLElement} el
 * @param {RectSnapshot} rect
 */
export function pinLogoAtRect(el, rect) {
  el.classList.add("is-logo-morphing");
  el.style.position = "fixed";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.margin = "0";
  el.style.zIndex = "80";
}

/**
 * Quita estilos inline del morph/pin.
 * @param {HTMLElement} el
 */
export function clearLogoPinStyles(el) {
  el.style.position = "";
  el.style.left = "";
  el.style.top = "";
  el.style.width = "";
  el.style.height = "";
  el.style.margin = "";
  el.style.zIndex = "";
  el.classList.remove("is-logo-morphing");
}

/**
 * Morph suave del logo (posición + escala) con position:fixed para no interferir con el layout de bandas.
 * @param {HTMLElement} el
 * @param {RectSnapshot} from
 * @param {RectSnapshot} to
 * @param {number} durationMs
 * @param {{ keepPinned?: boolean }} [options] si keepPinned, deja el logo fixed en `to` (vuelta legal→auth)
 * @returns {Promise<void>}
 */
export function morphLogoBetweenRects(el, from, to, durationMs, options = {}) {
  const keepPinned = options.keepPinned === true;

  if (!from || !to || durationMs <= 0 || typeof el.animate !== "function") {
    if (keepPinned && to) pinLogoAtRect(el, to);
    return Promise.resolve();
  }

  const unchanged = Math.abs(from.left - to.left) < 0.5
    && Math.abs(from.top - to.top) < 0.5
    && Math.abs(from.width - to.width) < 0.5
    && Math.abs(from.height - to.height) < 0.5;
  if (unchanged) {
    if (keepPinned) pinLogoAtRect(el, to);
    return Promise.resolve();
  }

  el.classList.add("is-logo-morphing");

  const placeholder = document.createElement("div");
  placeholder.className = "world-logo-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.style.width = `${to.width}px`;
  placeholder.style.height = `${to.height}px`;
  el.parentElement?.insertBefore(placeholder, el);

  pinLogoAtRect(el, from);

  const anim = el.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
      },
    ],
    { duration: durationMs, easing: EASE, fill: "forwards" },
  );

  return anim.finished
    .then(() => {
      if (typeof anim.commitStyles === "function") anim.commitStyles();
    })
    .catch(() => {})
    .finally(() => {
      anim.cancel();
      placeholder.remove();
      if (keepPinned) {
        // Importante: no volver al layout CSS de legal (provoca salto al handoff).
        pinLogoAtRect(el, to);
      } else {
        clearLogoPinStyles(el);
      }
    });
}

/**
 * Transición coordinada logo + bandas del mundo.
 * @param {HTMLElement} scene
 * @param {HTMLElement} logoEl
 * @param {RectSnapshot | null | undefined} from
 * @param {boolean} toCompressed
 * @param {number} durationMs
 * @param {RectSnapshot | null | undefined} [toHint] destino ya medido (p. ej. al volver a auth)
 * @param {{ keepPinned?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function morphLogoWithBands(scene, logoEl, from, toCompressed, durationMs, toHint, options = {}) {
  const keepPinned = options.keepPinned === true;

  if (!from || durationMs <= 0) {
    setWorldBandLayout(scene, toCompressed);
    if (keepPinned && toHint) pinLogoAtRect(logoEl, toHint);
    return;
  }

  const enteringLegal = toCompressed && scene.classList.contains("scene-legal");
  const returningAuth = !toCompressed && scene.classList.contains("scene-loader");
  // Vuelta desde legal: escena sigue siendo scene-legal; toHint + keepPinned.
  const expandingFromLegal = !toCompressed && scene.classList.contains("scene-legal");
  const pauseOrbit = enteringLegal || returningAuth || expandingFromLegal || Boolean(toHint) || !toCompressed;
  if (pauseOrbit) setOrbitLayoutPaused(scene, true);

  // Partir del layout opuesto al destino (comprimido↔loader) sin medir toggling.
  setWorldBandLayout(scene, !toCompressed);
  void scene.offsetWidth;

  /** @type {RectSnapshot | null} */
  let to = toHint ?? null;
  if (!to) {
    if (enteringLegal) {
      to = measureLegalLogoTarget(scene, logoEl);
    } else if (returningAuth) {
      to = measureAuthLogoTarget(logoEl);
    } else if (!toCompressed) {
      // Expansión sin hint: no togglear bandas; usar rect actual como destino seguro
      to = captureRect(logoEl);
    } else {
      to = measureLogoRectAtBand(scene, logoEl, toCompressed);
      setWorldBandLayout(scene, !toCompressed);
      void scene.offsetWidth;
    }
  }

  if (!to) {
    if (pauseOrbit) setOrbitLayoutPaused(scene, false);
    setWorldBandLayout(scene, toCompressed);
    return;
  }

  try {
    await Promise.all([
      morphLogoBetweenRects(logoEl, from, to, durationMs, { keepPinned }),
      animateWorldBands(scene, toCompressed, durationMs),
    ]);
  } finally {
    if (pauseOrbit && !keepPinned) setOrbitLayoutPaused(scene, false);
    if (keepPinned) {
      // Mantener órbita pausada hasta el handoff a loader/auth.
      pinLogoAtRect(logoEl, to);
    }
    getWorldSession()?.fantasySceneTeardown?.relayout?.();
    getWorldSession()?.spaceOrbitTeardown?.relayout?.();
  }
}

/**
 * @param {HTMLElement} el
 * @param {RectSnapshot | null | undefined} from
 * @param {number} durationMs
 * @returns {Promise<void>}
 */
export function flipFromRect(el, from, durationMs) {
  if (!from || durationMs <= 0 || typeof el.animate !== "function") {
    return Promise.resolve();
  }

  const last = el.getBoundingClientRect();
  const dx = from.left - last.left;
  const dy = from.top - last.top;
  const sx = from.width / Math.max(last.width, 1);
  const sy = from.height / Math.max(last.height, 1);

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) {
    return Promise.resolve();
  }

  el.style.transformOrigin = "top left";
  const anim = el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: "translate(0px, 0px) scale(1, 1)" },
    ],
    { duration: durationMs, easing: EASE, fill: "forwards" },
  );

  return anim.finished
    .then(() => {
      if (typeof anim.commitStyles === "function") anim.commitStyles();
      anim.cancel();
      el.style.transform = "";
      el.style.transformOrigin = "";
    })
    .catch(() => {
      el.style.transform = "";
      el.style.transformOrigin = "";
    });
}

/**
 * @param {HTMLElement} scene
 * @param {boolean} toCompressed
 * @param {number} durationMs
 * @returns {Promise<void>}
 */
export function animateWorldBands(scene, toCompressed, durationMs) {
  const atTarget = scene.classList.contains(toCompressed ? "is-world-band-legal" : "is-world-band-loader");
  if (!atTarget) {
    setWorldBandLayout(scene, toCompressed);
  }

  if (durationMs <= 0) return Promise.resolve();

  const orbitRelayout = getWorldSession()?.spaceOrbitTeardown?.relayout;
  const fantasyRelayout = getWorldSession()?.fantasySceneTeardown?.relayout;
  let rafId = 0;
  const tick = () => {
    orbitRelayout?.();
    fantasyRelayout?.();
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(rafId);
      orbitRelayout?.();
      fantasyRelayout?.();
      scene.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === scene) finish();
    };
    scene.addEventListener("transitionend", onEnd);
    const timer = setTimeout(finish, durationMs + 60);
  });
}

export { EASE as WORLD_TRANSITION_EASE };
