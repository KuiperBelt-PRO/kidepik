/**
 * Shell global post-login: FABs glass + drawer.
 * Se monta fuera de `#app` para sobrevivir al clear del router.
 * @module app-shell
 */

import { assetUrl } from "../lib/assets.manifest.js";
import { hashRoutePath, navigate } from "../lib/router.js";
import {
  legalTransitionSourceFromPath,
  navigateFromLegal,
  prepareLegalNavigation,
} from "../lib/legal-navigation.js";
import { navigateShellRoute } from "../lib/shell-navigation.js?v=183";
import {
  getShellUiTheme,
  initShellUiTheme,
  toggleShellUiTheme,
} from "../lib/shell-theme.js";
import { renderShellUiIconSvgInner } from "./shell-ui-icons.js";
import { bindShellFrame, unbindShellFrame, scheduleShellFrameSync } from "../lib/shell-frame.js";

/** @typedef {import('./shell-ui-icons.js').UiIconId} UiIconId */
/** @typedef {import('./shell-ui-icons.js').UiIconTheme} UiIconTheme */
/** @typedef {import('../lib/shell-theme.js').ShellUiTheme} ShellUiTheme */

/**
 * @typedef {{
 *   onSignOut: () => void | Promise<void>;
 * }} AppShellOptions
 */

/** @type {{ root: HTMLElement; destroy: () => void } | null} */
let shellHandle = null;

/**
 * @param {string} [path]
 * @returns {boolean}
 */
export function isShellRoutePath(path = hashRoutePath()) {
  return (
    path === "home" ||
    path === "account" ||
    path === "settings" ||
    path === "crew" ||
    path.startsWith("crew/") ||
    path.startsWith("play/") ||
    path.startsWith("legal/")
  );
}

/**
 * @param {UiIconId} id
 * @param {UiIconTheme} theme
 * @param {number} [viewSize]
 */
function iconSvg(id, theme, viewSize = 24) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "shell-ui-icon");
  svg.setAttribute("viewBox", `0 0 ${viewSize} ${viewSize}`);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = renderShellUiIconSvgInner({ id, theme, viewSize, fill: "#fff" });
  return svg;
}

/**
 * @param {HTMLElement} el
 * @param {UiIconId} id
 * @param {UiIconTheme} theme
 * @param {number} [viewSize]
 */
function replaceIcon(el, id, theme, viewSize = 24) {
  el.replaceChildren(iconSvg(id, theme, viewSize));
}

/**
 * @param {AppShellOptions} options
 * @returns {{ destroy: () => void }}
 */
