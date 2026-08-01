/**
 * Transiciones shell ↔ sección con marco (logo único + bandas).
 * @module shell-section-transition
 */

import { shouldCompressWorldBands } from "./world-band-layout.js";
import {
  animateWorldBands,
  captureRect,
  clearLogoPinStyles,
  consumeWorldTransition,
  morphLogoBetweenRects,
  measureSectionFrameLogoTarget,
  pinLogoAtRect,
  setOrbitLayoutPaused,
  setWorldBandLayout,
} from "./world-transition.js";
import { getWorldSession } from "./world-session.js";
import { inferLogoRevealState, isLogoAssetReady, syncLogoRevealState } from "./logo-reveal.js";

/**
 * @returns {HTMLElement | null}
 */
export function findShellLogoElement() {
  const inSection = document.querySelector(".section-frame__logo-mount .loader-logo-wrap");
  if (inSection instanceof HTMLElement) return inSection;

  const inBrand = document.querySelector(".loader-auth-brand .loader-logo-wrap");
  if (inBrand instanceof HTMLElement) return inBrand;

  const inFocal = document.querySelector(".loader-focal .loader-logo-wrap");
  if (inFocal instanceof HTMLElement) return inFocal;

  // Morph / handoff: a veces queda en body sin ancla conocida
  const orphan = document.querySelector("body > .loader-logo-wrap");
  if (orphan instanceof HTMLElement) return orphan;

  return null;
}

/**
 * @param {string} fromPath
 * @returns {import('./world-transition.js').WorldSnapshot}
 */
export function captureShellNavigationSnapshot(fromPath) {
  const logoEl = findShellLogoElement();
  return {
    from: fromPath,
    fromBandsCompressed: shouldCompressWorldBands(fromPath),
    logo: captureRect(logoEl),
    logoEl,
  };
}

/**
 * Comprime o expande bandas del mundo en una escena loader.
 * @param {HTMLElement} scene
 * @param {boolean} targetCompressed
 * @param {{ snapshot?: import('./world-transition.js').WorldSnapshot | null; intent?: import('./world-transition.js').WorldIntent | null; durationMs?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function applyWorldBandTarget(scene, targetCompressed, opts = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durationMs = opts.durationMs ?? (reducedMotion ? 0 : 720);
  const snapshot = opts.snapshot ?? null;
  const intent = opts.intent ?? null;

  const fromCompressed =
    typeof snapshot?.fromBandsCompressed === "boolean"
      ? snapshot.fromBandsCompressed
      : scene.classList.contains("is-world-band-legal");

  const needsAnim =
    (intent?.bandTransition === true || fromCompressed !== targetCompressed)
    && fromCompressed !== targetCompressed;

  if (needsAnim && durationMs > 0) {
    setWorldBandLayout(scene, fromCompressed);
    setOrbitLayoutPaused(scene, true);
    void scene.offsetWidth;
    try {
      await animateWorldBands(scene, targetCompressed, durationMs);
    } finally {
      setOrbitLayoutPaused(scene, false);
    }
  } else {
    setWorldBandLayout(scene, targetCompressed);
  }

  // Garantía final: el destino queda aplicado aunque la transición falle.
  setWorldBandLayout(scene, targetCompressed);
  getWorldSession()?.fantasySceneTeardown?.relayout?.();
  getWorldSession()?.spaceOrbitTeardown?.relayout?.();
}

/**
 * Entrada a sección con marco: bandas compactas + morph del logo al slot del marco.
 * @param {{ scene: HTMLElement; logoMount: HTMLElement; onLogoSettled?: (logoWrap: HTMLElement) => void }} opts
 * @returns {Promise<void>}
 */
export async function applySectionEnter({ scene, logoMount, onLogoSettled }) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durationMs = reducedMotion ? 0 : 720;
  const { snapshot, intent } = consumeWorldTransition();
  const targetCompressed = true;

  await applyWorldBandTarget(scene, targetCompressed, { snapshot, intent, durationMs });

  let logoEl =
    snapshot?.logoEl instanceof HTMLElement ? snapshot.logoEl : findShellLogoElement();
  if (!(logoEl instanceof HTMLElement)) return;

  const fromLogo = snapshot?.logo ?? captureRect(logoEl);
  const toLogo = measureSectionFrameLogoTarget(logoMount);

  logoEl.classList.remove("is-auth-positioned", "legal-logo-wrap");
  if (isLogoAssetReady(logoEl)) {
    syncLogoRevealState(logoEl, "ready");
  } else {
    const inferred = inferLogoRevealState(logoEl);
    syncLogoRevealState(logoEl, inferred === "error" ? "error" : "pending");
  }

  if (!fromLogo || !toLogo || durationMs <= 0) {
    logoMount.appendChild(logoEl);
    clearLogoPinStyles(logoEl);
    settleLogoReveal(logoEl, onLogoSettled);
    return;
  }

  document.body.appendChild(logoEl);
  pinLogoAtRect(logoEl, fromLogo);

  const morphMs = reducedMotion ? 0 : Math.min(480, durationMs);
  await morphLogoBetweenRects(logoEl, fromLogo, toLogo, morphMs, { keepPinned: false });

  logoMount.appendChild(logoEl);
  clearLogoPinStyles(logoEl);
  settleLogoReveal(logoEl, onLogoSettled);
}

/**
 * @param {HTMLElement} logoEl
 * @param {((logoWrap: HTMLElement) => void) | undefined} onLogoSettled
 */
function settleLogoReveal(logoEl, onLogoSettled) {
  onLogoSettled?.(logoEl);
  if (isLogoAssetReady(logoEl)) {
    syncLogoRevealState(logoEl, "ready");
    onLogoSettled?.(logoEl);
    return;
  }
  const logoImg = logoEl.querySelector(".loader-logo");
  if (!(logoImg instanceof HTMLImageElement)) {
    syncLogoRevealState(logoEl, "error");
    onLogoSettled?.(logoEl);
    return;
  }
  const finish = (state) => {
    syncLogoRevealState(logoEl, state);
    onLogoSettled?.(logoEl);
  };
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    finish("ready");
    return;
  }
  logoImg.addEventListener("load", () => finish("ready"), { once: true });
  logoImg.addEventListener("error", () => finish("error"), { once: true });
}
