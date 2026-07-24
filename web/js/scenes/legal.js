/**
 * Escena de documentos legales (Términos / Privacidad).
 * @module legal
 */

import { config } from "../config.js";
import { renderMarkdown } from "../lib/markdown.js";
import { navigate } from "../lib/router.js";
import {
  animateWorldBands,
  captureRect,
  consumeWorldTransition,
  morphLogoWithBands,
  pinLogoAtRect,
  prepareWorldTransition,
  setOrbitLayoutPaused,
  setWorldBandLayout,
  WORLD_TRANSITION_EASE,
} from "../lib/world-transition.js";
import {
  attachWorldLayersTo,
  destroyWorldSession,
  detachWorldLayers,
  getWorldLayers,
  isWorldRouteHash,
} from "../lib/world-session.js";
import {
  createWorldLayersDom,
  createWorldLogoDom,
  mountWorldLayers,
  mountWorldLogo,
} from "../components/world-layers.js?v=138";

const SLUG_API = {
  terminos: "terminos",
  privacidad: "privacidad",
};

const TRANSITION_MS = 720;
const TRANSITION_MS_REDUCED = 120;

/**
 * @param {string} routeSlug
 * @returns {string | null}
 */
function apiSlugForRoute(routeSlug) {
  return SLUG_API[routeSlug] ?? null;
}

/**
 * @param {string} label
 * @param {"back" | "top"} kind
 * @returns {HTMLButtonElement}
 */
function createFab(label, kind) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `legal-fab legal-fab--${kind}`;
  btn.setAttribute("aria-label", label);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "legal-fab__svg");
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("aria-hidden", "true");

  const uid = Math.random().toString(36).slice(2, 8);
  const maskId = `legal-fab-mask-${kind}-${uid}`;

  // Flechas HUD geométricas (Bruno Ace / Orbitron no traen glifos de flecha útiles).
  const cut = kind === "back"
    ? `
      <path d="M26 11 L13 20 L26 29" fill="none" stroke="#000" stroke-width="3.4" stroke-linejoin="miter" stroke-linecap="square"/>
      <path d="M15.5 20 H29" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="square"/>
      <path d="M29 14.5 V25.5" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="square"/>
    `
    : `
      <path d="M11 26 L20 13 L29 26" fill="none" stroke="#000" stroke-width="3.4" stroke-linejoin="miter" stroke-linecap="square"/>
      <path d="M20 15.5 V29" fill="none" stroke="#000" stroke-width="3.4" stroke-linecap="square"/>
      <path d="M14.5 29 H25.5" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="square"/>
    `;

  svg.innerHTML = `
    <defs>
      <mask id="${maskId}">
        <rect width="40" height="40" fill="#fff"/>
        ${cut}
      </mask>
    </defs>
    <circle cx="20" cy="20" r="17.5" fill="#fff" mask="url(#${maskId})"/>
  `;

  btn.appendChild(svg);
  return btn;
}

/**
 * @param {string} routeSlug
 * @returns {Promise<{ title: string; body_markdown: string } | null>}
 */
