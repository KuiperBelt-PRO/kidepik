/**
 * Marco glass de sección autenticada (logo + scroll con fade).
 * @module section-frame
 */

import { getShellUiTheme, subscribeShellUiTheme } from "../lib/shell-theme.js";
import {
  shellNavBack,
  shellNavForward,
  subscribeShellNav,
} from "../lib/shell-nav-stack.js";
import { renderShellUiIconSvgInner } from "./shell-ui-icons.js";

const EXIT_MS = 220;

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
 * @param {HTMLElement} host
 * @param {{ ariaLabel?: string; navigation?: boolean | { back?: boolean; forward?: boolean } }} [options]
 * @returns {{ root: HTMLElement; contentEl: HTMLElement; logoMountEl: HTMLElement; destroy: () => Promise<void> }}
 */
export function mountSectionFrame(host, options = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const exitMs = reducedMotion ? 80 : EXIT_MS;
  const navOptions = resolveNavOptions(options.navigation);

  const root = document.createElement("div");
  root.className = "section-frame is-entering";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", options.ariaLabel ?? "Sección");

  const header = document.createElement("div");
  header.className = "section-frame__header";

  /** @type {{ destroy: () => void } | null} */
  let navHandle = null;
  if (navOptions.enabled) {
    navHandle = mountSectionNav(header, navOptions);
  }

  const logoMount = document.createElement("div");
  logoMount.className = "section-frame__logo-mount";
  logoMount.setAttribute("aria-hidden", "true");
  header.appendChild(logoMount);

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

  return {
    root,
    contentEl: content,
    logoMountEl: logoMount,
    destroy() {
      return new Promise((resolve) => {
        navHandle?.destroy();
        navHandle = null;
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
