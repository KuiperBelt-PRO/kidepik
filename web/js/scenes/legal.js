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
  measureAuthBrandLogoTarget,
  measureShellBrandLogoTarget,
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
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=175";
import { getValidSession, signOut } from "../lib/supabase.js";
import { resolveLegalBackNavigation, shouldAnimateLegalEntry, prepareLegalNavigation, registerLegalExitHandler, prepareAuthenticatedLegalExit } from "../lib/legal-navigation.js";
import { normalizeShellPath, shouldCompressWorldBands } from "../lib/world-band-layout.js";
import { initShellUiTheme } from "../lib/shell-theme.js";
import { scheduleShellFrameSync } from "../lib/shell-frame.js";

const SLUG_API = {
  terminos: "terminos",
  privacidad: "privacidad",
};

const TRANSITION_MS = 720;
const TRANSITION_MS_REDUCED = 120;

/** HTML del skeleton de carga (barras + shimmer). */
function renderLegalSkeletonHtml() {
  const line = (widthClass, extra = "") =>
    `<div class="legal-skeleton__line ${widthClass}${extra ? ` ${extra}` : ""}" aria-hidden="true"></div>`;

  return `
    <div class="legal-body__skeleton" role="status" aria-live="polite" aria-label="Cargando documento">
      ${line("legal-skeleton__line--title")}
      ${line("legal-skeleton__line--heading")}
      <div class="legal-skeleton__block">
        ${line("legal-skeleton__line--full")}
        ${line("legal-skeleton__line--wide")}
        ${line("legal-skeleton__line--medium")}
        ${line("legal-skeleton__line--full")}
        ${line("legal-skeleton__line--narrow")}
      </div>
      ${line("legal-skeleton__line--heading legal-skeleton__line--short")}
      <div class="legal-skeleton__block">
        ${line("legal-skeleton__line--wide")}
        ${line("legal-skeleton__line--medium")}
        ${line("legal-skeleton__line--full")}
        ${line("legal-skeleton__line--narrow")}
      </div>
    </div>
  `;
}

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

const LEGAL_FETCH_TIMEOUT_MS = 5_000;
const LEGAL_FETCH_BASE_BACKOFF_MS = 400;
const LEGAL_FETCH_MAX_BACKOFF_MS = 8_000;

/**
 * @param {AbortSignal | undefined} signal
 * @param {number} attempt
 * @returns {Promise<void>}
 */
function waitLegalFetchBackoff(signal, attempt) {
  const delay = Math.min(LEGAL_FETCH_MAX_BACKOFF_MS, LEGAL_FETCH_BASE_BACKOFF_MS * (2 ** attempt));
  return new Promise((resolve) => {
    const wait = setTimeout(resolve, delay);
    signal?.addEventListener("abort", () => {
      clearTimeout(wait);
      resolve(undefined);
    }, { once: true });
  });
}

/**
 * @param {string} routeSlug
 * @param {{ signal?: AbortSignal; retries?: number }} [options]
 * @returns {Promise<{ title: string; body_markdown: string } | null>}
 */