async function fetchLegalDoc(routeSlug) {
  const apiSlug = apiSlugForRoute(routeSlug);
  if (!apiSlug) return null;

  try {
    const res = await fetch(`${config.apiUrl}/legal/${apiSlug}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.title || !data?.body_markdown) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {{ slug: string }} params
 * @returns {{ destroy: () => void }}
 */
export function renderLegal({ slug }) {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  const routeSlug = slug || "terminos";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durationMs = reducedMotion ? TRANSITION_MS_REDUCED : TRANSITION_MS;
  const transition = consumeWorldTransition();
  const fromAuth = transition.snapshot?.from === "auth" || transition.intent?.from === "auth";

  const scene = document.createElement("div");
  scene.className = "scene scene-legal scene-world is-reveal-bg is-reveal-fantasy is-reveal-space";
  scene.dataset.legalSlug = routeSlug;
  if (fromAuth) scene.classList.add("is-orbit-layout-paused");
  setWorldBandLayout(scene, fromAuth ? false : true);

  const reusedLayers = attachWorldLayersTo(scene);
  /** @type {{ destroy: () => void }} */
  let world = { destroy() {} };

  if (!reusedLayers) {
    const { layers } = createWorldLayersDom();
    world = mountWorldLayers({
      layers,
      scene,
      reducedMotion,
      revealed: true,
    });
    scene.insertBefore(layers, scene.firstChild);
  }

  const chrome = document.createElement("div");
  chrome.className = "legal-chrome";

  const backFab = createFab("Volver", "back");
  const topFab = createFab("Volver arriba", "top");
  topFab.hidden = true;

  const header = document.createElement("header");
  header.className = "legal-header";

  const { logoWrap, fallback } = createWorldLogoDom();
  logoWrap.classList.add("legal-logo-wrap");
  header.appendChild(backFab);
  header.appendChild(logoWrap);

  const scroll = document.createElement("div");
  scroll.className = "legal-scroll";
  scroll.tabIndex = 0;

  const article = document.createElement("article");
  article.className = "legal-body";
  article.innerHTML = '<p class="legal-body__loading">Cargando…</p>';

  scroll.appendChild(article);
  chrome.append(header, scroll, topFab);
  scene.append(chrome);
  if (getWorldLayers() && !scene.contains(getWorldLayers())) {
    scene.insertBefore(getWorldLayers(), chrome);
  }
  app.appendChild(scene);

  document.body.classList.add("is-legal-active");
  document.body.classList.remove("is-loader-active");

  let destroyed = false;
  let backing = false;
  /** @type {Promise<void>} */
  let enterPromise = Promise.resolve();

  if (fromAuth && transition.snapshot?.logo) {
    enterPromise = (async () => {
      await mountWorldLogo(logoWrap, fallback);
      await morphLogoWithBands(scene, logoWrap, transition.snapshot?.logo, true, durationMs);
    })();
  } else {
    setWorldBandLayout(scene, true);
    void mountWorldLogo(logoWrap, fallback);
  }

  void enterPromise.then(() => {
    if (destroyed) return;
    scene.classList.add("is-legal-entered");
    article.style.transition = `opacity ${durationMs}ms ${WORLD_TRANSITION_EASE}`;
    article.style.opacity = "1";
  });

  article.style.opacity = fromAuth ? "0" : "1";

  void (async () => {
    const doc = await fetchLegalDoc(routeSlug);
    if (destroyed) return;
    if (!doc) {
      article.innerHTML = '<p class="legal-body__error">No hemos podido cargar este documento.</p>';
      return;
    }
    article.innerHTML = renderMarkdown(doc.body_markdown);
    scene.setAttribute("aria-label", doc.title);
  })();

  function onScroll() {
    const showTop = scroll.scrollTop > 120;
    topFab.hidden = !showTop;
    topFab.classList.toggle("is-visible", showTop);
  }

  /**
   * Destino aproximado del logo en auth (misma geometría que el brand estático).
   * @param {{ width: number; height: number }} fromLogo
   */
  function measureAuthLogoTargetOnScene(fromLogo) {
    const authW = Math.min(188, Math.round(window.innerWidth * 0.48));
    const authH = Math.max(1, fromLogo.height * (authW / Math.max(fromLogo.width, 1)));
    const probeStack = document.createElement("div");
    probeStack.className = "loader-auth-stack";
    probeStack.setAttribute("aria-hidden", "true");
    probeStack.style.opacity = "0";
    probeStack.style.pointerEvents = "none";
    const probeBrand = document.createElement("div");
    probeBrand.className = "loader-auth-brand is-static";
    const probe = document.createElement("div");
    probe.className = "loader-logo-wrap is-auth-positioned is-ready";
    probe.style.width = `${authW}px`;
    probe.style.height = `${authH}px`;
    probeBrand.appendChild(probe);
    // Espaciadores para imitar eslogan + CTA y subir el logo como en auth real
    const spacer = document.createElement("div");
    spacer.style.width = "1px";
    spacer.style.height = "7.5rem";
    probeStack.append(probeBrand, spacer);
    scene.appendChild(probeStack);
    void scene.offsetWidth;
    const rect = captureRect(probe);
    probeStack.remove();
    if (rect) return rect;
    // Fallback viewport si la sonda falla
    return {
      left: (window.innerWidth - authW) / 2,
      top: Math.max(0, window.innerHeight * 0.5 - authH * 0.5 - 60),
      width: authW,
      height: authH,
    };
  }

  async function onBack() {
    if (backing || destroyed) return;
    backing = true;

    await enterPromise.catch(() => {});

    const logoRect = captureRect(logoWrap);
    article.style.transition = `opacity ${Math.min(280, durationMs)}ms ${WORLD_TRANSITION_EASE}`;
    article.style.opacity = "0";
    backFab.style.opacity = "0";
    topFab.style.opacity = "0";

    const toHint = logoRect ? measureAuthLogoTargetOnScene(logoRect) : null;

    if (logoRect) pinLogoAtRect(logoWrap, logoRect);

    setOrbitLayoutPaused(scene, true);
    try {
      // keepPinned: el morph no debe soltar el logo al layout CSS de legal (salta al handoff).
      await morphLogoWithBands(scene, logoWrap, logoRect, false, durationMs, toHint, {
        keepPinned: true,
      });
    } catch {
      setWorldBandLayout(scene, false);
      if (toHint) pinLogoAtRect(logoWrap, toHint);
    }

    if (destroyed) return;

    const finalRect = toHint ?? captureRect(logoWrap) ?? logoRect;
    if (finalRect) pinLogoAtRect(logoWrap, finalRect);
    document.body.appendChild(logoWrap);
    prepareWorldTransition(
      {
        logo: finalRect,
        logoEl: logoWrap,
        from: "legal",
        spaceBand: 0.48,
        fantasyBand: 0.52,
        bandsAlreadyExpanded: true,
      },
      { to: "auth", resumeAuth: true },
    );
    navigate("/loader");
  }

  function onTop() {
    scroll.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }

  scroll.addEventListener("scroll", onScroll, { passive: true });
  backFab.addEventListener("click", onBack);
  topFab.addEventListener("click", onTop);

  return {
    destroy() {
      destroyed = true;
      document.body.classList.remove("is-legal-active");
      scroll.removeEventListener("scroll", onScroll);
      backFab.removeEventListener("click", onBack);
      topFab.removeEventListener("click", onTop);

      if (isWorldRouteHash()) {
        detachWorldLayers();
        return;
      }

      world.destroy();
      destroyWorldSession();
    },
  };
}

/**
 * Enlaza transición animada en enlaces legales del panel auth.
 * @param {HTMLElement} root
 */
export function bindLegalLinkTransitions(root) {
  root.querySelectorAll('a[href^="#/legal/"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      const href = anchor.getAttribute("href") || "#/legal/terminos";
      const path = href.replace(/^#\/?/, "");
      const logo = document.querySelector(".loader-auth-brand .loader-logo-wrap")
        ?? document.querySelector(".scene-loader .loader-logo-wrap");
      prepareWorldTransition(
        {
          logo: captureRect(logo),
          from: "auth",
          spaceBand: 0.48,
          fantasyBand: 0.52,
        },
        { to: "legal", from: "auth" },
      );
      navigate(`/${path}`);
    });
  });
}