export function mountAppShell(options) {
  destroyAppShell();

  const theme = initShellUiTheme();
  const root = document.createElement("div");
  root.className = "app-shell";
  root.dataset.open = "false";

  const chrome = document.createElement("div");
  chrome.className = "app-shell__chrome";
  chrome.setAttribute("role", "toolbar");
  chrome.setAttribute("aria-label", "Controles de la aplicación");

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "shell-fab shell-fab--menu";
  menuBtn.id = "shell-fab-menu";
  menuBtn.setAttribute("aria-controls", "shell-drawer");
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.setAttribute("aria-label", "Abrir menú");
  const menuIconSlot = document.createElement("span");
  menuIconSlot.className = "shell-fab__icon";
  menuBtn.appendChild(menuIconSlot);

  const rightCluster = document.createElement("div");
  rightCluster.className = "app-shell__chrome-right";

  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "shell-fab shell-fab--theme";
  themeBtn.id = "shell-fab-theme";
  const themeIconSlot = document.createElement("span");
  themeIconSlot.className = "shell-fab__icon";
  themeBtn.appendChild(themeIconSlot);

  const accountBtn = document.createElement("button");
  accountBtn.type = "button";
  accountBtn.className = "shell-fab shell-fab--account";
  accountBtn.id = "shell-fab-account";
  accountBtn.setAttribute("aria-label", "Cuenta");
  const accountIconSlot = document.createElement("span");
  accountIconSlot.className = "shell-fab__icon";
  accountBtn.appendChild(accountIconSlot);

  rightCluster.append(themeBtn, accountBtn);
  chrome.append(menuBtn, rightCluster);

  const scrim = document.createElement("button");
  scrim.type = "button";
  scrim.className = "app-shell__scrim";
  scrim.setAttribute("aria-label", "Cerrar menú");
  scrim.tabIndex = -1;

  const drawer = document.createElement("nav");
  drawer.className = "app-shell__drawer";
  drawer.id = "shell-drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", "Menú de la aplicación");
  drawer.setAttribute("aria-hidden", "true");

  const logoWrap = document.createElement("div");
  logoWrap.className = "app-shell__logo-wrap";
  const logoImg = document.createElement("img");
  logoImg.className = "app-shell__logo";
  logoImg.alt = "KidepiK";
  const logoSrc = assetUrl("loader.logo");
  if (logoSrc) logoImg.src = logoSrc;
  const logoFallback = document.createElement("p");
  logoFallback.className = "app-shell__logo-fallback";
  logoFallback.textContent = "KidepiK";
  logoFallback.hidden = true;
  logoImg.addEventListener("error", () => {
    logoImg.hidden = true;
    logoFallback.hidden = false;
  });
  logoWrap.append(logoImg, logoFallback);

  const list = document.createElement("ul");
  list.className = "app-shell__menu";

  /** @type {Set<string>} */
  const expanded = new Set();

  /** @type {{ id: string; label: string; icon: UiIconId; kind: 'link'|'stub'|'action'|'accordion'; href?: string; action?: string; children?: { id: string; label: string; href: string }[] }[]} */
  const items = [
    { id: "home", label: "Inicio", icon: "home", kind: "link", href: "/home" },
    { id: "crew", label: "Tripulación", icon: "crew", kind: "link", href: "/crew" },
    {
      id: "legal",
      label: "Legal",
      icon: "legal",
      kind: "accordion",
      children: [
        { id: "terms", label: "Términos", href: "/legal/terminos" },
        { id: "privacy", label: "Privacidad", href: "/legal/privacidad" },
      ],
    },
    { id: "settings", label: "Ajustes", icon: "settings", kind: "link", href: "/settings" },
    { id: "account", label: "Cuenta", icon: "account", kind: "link", href: "/account" },
    { id: "signout", label: "Cerrar sesión", icon: "signout", kind: "action", action: "signout" },
  ];

  const stubToast = document.createElement("div");
  stubToast.className = "app-shell__toast";
  stubToast.setAttribute("role", "status");
  stubToast.hidden = true;
  let toastTimer = 0;

  function showStubToast() {
    stubToast.textContent = "Próximamente";
    stubToast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      stubToast.hidden = true;
    }, 1800);
  }

  /**
   * @param {ShellUiTheme} t
   */
  function syncThemeControls(t) {
    const themeIconId = t === "sci-fi" ? "theme-to-fantasy" : "theme-to-scifi";
    const themeLabel =
      t === "sci-fi" ? "Cambiar a modo fantasía" : "Cambiar a modo ciencia ficción";
    themeBtn.setAttribute("aria-label", themeLabel);
    replaceIcon(themeIconSlot, themeIconId, t, 24);
    replaceIcon(menuIconSlot, "menu", t, 24);
    replaceIcon(accountIconSlot, "account", t, 24);

    list.querySelectorAll("[data-icon-id]").forEach((slot) => {
      if (!(slot instanceof HTMLElement)) return;
      const id = /** @type {UiIconId} */ (slot.dataset.iconId);
      const size = Number(slot.dataset.iconSize || 24);
      replaceIcon(slot, id, t, size);
    });

    list.querySelectorAll("[data-chevron]").forEach((slot) => {
      if (!(slot instanceof HTMLElement)) return;
      replaceIcon(slot, "chevron", t, 18);
    });
  }

  function closeDrawer() {
    root.dataset.open = "false";
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Abrir menú");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-shell-drawer-open");
    menuBtn.focus();
  }

  function openDrawer() {
    root.dataset.open = "true";
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Cerrar menú");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-shell-drawer-open");
    const first = list.querySelector("button, a");
    if (first instanceof HTMLElement) first.focus();
  }

  function toggleDrawer() {
    if (root.dataset.open === "true") closeDrawer();
    else openDrawer();
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "app-shell__menu-item";
    li.dataset.id = item.id;

    if (item.kind === "accordion" && item.children) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-shell__menu-row";
      btn.setAttribute("aria-expanded", "false");
      const panelId = `shell-submenu-${item.id}`;
      btn.setAttribute("aria-controls", panelId);

      const iconSlot = document.createElement("span");
      iconSlot.className = "app-shell__menu-icon";
      iconSlot.dataset.iconId = item.icon;
      iconSlot.dataset.iconSize = "24";

      const label = document.createElement("span");
      label.className = "shell-drawer__label app-shell__menu-label";
      label.textContent = item.label;

      const chevron = document.createElement("span");
      chevron.className = "app-shell__menu-chevron";
      chevron.dataset.chevron = "true";

      btn.append(iconSlot, label, chevron);

      const panelWrap = document.createElement("div");
      panelWrap.className = "app-shell__submenu-panel";

      const panel = document.createElement("ul");
      panel.className = "app-shell__submenu";
      panel.id = panelId;

      for (const child of item.children) {
        const childLi = document.createElement("li");
        const link = document.createElement("a");
        link.className = "app-shell__menu-row app-shell__menu-row--sub";
        link.href = `#${child.href}`;
        const childLabel = document.createElement("span");
        childLabel.className = "shell-drawer__label app-shell__menu-label";
        childLabel.textContent = child.label;
        link.appendChild(childLabel);
        link.addEventListener("click", (ev) => {
          ev.preventDefault();
          closeDrawer();
          prepareLegalNavigation(legalTransitionSourceFromPath(hashRoutePath()));
          navigate(child.href);
        });
        childLi.appendChild(link);
        panel.appendChild(childLi);
      }

      panelWrap.appendChild(panel);

      btn.addEventListener("click", () => {
        const isOpen = expanded.has(item.id);
        if (isOpen) {
          expanded.delete(item.id);
          li.classList.remove("is-expanded");
          btn.setAttribute("aria-expanded", "false");
        } else {
          expanded.add(item.id);
          li.classList.add("is-expanded");
          btn.setAttribute("aria-expanded", "true");
        }
        syncThemeControls(getShellUiTheme());
      });

      li.append(btn, panelWrap);
    } else {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "app-shell__menu-row";

      const iconSlot = document.createElement("span");
      iconSlot.className = "app-shell__menu-icon";
      iconSlot.dataset.iconId = item.icon;
      iconSlot.dataset.iconSize = "24";

      const label = document.createElement("span");
      label.className = "shell-drawer__label app-shell__menu-label";
      label.textContent = item.label;

      row.append(iconSlot, label);

      row.addEventListener("click", () => {
        if (item.kind === "link" && item.href) {
          closeDrawer();
          if (item.href.startsWith("/legal/")) {
            void navigateFromLegal(item.href);
          } else {
            void navigateShellRoute(item.href);
          }
          return;
        }
        if (item.kind === "stub") {
          showStubToast();
          return;
        }
        if (item.kind === "action" && item.action === "signout") {
          closeDrawer();
          void Promise.resolve(options.onSignOut());
        }
      });

      li.appendChild(row);
    }

    list.appendChild(li);
  }

  drawer.append(logoWrap, list, stubToast);
  root.append(chrome, scrim, drawer);
  document.body.classList.add("is-shell-active");
  document.body.appendChild(root);
  bindShellFrame(root);

  syncThemeControls(theme);

  function onMenuClick() {
    toggleDrawer();
  }

  function onThemeClick() {
    const next = toggleShellUiTheme();
    syncThemeControls(next);
  }

  function onAccountClick() {
    closeDrawer();
    void navigateShellRoute("/account");
  }

  function onScrimClick() {
    closeDrawer();
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onKeyDown(ev) {
    if (ev.key === "Escape" && root.dataset.open === "true") {
      ev.preventDefault();
      closeDrawer();
    }
  }

  menuBtn.addEventListener("click", onMenuClick);
  themeBtn.addEventListener("click", onThemeClick);
  accountBtn.addEventListener("click", onAccountClick);
  scrim.addEventListener("click", onScrimClick);
  window.addEventListener("keydown", onKeyDown);

  const handle = {
    root,
    destroy() {
      window.clearTimeout(toastTimer);
      unbindShellFrame();
      menuBtn.removeEventListener("click", onMenuClick);
      themeBtn.removeEventListener("click", onThemeClick);
      accountBtn.removeEventListener("click", onAccountClick);
      scrim.removeEventListener("click", onScrimClick);
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("is-shell-drawer-open", "is-shell-active");
      root.remove();
      if (shellHandle === handle) shellHandle = null;
    },
  };

  // @ts-expect-error attach root for identity
  handle.root = root;
  shellHandle = handle;
  return handle;
}

/**
 * Garantiza shell en rutas de gestión autenticadas.
 * @param {AppShellOptions} options
 */
export function ensureAppShell(options) {
  if (!isShellRoutePath()) {
    destroyAppShell();
    return null;
  }
  if (shellHandle) {
    scheduleShellFrameSync();
    return shellHandle;
  }
  return mountAppShell(options);
}

export function destroyAppShell() {
  shellHandle?.destroy();
  shellHandle = null;
}

/**
 * @returns {boolean}
 */
export function isAppShellMounted() {
  return Boolean(shellHandle);
}
