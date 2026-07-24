/**
 * Puerta de entrada del loader: ready → hint → tap → exiting.
 * @module loader-gate
 */

import { navigate } from "../lib/router.js";
import { getValidSession } from "../lib/supabase.js";
import {
  GATE_COPY,
  isSessionValid,
  resolveGateHintDelay,
  resolveGateMorphDuration,
} from "./loader-gate-constants.js";
import { runLoaderAuthMorph } from "./loader-auth-morph.js?v=109";
import { mountAuthPanel } from "./auth-panel.js?v=109";
import { bindLegalLinkTransitions } from "../scenes/legal.js";

/** @typedef {'loading' | 'ready' | 'exiting' | 'auth-morph' | 'auth-idle'} GateState */

export {
  GATE_COPY,
  GATE_HINT_DELAY_MS,
  GATE_HINT_DELAY_REDUCED_MS,
  GATE_HINT_DELAY_DEMO_MS,
  GATE_MORPH_MS,
  GATE_MORPH_REDUCED_MS,
  resolveGateHintDelay,
  resolveGateMorphDuration,
  isSessionValid,
} from "./loader-gate-constants.js";

/**
 * @param {{
 *   scene: HTMLElement;
 *   chrome: HTMLElement;
 *   focal: HTMLElement;
 *   ringWrap: HTMLElement;
 *   logoWrap: HTMLElement;
 *   reducedMotion?: boolean;
 *   demo?: boolean;
 *   hintDelayMs?: number;
 *   getSession?: () => Promise<unknown>;
 * }} options
 * @returns {{
 *   destroy: () => void;
 *   onLoadingComplete: () => void;
 *   getState: () => GateState;
 * }}
 */
export function mountLoaderGate({
  scene,
  chrome,
  focal,
  ringWrap,
  logoWrap,
  reducedMotion = false,
  demo = false,
  hintDelayMs,
  getSession = getValidSession,
}) {
  /** @type {GateState} */
  let state = "loading";
  /** @type {ReturnType<typeof setTimeout> | null} */
  let hintTimer = null;
  let destroyed = false;

  const hint = document.createElement("p");
  hint.className = "loader-gate-hint";
  hint.setAttribute("aria-live", "polite");
  hint.hidden = true;

  const hintSci = document.createElement("span");
  hintSci.className = "loader-gate-hint__sci";
  hintSci.textContent = GATE_COPY.hintSci;

  const hintFantasy = document.createElement("span");
  hintFantasy.className = "loader-gate-hint__fantasy";
  hintFantasy.textContent = GATE_COPY.hintFantasy;

  hint.append(hintSci, hintFantasy);
  chrome.appendChild(hint);

  const delay = resolveGateHintDelay(reducedMotion, {
    demo,
    overrideMs: hintDelayMs,
  });
  const morphMs = resolveGateMorphDuration(reducedMotion);

  function enableTap() {
    if (destroyed || state !== "loading") return;
    state = "ready";
    scene.classList.add("is-gate-ready");
    focal.classList.add("is-gate-tappable");
    focal.setAttribute("role", "button");
    focal.setAttribute("tabindex", "0");
    focal.setAttribute("aria-label", GATE_COPY.aria);
    scene.removeAttribute("role");
    scene.removeAttribute("aria-valuemin");
    scene.removeAttribute("aria-valuemax");
    scene.removeAttribute("aria-valuenow");
    scene.setAttribute("aria-label", GATE_COPY.aria);
  }

  function showHint() {
    if (destroyed || state !== "ready") return;
    hint.hidden = false;
    // Primero la línea sci-fi; la fantasía entra con delay CSS.
    hint.classList.add("is-visible");
    if (!reducedMotion) {
      hint.classList.add("is-pulse");
    }
    hint.classList.add("is-gate-tappable");
    hint.setAttribute("role", "button");
    hint.setAttribute("tabindex", "0");
    hint.setAttribute("aria-label", GATE_COPY.aria);
  }

  function onLoadingComplete() {
    if (destroyed || state !== "loading") return;
    // El disco ya se puede pulsar en cuanto termina el círculo de letras.
    enableTap();
    if (hintTimer != null) clearTimeout(hintTimer);
    // El texto del hint aparece medio segundo después.
    hintTimer = setTimeout(showHint, delay);
  }

  /**
   * @param {Event} [event]
   */
  async function handleEnter(event) {
    if (destroyed || state !== "ready") return;
    event?.preventDefault?.();
    state = "exiting";
    scene.classList.remove("is-gate-ready");
    scene.classList.add("is-gate-exiting");
    hint.classList.remove("is-visible", "is-pulse", "is-gate-tappable");
    hint.removeAttribute("role");
    hint.removeAttribute("tabindex");
    hint.removeAttribute("aria-label");
    focal.classList.remove("is-gate-tappable");
    focal.removeAttribute("role");
    focal.removeAttribute("tabindex");
    focal.removeAttribute("aria-label");

    // Sesión en paralelo: el morph no debe esperar a la red.
    const sessionPromise = Promise.resolve()
      .then(() => getSession())
      .catch(() => null);

    state = "auth-morph";

    // Reservar altura final del panel ANTES del morph para que el FLIP
    // apunte a la posición centrada definitiva (sin salto al montar el CTA).
    let authStack = chrome.querySelector(".loader-auth-stack");
    if (!(authStack instanceof HTMLElement)) {
      authStack = document.createElement("div");
      authStack.className = "loader-auth-stack";
      chrome.appendChild(authStack);
    }
    if (!authStack.querySelector(".loader-auth-brand")) {
      const brand = document.createElement("div");
      brand.className = "loader-auth-brand";
      authStack.appendChild(brand);
    }
    const authPanel = mountAuthPanel(authStack, {
      embedded: true,
      deferredReveal: true,
    });
    bindLegalLinkTransitions(authPanel.root);

    await new Promise((resolve) => {
      runLoaderAuthMorph({
        scene,
        chrome,
        ringWrap,
        logoWrap,
        durationMs: morphMs,
        onComplete: resolve,
      });
    });

    if (destroyed) {
      authPanel.destroy();
      return;
    }

    const session = await sessionPromise;

    if (isSessionValid(session)) {
      authPanel.destroy();
      navigate("/home");
      return;
    }

    state = "auth-idle";
    scene.classList.add("is-auth-idle");
    scene.classList.remove("is-gate-exiting");
    authPanel.reveal();
  }

  /**
   * @param {KeyboardEvent} event
   */
  function onKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      void handleEnter(event);
    }
  }

  focal.addEventListener("click", handleEnter);
  focal.addEventListener("keydown", onKeyDown);
  hint.addEventListener("click", handleEnter);
  hint.addEventListener("keydown", onKeyDown);

  return {
    onLoadingComplete,
    getState: () => state,
    destroy() {
      destroyed = true;
      if (hintTimer != null) clearTimeout(hintTimer);
      focal.removeEventListener("click", handleEnter);
      focal.removeEventListener("keydown", onKeyDown);
      hint.removeEventListener("click", handleEnter);
      hint.removeEventListener("keydown", onKeyDown);
      hint.remove();
    },
  };
}
