/**
 * Marco glass de sección autenticada (logo + título fijo + scroll con fade).
 * @module section-frame
 */

import { getShellUiTheme, subscribeShellUiTheme } from "../lib/shell-theme.js";
import {
  shellNavBack,
  shellNavForward,
  subscribeShellNav,
} from "../lib/shell-nav-stack.js";
import { renderShellUiIconSvgInner } from "./shell-ui-icons.js";
import { inferLogoRevealState, isLogoAssetReady, syncLogoRevealState } from "../lib/logo-reveal.js";

const EXIT_MS = 220;
let titleSeq = 0;

/**
 * @param {string} direction
 * @returns {SVGSVGElement}
 */
function createNavIconSvg(direction) {
  const theme = getShellUiTheme();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "section-frame__nav-icon");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  const rotate = direction === "back" ? "90deg" : "-90deg";
  svg.style.transform = `rotate(${rotate})`;
  svg.innerHTML = renderShellUiIconSvgInner({
    id: "chevron",
    theme,
    viewSize: 20,
    fill: "#fff",
  });
  return svg;
}

/**
 * @param {boolean | { back?: boolean; forward?: boolean }} [navigation]
 * @returns {{ enabled: boolean; back: boolean; forward: boolean }}
 */
function resolveNavOptions(navigation) {
  if (navigation === false) return { enabled: false, back: false, forward: false };
  if (navigation === undefined || navigation === true) {
    return { enabled: true, back: true, forward: true };
  }
  return {
    enabled: true,
    back: navigation.back !== false,
    forward: navigation.forward !== false,
  };
}

/**
 * @param {HTMLElement} header
 * @param {{ back: boolean; forward: boolean }} navOptions
 * @returns {{ destroy: () => void }}
 */
function mountSectionNav(header, navOptions) {
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "section-frame__nav-btn section-frame__nav-btn--back";
  backBtn.setAttribute("aria-label", "Atrás");
  backBtn.appendChild(createNavIconSvg("back"));

  const forwardBtn = document.createElement("button");
  forwardBtn.type = "button";
  forwardBtn.className = "section-frame__nav-btn section-frame__nav-btn--forward";
  forwardBtn.setAttribute("aria-label", "Adelante");
  forwardBtn.appendChild(createNavIconSvg("forward"));

  if (navOptions.back) header.appendChild(backBtn);
  if (navOptions.forward) header.appendChild(forwardBtn);

  function syncButtons(state) {
    if (navOptions.back) backBtn.disabled = !state.canBack;
    if (navOptions.forward) forwardBtn.disabled = !state.canForward;
  }

  if (navOptions.back) backBtn.addEventListener("click", () => void shellNavBack());
  if (navOptions.forward) forwardBtn.addEventListener("click", () => void shellNavForward());

  const unsubNav = subscribeShellNav(syncButtons);
  const unsubTheme = subscribeShellUiTheme(() => {
    if (navOptions.back) backBtn.replaceChildren(createNavIconSvg("back"));
    if (navOptions.forward) forwardBtn.replaceChildren(createNavIconSvg("forward"));
  });

  return {
    destroy() {
      unsubNav();
      unsubTheme();
      backBtn.remove();
      forwardBtn.remove();
    },
  };
}

/**
 * Skeleton del wordmark en el slot del marco.
 * @param {HTMLElement} logoMount
 * @returns {{ destroy: () => void; syncFromLogo: (logoWrap: HTMLElement | null) => void }}
 */