async function fetchLegalDoc(routeSlug, options = {}) {
  const apiSlug = apiSlugForRoute(routeSlug);
  if (!apiSlug) return null;

  const { signal, retries = 3 } = options;
  const url = `${config.apiUrl}/legal/${apiSlug}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LEGAL_FETCH_TIMEOUT_MS);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener("abort", onParentAbort);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.title || !data?.body_markdown) continue;
      return data;
    } catch {
      if (signal?.aborted) return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onParentAbort);
    }

    if (attempt < retries - 1) {
      await waitLegalFetchBackoff(signal, attempt);
    }
  }

  return null;
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
  const animateEntry = shouldAnimateLegalEntry(transition);
  const fromCompressed = transition.snapshot?.fromBandsCompressed === true;
  const bandNeedsAnim = animateEntry && !fromCompressed;

  const scene = document.createElement("div");
  scene.className = "scene scene-legal scene-world is-reveal-bg is-reveal-fantasy is-reveal-space";
  scene.dataset.legalSlug = routeSlug;
  if (bandNeedsAnim) scene.classList.add("is-orbit-layout-paused");
  // Compacto→compacto (p. ej. account→privacidad): partir ya comprimido, sin salto expand→compress.
  // Solo expandido→comprimido parte en loader para poder animar.
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

  let destroyed = false;
  let backing = false;
  let hasSession = false;
  let loadSeq = 0;
  const loadAbort = new AbortController();
  /** @type {Promise<void>} */
  let enterPromise = Promise.resolve();

  /** @type {(() => void) | null} */
  let unregisterLegalExit = null;

  /**
   * @param {string} targetPath
   * @returns {{ lineSci: string; lineFantasy: string }}
   */
  function shellWelcomeLinesForPath(targetPath) {
    const route = targetPath.replace(/^#\/?/, "").replace(/^\//, "").split("/")[0] || "home";
    if (route === "account") {
      return {
        lineSci: "Tu cuenta",
        lineFantasy: "gestión del viaje (próximamente)",
      };
    }
    return {
      lineSci: "Hola, explorador,",
      lineFantasy: "bienvenido a tu viaje épico",
    };
  }

  async function animateAuthenticatedExit(targetPath) {
    await enterPromise.catch(() => {});

    article.style.transition = `opacity ${Math.min(280, durationMs)}ms ${WORLD_TRANSITION_EASE}`;
    article.style.opacity = "0";

    const logoRect = captureRect(logoWrap);
    const targetRoute = normalizeShellPath(targetPath);
    const targetCompressed = shouldCompressWorldBands(targetRoute);

    if (logoRect) pinLogoAtRect(logoWrap, logoRect);

    // Compacto → compacto (p. ej. privacidad → cuenta): no tocar bandas.
    // Solo se expanden al volver a home.
    if (targetCompressed) {
      setWorldBandLayout(scene, true);
      if (logoRect) {
        document.body.appendChild(logoWrap);
      }
      syncWorldSessionFromDom(scene);
      document.body.classList.remove("is-legal-active");
      prepareAuthenticatedLegalExit(targetPath, {
        logo: logoRect,
        logoEl: logoWrap,
        bandsAlreadyExpanded: false,
        fromBandsCompressed: true,
      });
      navigate(targetPath);
      return;
    }

    const welcomeLines = shellWelcomeLinesForPath(targetPath);
    const toHint = logoRect ? measureShellBrandLogoTarget(logoRect, welcomeLines) : null;

    setOrbitLayoutPaused(scene, true);
    try {
      if (logoRect && toHint) {
        await morphLogoWithBands(scene, logoWrap, logoRect, false, durationMs, toHint, {
          keepPinned: true,
        });
      } else {
        await animateWorldBands(scene, false, durationMs);
      }
    } catch {
      setWorldBandLayout(scene, false);
      if (toHint) pinLogoAtRect(logoWrap, toHint);
    }

    if (destroyed) return;

    const finalRect = toHint ?? captureRect(logoWrap) ?? logoRect;
    if (finalRect) pinLogoAtRect(logoWrap, finalRect);
    document.body.appendChild(logoWrap);

    syncWorldSessionFromDom(scene);
    document.body.classList.remove("is-legal-active");
    prepareAuthenticatedLegalExit(targetPath, {
      logo: finalRect,
      logoEl: logoWrap,
      bandsAlreadyExpanded: true,
      fromBandsCompressed: false,
    });
    navigate(targetPath);
  }

  unregisterLegalExit = registerLegalExitHandler(async (targetPath) => {
    if (backing || destroyed) return;
    backing = true;
    if (!hasSession) {
      navigate(targetPath);
      return;
    }
    await animateAuthenticatedExit(targetPath);
  });

  void (async () => {
    const session = await getValidSession();
    if (destroyed) return;
    hasSession = Boolean(session);
    if (session) {
      scene.classList.add("is-legal-authenticated");
      backFab.hidden = true;
      topFab.hidden = true;
      initShellUiTheme();
      ensureAppShell({
        async onSignOut() {
          destroyAppShell();
          await signOut();
          navigate("/loader");
        },
      });
      scheduleShellFrameSync();
    } else {
      destroyAppShell();
    }
  })();

  if (animateEntry && transition.snapshot?.logo) {
    enterPromise = (async () => {
      await mountWorldLogo(logoWrap, fallback);
      if (fromCompressed) {
        // Origen ya compacto: solo morph del logo, sin tocar bandas.
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

  /** Ancla ramps de mask al borde superior del logo y al borde del footer fantasía. */
  function syncScrollFadeMask() {
    if (destroyed) return;
    const fantasy = scene.querySelector(".loader-layer--fantasy-scene")
      ?? scene.querySelector(".loader-layer--fantasy");
    if (!fantasy) return;

    const scrollRect = scroll.getBoundingClientRect();
    const logoRect = logoWrap.getBoundingClientRect();

    /* Port alineado al logo: opacidad 0 en su borde superior (sin clip duro de la banda sci-fi). */
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

    const backTarget = resolveLegalBackNavigation(hasSession);
    if (backTarget.mode === "authenticated-home") {
      await animateAuthenticatedExit(backTarget.path);
      return;
    }

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
    /* Mantener overflow bloqueado antes de destruir la escena legal (evita flash de scrollbar). */
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
      unregisterLegalExit?.();
      unregisterLegalExit = null;
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
