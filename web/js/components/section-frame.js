/**
 * Marco glass de sección autenticada (logo + scroll con fade).
 * @module section-frame
 */

import { getShellUiTheme, subscribeShellUiTheme } from "../lib/shell-theme.js";
import {
  shellNavBack,
  shellNavForward,
  subscribeShellNav,
} from "../lib/shell-nav-stack.js?v=186";
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
 * @param {HTMLElement} header
 * @returns {{ destroy: () => void }}
 */
function mountSectionNav(header) {
  const nav = document.createElement("div");
  nav.className = "section-frame__nav";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "section-frame__nav-btn";
  backBtn.setAttribute("aria-label", "Atrás");
  backBtn.appendChild(createNavIconSvg("back"));

  const forwardBtn = document.createElement("button");
  forwardBtn.type = "button";
  forwardBtn.className = "section-frame__nav-btn";
  forwardBtn.setAttribute("aria-label", "Adelante");
  forwardBtn.appendChild(createNavIconSvg("forward"));

  nav.append(backBtn, forwardBtn);
  header.appendChild(nav);

  function syncButtons(state) {
    backBtn.disabled = !state.canBack;
    forwardBtn.disabled = !state.canForward;
  }

  backBtn.addEventListener("click", () => void shellNavBack());
  forwardBtn.addEventListener("click", () => void shellNavForward());

  const unsubNav = subscribeShellNav(syncButtons);
  const unsubTheme = subscribeShellUiTheme(() => {
    backBtn.replaceChildren(createNavIconSvg("back"));
    forwardBtn.replaceChildren(createNavIconSvg("forward"));
  });

  return {
    destroy() {
      unsubNav();
      unsubTheme();
      nav.remove();
    },
  };
}

/**
 * @param {HTMLElement} host
 * @param {{ ariaLabel?: string; navigation?: boolean }} [options]
 * @returns {{ root: HTMLElement; contentEl: HTMLElement; logoMountEl: HTMLElement; destroy: () => Promise<void> }}
 */
export function mountSectionFrame(host, options = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const exitMs = reducedMotion ? 80 : EXIT_MS;
  const showNav = options.navigation !== false;

  const root = document.createElement("div");
  root.className = "section-frame is-entering";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", options.ariaLabel ?? "Sección");

  const header = document.createElement("div");
  header.className = "section-frame__header";

  /** @type {{ destroy: () => void } | null} */
  let navHandle = null;
  if (showNav) {
    navHandle = mountSectionNav(header);
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