function mountLogoSkeleton(logoMount) {
  const skel = document.createElement("div");
  skel.className = "section-frame__logo-skeleton glass-skeleton__line";
  skel.setAttribute("aria-hidden", "true");
  logoMount.appendChild(skel);

  function syncFromLogo(logoWrap) {
    if (!(logoWrap instanceof HTMLElement)) {
      skel.hidden = false;
      logoMount.classList.add("is-logo-slot-pending");
      logoMount.classList.remove("is-logo-slot-ready", "is-logo-slot-error");
      return;
    }
    // Autosanación: si el asset ya está decodificado, no dejar pending colgado
    if (isLogoAssetReady(logoWrap) && !logoWrap.classList.contains("is-logo-error")) {
      syncLogoRevealState(logoWrap, "ready");
    }
    const state = inferLogoRevealState(logoWrap);
    const pending = state === "pending";
    skel.hidden = !pending;
    logoMount.classList.toggle("is-logo-slot-pending", pending);
    logoMount.classList.toggle("is-logo-slot-ready", state === "ready");
    logoMount.classList.toggle("is-logo-slot-error", state === "error");
  }

  syncFromLogo(null);

  return {
    destroy() {
      skel.remove();
      logoMount.classList.remove("is-logo-slot-pending", "is-logo-slot-ready", "is-logo-slot-error");
    },
    syncFromLogo,
  };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   ariaLabel?: string;
 *   title?: string;
 *   navigation?: boolean | { back?: boolean; forward?: boolean };
 * }} [options]
 * @returns {{
 *   root: HTMLElement;
 *   contentEl: HTMLElement;
 *   logoMountEl: HTMLElement;
 *   titleEl: HTMLElement | null;
 *   setTitle: (text: string) => void;
 *   syncLogoSkeleton: (logoWrap?: HTMLElement | null) => void;
 *   destroy: () => Promise<void>;
 * }}
 */
export function mountSectionFrame(host, options = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const exitMs = reducedMotion ? 80 : EXIT_MS;
  const navOptions = resolveNavOptions(options.navigation);
  const titleId = `section-frame-title-${++titleSeq}`;

  const root = document.createElement("div");
  root.className = "section-frame is-entering";
  root.setAttribute("role", "region");

  const header = document.createElement("div");
  header.className = "section-frame__header";

  /** @type {{ destroy: () => void } | null} */
  let navHandle = null;
  if (navOptions.enabled) {
    navHandle = mountSectionNav(header, navOptions);
  }

  const brand = document.createElement("div");
  brand.className = "section-frame__brand";

  const logoMount = document.createElement("div");
  logoMount.className = "section-frame__logo-mount";
  logoMount.setAttribute("aria-hidden", "true");
  brand.appendChild(logoMount);

  const logoSkeleton = mountLogoSkeleton(logoMount);

  /** @type {HTMLHeadingElement | null} */
  let titleEl = null;
  const initialTitle = typeof options.title === "string" ? options.title.trim() : "";
  if (initialTitle !== "" || options.title !== undefined) {
    titleEl = document.createElement("h1");
    titleEl.className = "section-frame__title";
    titleEl.id = titleId;
    titleEl.textContent = initialTitle;
    brand.appendChild(titleEl);
  }

  header.appendChild(brand);

  if (titleEl) {
    root.setAttribute("aria-labelledby", titleId);
  } else {
    root.setAttribute("aria-label", options.ariaLabel ?? "Sección");
  }

  const scroll = document.createElement("div");
  scroll.className = "section-frame__scroll";

  const content = document.createElement("div");
  content.className = "section-frame__content";
  scroll.appendChild(content);

  root.append(header, scroll);
  host.appendChild(root);

  requestAnimationFrame(() => {
    root.classList.remove("is-entering");
  });

  /**
   * @param {string} text
   */
  function setTitle(text) {
    const next = String(text ?? "").trim();
    if (!titleEl) {
      titleEl = document.createElement("h1");
      titleEl.className = "section-frame__title";
      titleEl.id = titleId;
      brand.appendChild(titleEl);
      root.removeAttribute("aria-label");
      root.setAttribute("aria-labelledby", titleId);
    }
    titleEl.textContent = next;
    titleEl.hidden = next === "";
  }

  return {
    root,
    contentEl: content,
    logoMountEl: logoMount,
    get titleEl() {
      return titleEl;
    },
    setTitle,
    syncLogoSkeleton(logoWrap) {
      logoSkeleton.syncFromLogo(logoWrap ?? logoMount.querySelector(".loader-logo-wrap"));
    },
    destroy() {
      return new Promise((resolve) => {
        navHandle?.destroy();
        navHandle = null;
        logoSkeleton.destroy();
        if (!root.isConnected) {
          resolve();
          return;
        }
        root.classList.add("is-exiting");
        window.setTimeout(() => {
          root.remove();
          resolve();
        }, exitMs);
      });
    },
  };
}
