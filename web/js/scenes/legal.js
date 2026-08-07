/**
 * Escena de documentos legales (Términos / Privacidad).
 * @module legal
 */

import { renderMarkdown } from "../lib/markdown.js";
import { navigate } from "../lib/router.js";
import { renderGlassSkeletonHtml } from "../components/glass-controls.js?v=221";
import { mountLoaderChrome } from "../components/loader-chrome.js?v=236";
import { mountSectionFrame } from "../components/section-frame.js?v=236";
import { defaultLegalTitle, fetchLegalDoc, mountLegalPanel } from "../components/legal-panel.js?v=256";
import {
  animateWorldBands,
  captureRect,
  consumeWorldTransition,
  measureAuthBrandLogoTarget,
  morphLogoBetweenRects,
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
  parkWorldLayersForHandoff,
  registerWorldSession,
  syncWorldSessionFromDom,
} from "../lib/world-session.js";
import {
  createWorldLayersDom,
  createWorldLogoDom,
  mountWorldLayers,
  mountWorldLogo,
} from "../components/world-layers.js";
import {
  renderWorldArrowFabSvgInner,
} from "../components/loader-world-arrows.js";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=186";
import { getValidSession, signOut } from "../lib/supabase.js";
import {
  resolveLegalBackNavigation,
  shouldAnimateLegalEntry,
  prepareLegalNavigation,
} from "../lib/legal-navigation.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=236";
import { initShellUiTheme } from "../lib/shell-theme.js";

const TRANSITION_MS = 720;
const TRANSITION_MS_REDUCED = 120;

/** HTML del skeleton de carga (barras + shimmer). */
function renderLegalSkeletonHtml() {
  return renderGlassSkeletonHtml({ preset: "document", ariaLabel: "Cargando documento" });
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

  const theme = kind === "back" ? "sci-fi" : "fantasy";
  const direction = kind === "back" ? "left" : "up";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "legal-fab__svg");
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("aria-hidden", "true");

  svg.innerHTML = renderWorldArrowFabSvgInner({ theme, direction, viewSize: 40 });

  btn.appendChild(svg);
  return btn;
}

/**
 * Legal autenticado: marco glass homogéneo con el resto de secciones.
 * @param {HTMLElement} app
 * @param {{ slug: string }} params
 * @returns {{ destroy: (options?: object) => void }}
 */
function renderLegalAuthenticated(app, { slug }) {
  const routeSlug = slug || "terminos";

  /** @type {{ destroy: (o?: object) => void; sectionHost?: HTMLElement } | null} */
  let chromeHandle = null;
  /** @type {{
   *   destroy: () => Promise<void>;
   *   contentEl?: HTMLElement;
   *   logoMountEl?: HTMLElement;
   *   setTitle?: (text: string) => void;
   *   syncLogoSkeleton?: (logoWrap?: HTMLElement | null) => void;
   * } | null} */
  let frameHandle = null;
  /** @type {{ destroy: () => void } | null} */
  let panelHandle = null;
  /** @type {HTMLElement | null} */
  let sceneEl = null;
  let cancelled = false;

  async function doSignOut() {
    destroyAppShell();
    await signOut();
    navigate("/loader");
  }

  void (async () => {
    const session = await getValidSession();
    if (cancelled) return;
    if (!session) {
      destroyAppShell();
      navigate("/loader");
      return;
    }

    initShellUiTheme();
    ensureAppShell({ onSignOut: doSignOut });

    chromeHandle = mountLoaderChrome(app, { compactSection: true });
    sceneEl = app.querySelector(".scene-loader");
    const host = chromeHandle.sectionHost;
    if (!(host instanceof HTMLElement) || !(sceneEl instanceof HTMLElement)) {
      console.warn("legal: missing section host or scene");
      return;
    }

    const title = defaultLegalTitle(routeSlug);
    frameHandle = mountSectionFrame(host, { title, ariaLabel: title });
    panelHandle = mountLegalPanel(frameHandle.contentEl, {
      routeSlug,
      onLoaded(doc) {
        frameHandle?.setTitle?.(doc.title);
      },
    });

    await applySectionEnter({
      scene: sceneEl,
      logoMount: frameHandle.logoMountEl,
      onLogoSettled: (logoWrap) => frameHandle?.syncLogoSkeleton?.(logoWrap),
    });
    frameHandle.syncLogoSkeleton?.();
  })();

  return {
    destroy(options = {}) {
      cancelled = true;
      panelHandle?.destroy();
      panelHandle = null;
      void frameHandle?.destroy();
      frameHandle = null;
      chromeHandle?.destroy(options);
      chromeHandle = null;
      sceneEl = null;
    },
  };
}

