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
import { runLoaderAuthMorph } from "./loader-auth-morph.js";
import { mountAuthPanel } from "./auth-panel.js";

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

  function setReady() {
    if (destroyed || state !== "loading") return;
    state = "ready";
    scene.classList.add("is-gate-ready");
    hint.hidden = false;
    hint.classList.add("is-visible");
    if (!reducedMotion) {
      hint.classList.add("is-pulse");
    }
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

  function onLoadingComplete() {
    if (destroyed || state !== "loading") return;
    if (hintTimer != null) clearTimeout(hintTimer);
    hintTimer = setTimeout(setReady, delay);
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
    hint.classList.remove("is-visible", "is-pulse");
    focal.classList.remove("is-gate-tappable");
    focal.removeAttribute("role");
    focal.removeAttribute("tabindex");
    focal.removeAttribute("aria-label");

    // Sesión en paralelo: el morph no debe esperar a la red.
    const sessionPromise = Promise.resolve()
      .then(() => getSession())
      .catch(() => null);

    state = "auth-morph";

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

    if (destroyed) return;

    const session = await sessionPromise;

    if (isSessionValid(session)) {
      navigate("/home");
      return;
    }

    state = "auth-idle";
    scene.classList.add("is-auth-idle");
    scene.classList.remove("is-gate-exiting");
    const authStack = chrome.querySelector(".loader-auth-stack");
    mountAuthPanel(authStack instanceof HTMLElement ? authStack : chrome, {
      embedded: true,
    });
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

  return {
    onLoadingComplete,
    getState: () => state,
    destroy() {
      destroyed = true;
      if (hintTimer != null) clearTimeout(hintTimer);
      focal.removeEventListener("click", handleEnter);
      focal.removeEventListener("keydown", onKeyDown);
      hint.remove();
    },
  };
}