/**
 * Legal anónimo (pre-login): layout de documento con FABs procedurales.
 * @param {HTMLElement} app
 * @param {{ slug: string }} params
 * @returns {{ destroy: (options?: object) => void }}
 */
function renderLegalAnonymous(app, { slug }) {
  const routeSlug = slug || "terminos";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durationMs = reducedMotion ? TRANSITION_MS_REDUCED : TRANSITION_MS;
  const transition = consumeWorldTransition();
  const animateEntry = shouldAnimateLegalEntry(transition);
  const fromCompressed = transition.snapshot?.fromBandsCompressed === true;
  const bandNeedsAnim = animateEntry && !fromCompressed;

  const scene = document.createElement("div");
  scene.className = "scene scene-legal scene-world is-reveal-bg is-reveal-fantasy is-reveal-space";
  scene.dataset.legalSlug = routeSlug;
  if (bandNeedsAnim) scene.classList.add("is-orbit-layout-paused");
  setWorldBandLayout(scene, !bandNeedsAnim);

  const reusedLayers = attachWorldLayersTo(scene);
  /** @type {{ destroy: () => void; getSessionState?: () => object }} */
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
    const sessionState = world.getSessionState?.();
    if (sessionState) {
      registerWorldSession({ ...sessionState, ownerScene: scene });
    }
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

  const scrollPort = document.createElement("div");
  scrollPort.className = "legal-scroll-port";

  const scroll = document.createElement("div");
  scroll.className = "legal-scroll";
  scroll.tabIndex = 0;

  const article = document.createElement("article");
  article.className = "legal-body is-loading";
  article.setAttribute("aria-busy", "true");
  article.innerHTML = renderLegalSkeletonHtml();

  scroll.appendChild(article);
  scrollPort.appendChild(scroll);
  chrome.append(header, scrollPort, topFab);
  scene.append(chrome);
  if (getWorldLayers() && !scene.contains(getWorldLayers())) {
    scene.insertBefore(getWorldLayers(), chrome);
  }
  app.appendChild(scene);

  document.body.classList.add("is-legal-active");
  document.body.classList.remove("is-loader-active");
  destroyAppShell();

  let destroyed = false;
  let backing = false;
  let loadSeq = 0;
  const loadAbort = new AbortController();
  /** @type {Promise<void>} */
  let enterPromise = Promise.resolve();

  if (animateEntry && transition.snapshot?.logo) {
    enterPromise = (async () => {
      await mountWorldLogo(logoWrap, fallback);
      if (fromCompressed) {
        const fromLogo = transition.snapshot.logo;
        const toLogo = captureRect(logoWrap);
        if (fromLogo && toLogo) {
          pinLogoAtRect(logoWrap, fromLogo);
          await morphLogoBetweenRects(logoWrap, fromLogo, toLogo, durationMs, {
            keepPinned: false,
          });
        }
        setWorldBandLayout(scene, true);
        setOrbitLayoutPaused(scene, false);
      } else {
        await morphLogoWithBands(scene, logoWrap, transition.snapshot?.logo, true, durationMs);
      }
    })();
  } else if (!animateEntry) {
    setWorldBandLayout(scene, true);
    void mountWorldLogo(logoWrap, fallback);
  } else {
    void mountWorldLogo(logoWrap, fallback);
    enterPromise = animateWorldBands(scene, true, durationMs);
  }

  function revealArticle() {
    if (destroyed) return;
    article.style.transition = `opacity ${durationMs}ms ${WORLD_TRANSITION_EASE}`;
    article.style.opacity = "1";
  }

  void enterPromise.then(() => {
    if (destroyed) return;
    scene.classList.add("is-legal-entered");
    revealArticle();
    scheduleScrollFadeMask();
  });

  article.style.opacity = animateEntry ? "0" : "1";

  function showLoadError() {
    article.classList.remove("is-loading");
    article.removeAttribute("aria-busy");
    article.innerHTML = `
      <p class="legal-body__error">No hemos podido cargar este documento.</p>
      <p class="legal-body__error-actions">
        <button type="button" class="legal-body__retry">Reintentar</button>
      </p>
    `;
    article.querySelector(".legal-body__retry")?.addEventListener("click", () => {
      void loadDocument();
    });
  }

  async function loadDocument() {
    const seq = ++loadSeq;
    article.classList.add("is-loading");
    article.setAttribute("aria-busy", "true");
    article.innerHTML = renderLegalSkeletonHtml();
    const doc = await fetchLegalDoc(routeSlug, { signal: loadAbort.signal });
    if (destroyed || seq !== loadSeq) return;
    if (!doc) {
      article.classList.remove("is-loading");
      article.removeAttribute("aria-busy");
      showLoadError();
      return;
    }
    article.classList.remove("is-loading");
    article.removeAttribute("aria-busy");
    article.innerHTML = renderMarkdown(doc.body_markdown);
    scene.setAttribute("aria-label", doc.title);
    revealArticle();
    scheduleScrollFadeMask();
  }

  void loadDocument();

  function syncScrollFadeMask() {
    if (destroyed) return;
    const fantasy = scene.querySelector(".loader-layer--fantasy-scene")
      ?? scene.querySelector(".loader-layer--fantasy");
    if (!fantasy) return;

    const scrollRect = scroll.getBoundingClientRect();
    const logoRect = logoWrap.getBoundingClientRect();
    const topStart = Math.min(0, logoRect.top - scrollRect.top);
    const bottomEnd = scrollRect.height;

    scroll.style.setProperty("--legal-fade-mask-top-start", `${topStart}px`);
    scroll.style.setProperty("--legal-fade-mask-bottom-end", `${bottomEnd}px`);
  }

  let fadeMaskFrame = 0;
  function scheduleScrollFadeMask() {
    if (fadeMaskFrame) cancelAnimationFrame(fadeMaskFrame);
    fadeMaskFrame = requestAnimationFrame(() => {
      fadeMaskFrame = 0;
      syncScrollFadeMask();
    });
  }

  const fadeMaskObserver = new ResizeObserver(() => scheduleScrollFadeMask());
  fadeMaskObserver.observe(scene);
  fadeMaskObserver.observe(scroll);
  fadeMaskObserver.observe(logoWrap);
  window.addEventListener("resize", scheduleScrollFadeMask, { passive: true });
  scheduleScrollFadeMask();

  function onScroll() {
    const showTop = scroll.scrollTop > 120;
    topFab.hidden = !showTop;
    topFab.classList.toggle("is-visible", showTop);
  }

  async function onBack() {
    if (backing || destroyed) return;
    backing = true;

    const backTarget = resolveLegalBackNavigation(false);
    await enterPromise.catch(() => {});

    const logoRect = captureRect(logoWrap);
    article.style.transition = `opacity ${Math.min(280, durationMs)}ms ${WORLD_TRANSITION_EASE}`;
    article.style.opacity = "0";
    backFab.style.opacity = "0";
    topFab.style.opacity = "0";

    const toHint = logoRect ? measureAuthBrandLogoTarget(scene, logoRect) : null;

    if (logoRect) pinLogoAtRect(logoWrap, logoRect);

    setOrbitLayoutPaused(scene, true);
    try {
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
    document.body.classList.add("is-loader-active");
    document.body.classList.remove("is-legal-active");
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
    navigate(backTarget.path);
  }

  function onTop() {
    scroll.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }

  scroll.addEventListener("scroll", onScroll, { passive: true });
  backFab.addEventListener("click", onBack);
  topFab.addEventListener("click", onTop);

  return {
    destroy(options = {}) {
      destroyed = true;
      loadSeq += 1;
      loadAbort.abort();
      document.body.classList.remove("is-legal-active");
      fadeMaskObserver.disconnect();
      window.removeEventListener("resize", scheduleScrollFadeMask);
      if (fadeMaskFrame) cancelAnimationFrame(fadeMaskFrame);
      scroll.removeEventListener("scroll", onScroll);
      backFab.removeEventListener("click", onBack);
      topFab.removeEventListener("click", onTop);

      if (isWorldRouteHash()) {
        syncWorldSessionFromDom(scene);
        if (options.worldHandoff) {
          parkWorldLayersForHandoff();
        } else {
          detachWorldLayers();
        }
        return;
      }

      world.destroy();
      destroyWorldSession();
    },
  };
}

/**
 * @param {{ slug: string }} params
 * @returns {{ destroy: (options?: object) => void }}
 */
export function renderLegal({ slug }) {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  let cancelled = false;
  /** @type {(options?: object) => void} */
  let innerDestroy = () => {};

  void (async () => {
    const session = await getValidSession();
    if (cancelled) return;
    const handle = session
      ? renderLegalAuthenticated(app, { slug })
      : renderLegalAnonymous(app, { slug });
    innerDestroy = handle.destroy.bind(handle);
  })();

  return {
    destroy(options = {}) {
      cancelled = true;
      innerDestroy(options);
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
      prepareLegalNavigation("auth");
      navigate(`/${path}`);
    });
  });
}
