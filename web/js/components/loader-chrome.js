import { assetUrl } from "../lib/assets.manifest.js";
import { mountFantasyTerrainLayer, measureFantasyTerrainHeightPx } from "./loader-fantasy-terrain.js";
import { mountFantasyBackdropLayer } from "./loader-fantasy-backdrop.js";
import { mountFantasyScene } from "./loader-fantasy-scene.js";
import { mountFantasyCelestialLayer } from "./loader-fantasy-celestial.js";
import { mountFantasyCloudsLayer } from "./loader-fantasy-clouds.js";
import { mountMeteorShowerLayer } from "./loader-meteor-shower.js";
import { mountSpaceOrbitLayer } from "./loader-space-orbit.js?v=183";
import { startLoaderRevealSequence } from "./loader-reveal-sequence.js";
import { mountLoaderLogoMaskSync, syncLoaderLogoMask } from "./loader-logo-mask.js";
import { mountLoaderGate } from "./loader-gate.js?v=162";
import { mountAuthPanel } from "./auth-panel.js?v=162";
import { mountStaticAuthBrand } from "./loader-auth-morph.js?v=162";
import { mountHomeWelcomePanel } from "./home-welcome-panel.js?v=162";
import {
  getLoaderQueryParams,
  mountOptionalImage,
  parseWorldLayerQuery,
  probeImage,
} from "./loader-world-utils.js";
import {
  animateWorldBands,
  captureRect,
  clearLogoPinStyles,
  consumeWorldTransition,
  morphLogoBetweenRects,
  morphLogoWithBands,
  peekWorldTransition,
  pinLogoAtRect,
  setOrbitLayoutPaused,
  setWorldBandLayout,
} from "../lib/world-transition.js";
import {
  attachWorldLayersTo,
  destroyWorldSession,
  detachWorldLayers,
  getWorldLayers,
  getWorldSession,
  isWorldRouteHash,
  parkWorldLayersForHandoff,
  registerWorldSession,
  worldLayersHaveFantasyMounted,
  worldLayersHaveSpaceMounted,
} from "../lib/world-session.js";
import { scheduleShellFrameSync } from "../lib/shell-frame.js";
import { mountWorldLogo } from "./world-layers.js";
import { bindLegalLinkTransitions } from "../scenes/legal.js?v=183";
import { shouldResumeShellTransition } from "../lib/legal-navigation.js";
import { syncLogoRevealState } from "../lib/logo-reveal.js";

/**
 * @param {HTMLElement} logoWrap
 * @returns {boolean}
 */
function revealLoadedWorldLogo(logoWrap) {
  const logoImg = logoWrap.querySelector(".loader-logo");
  const fallback = logoWrap.querySelector(".loader-logo-fallback");
  if (!(logoImg instanceof HTMLImageElement)) return false;
  if (!logoImg.getAttribute("src")) return false;
  // src presente pero imagen rota / aún no decodificada → no revelar como ok
  if (!logoImg.complete || logoImg.naturalWidth <= 0) return false;

  syncLogoRevealState(logoWrap, "ready");
  if (fallback instanceof HTMLElement) fallback.hidden = true;
  return true;
}

export const LOADER_SLOGAN = "Dos mundos. Un viaje épico.";

const DURATION_MS = 4500;
const DURATION_DEMO_MS = 800;
const RING_RADIUS = 50;
const RING_STROKE = 2.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_TEXT_SCI = "DOS MUNDOS";
const RING_TEXT_FANTASY = "UN VIAJE ÉPICO";
const RING_TEXT_ARC = Math.PI * RING_RADIUS;
const RING_TEXT_SCI_LENGTH = Math.round(RING_TEXT_ARC * 0.88);
/** Fracción del arco superior donde empieza «DOS MUNDOS» (textPath centrado al 50 %). */
const RING_TEXT_SCI_START_FRACTION = 0.5 - RING_TEXT_SCI_LENGTH / 2 / RING_TEXT_ARC;
/** Grados SVG (0° = 3 h, sentido horario) donde arrancan progreso y revelado del texto. */
const RING_TEXT_REVEAL_LEAD_DEG = 6;
const RING_REVEAL_START_DEG =
  180 + RING_TEXT_SCI_START_FRACTION * 180 - RING_TEXT_REVEAL_LEAD_DEG;

/**
 * Anillo base de progreso (fijo, no gira).
 * @returns {{ svg: SVGElement; progress: Element | null }}
 */
function createLoaderRingBaseSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("class", "loader-ring__svg loader-ring__svg--base");
  svg.setAttribute("aria-hidden", "true");

  svg.innerHTML = `
    <circle
      class="loader-ring__track"
      cx="60"
      cy="60"
      r="${RING_RADIUS}"
      fill="none"
      stroke="currentColor"
      stroke-width="${RING_STROKE}"
    />
    <circle
      class="loader-ring__progress"
      cx="60"
      cy="60"
      r="${RING_RADIUS}"
      fill="none"
      stroke="currentColor"
      stroke-width="${RING_STROKE}"
      stroke-linecap="round"
      transform="rotate(${RING_REVEAL_START_DEG} 60 60)"
      stroke-dasharray="${RING_CIRCUMFERENCE}"
      stroke-dashoffset="${RING_CIRCUMFERENCE}"
    />
  `;

  return { svg, progress: svg.querySelector(".loader-ring__progress") };
}

/**
 * Letras sobre el anillo — sci-fi arriba, fantasía abajo.
 * @returns {{ svg: SVGElement; reveal: Element | null }}
 */
function createLoaderRingTextSvg() {
  const uid = Math.random().toString(36).slice(2, 9);
  const pathSciId = `loader-path-sci-${uid}`;
  const pathFantasyId = `loader-path-fantasy-${uid}`;
  const maskId = `loader-text-mask-${uid}`;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("class", "loader-ring__svg loader-ring__svg--text");
  svg.setAttribute("aria-hidden", "true");

  svg.innerHTML = `
    <defs>
      <path
        id="${pathSciId}"
        d="M 6 60 A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 114 60"
        fill="none"
      />
      <path
        id="${pathFantasyId}"
        d="M 114 60 A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 6 60"
        fill="none"
      />
      <mask id="${maskId}">
        <circle
          class="loader-ring__reveal"
          cx="60"
          cy="60"
          r="${RING_RADIUS}"
          fill="none"
          stroke="white"
          stroke-width="20"
          stroke-linecap="butt"
          transform="rotate(${RING_REVEAL_START_DEG} 60 60)"
          stroke-dasharray="${RING_CIRCUMFERENCE}"
          stroke-dashoffset="${RING_CIRCUMFERENCE}"
        />
      </mask>
    </defs>
    <g class="loader-ring__labels" mask="url(#${maskId})">
      <text
        class="loader-ring__text loader-ring__text--sci"
        fill="currentColor"
        font-family="Bruno Ace, Orbitron, sans-serif"
        font-size="5.2"
        font-weight="600"
        letter-spacing="0.08em"
      >
        <textPath
          href="#${pathSciId}"
          startOffset="50%"
          text-anchor="middle"
          lengthAdjust="spacing"
          textLength="${RING_TEXT_SCI_LENGTH}"
        >
          ${RING_TEXT_SCI}
        </textPath>
      </text>
      <text
        class="loader-ring__text loader-ring__text--fantasy"
        fill="currentColor"
        font-family="Uncial Antiqua, Cinzel, Georgia, serif"
        font-size="5.8"
        font-weight="700"
        letter-spacing="0.06em"
      >
        <textPath
          href="#${pathFantasyId}"
          startOffset="50%"
          text-anchor="middle"
          side="right"
          lengthAdjust="spacing"
          textLength="${Math.round(RING_TEXT_ARC * 0.9)}"
        >
          ${RING_TEXT_FANTASY}
        </textPath>
      </text>
    </g>
  `;

  return { svg, reveal: svg.querySelector(".loader-ring__reveal") };
}

/**
 * Monta la escena loader (fondo dual + logo ambigrama + anillo de carga).
 * @param {HTMLElement} app
 * @param {{
 *   pingHealth?: () => Promise<boolean>;
 *   welcomeHome?: { displayName: string; lineSci?: string; lineFantasy?: string; onSignOut?: () => void | Promise<void> };
 *   statusMessage?: string;
 *   compactSection?: boolean;
 * }} [options]
 * @returns {{ destroy: () => void; sectionHost?: HTMLElement }}
 */
export function mountLoaderChrome(app, { pingHealth, welcomeHome, statusMessage, compactSection } = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pendingResume = peekWorldTransition();
  const resumingAuth = pendingResume.intent?.resumeAuth === true;
  const bandsAlreadyExpanded = pendingResume.snapshot?.bandsAlreadyExpanded === true;
  const pendingFromCompressed =
    typeof pendingResume.snapshot?.fromBandsCompressed === "boolean"
      ? pendingResume.snapshot.fromBandsCompressed
      : null;
  const pendingBandTransition = pendingResume.intent?.bandTransition === true
    && typeof pendingResume.snapshot?.fromBandsCompressed === "boolean";

  const scene = document.createElement("div");
  scene.className = "scene scene-loader scene-world";
  scene.tabIndex = 0;
  scene.setAttribute("role", "progressbar");
  scene.setAttribute("aria-valuemin", "0");
  scene.setAttribute("aria-valuemax", "100");
  scene.setAttribute("aria-valuenow", "0");
  scene.setAttribute("aria-label", `Cargando KidepiK — ${LOADER_SLOGAN}`);

  // Bandas ANTES de attach: si no, las capas parqueadas heredan el 48 % por defecto
  // y la animación compress↔expand no arranca (48%→48% = sin transición).
  if (resumingAuth) {
    setWorldBandLayout(scene, !bandsAlreadyExpanded);
    setOrbitLayoutPaused(scene, true);
  } else if (welcomeHome) {
    const startCompressed = pendingFromCompressed === true;
    setWorldBandLayout(scene, startCompressed);
    if (startCompressed || pendingBandTransition) {
      setOrbitLayoutPaused(scene, true);
    }
  } else if (compactSection) {
    const startCompressed = pendingFromCompressed === true
      ? true
      : pendingFromCompressed === false
        ? false
        : true;
    setWorldBandLayout(scene, startCompressed);
    if (!startCompressed || pendingBandTransition) {
      setOrbitLayoutPaused(scene, true);
    }
  }

  const chrome = document.createElement("div");
  chrome.className = "loader-chrome";

  const reusedWorldLayers = attachWorldLayersTo(scene);
  /** @type {HTMLDivElement} */
  let layers;
  /** @type {HTMLElement} */
  let bg;
  /** @type {HTMLElement} */
  let accentFantasy;
  /** @type {HTMLElement} */
  let accentSpace;

  if (reusedWorldLayers) {
    const existing = getWorldLayers();
    if (!existing) {
      throw new Error("world session layers missing after attach");
    }
    layers = existing;
    const bgEl = layers.querySelector(".loader-layer--bg");
    const fantasyEl = layers.querySelector(".loader-layer--fantasy");
    const spaceEl = layers.querySelector(".loader-layer--space");
    bg = bgEl instanceof HTMLElement ? bgEl : document.createElement("div");
    accentFantasy = fantasyEl instanceof HTMLElement ? fantasyEl : document.createElement("div");
    accentSpace = spaceEl instanceof HTMLElement ? spaceEl : document.createElement("div");
  } else {
    layers = document.createElement("div");
    layers.className = "loader-layers";

    bg = document.createElement("div");
    bg.className = "loader-layer loader-layer--bg";

    const bgAttenuate = document.createElement("div");
    bgAttenuate.className = "loader-bg-attenuate";
    bgAttenuate.setAttribute("aria-hidden", "true");
    bg.appendChild(bgAttenuate);

    accentFantasy = document.createElement("div");
    accentFantasy.className = "loader-layer loader-layer--accent loader-layer--fantasy";

    accentSpace = document.createElement("div");
    accentSpace.className = "loader-layer loader-layer--accent loader-layer--space";

    layers.append(bg, accentFantasy, accentSpace);
  }

  const focal = document.createElement("div");
  focal.className = "loader-focal";

  const ringSpin = document.createElement("div");
  ringSpin.className = "loader-ring-spin";

  const ringWrap = document.createElement("div");
  ringWrap.className = "loader-ring";

  const ringBase = document.createElement("div");
  ringBase.className = "loader-ring-base";

  const { svg: baseSvg, progress: ringProgress } = createLoaderRingBaseSvg();

  const { svg: textSvg, reveal: ringReveal } = createLoaderRingTextSvg();

  const logoWrap = document.createElement("div");
  logoWrap.className = "loader-logo-wrap";

  const logoImg = document.createElement("img");
  logoImg.className = "loader-logo";
  logoImg.alt = "KidepiK";
  logoImg.hidden = true;

  const logoFallback = document.createElement("p");
  logoFallback.className = "loader-logo-fallback";
  logoFallback.textContent = "KidepiK";
  logoFallback.hidden = true;

  logoWrap.append(logoImg, logoFallback);
  ringBase.appendChild(baseSvg);
  ringSpin.appendChild(textSvg);
  ringWrap.append(ringBase, ringSpin);
  focal.append(ringWrap, logoWrap);

  chrome.appendChild(focal);
  scene.append(chrome);
  scene.insertBefore(layers, chrome);
  app.appendChild(scene);
  document.body.classList.add("is-loader-active");
  scheduleShellFrameSync();

  const teardownLogoMaskSync = mountLoaderLogoMaskSync(scene, focal);

  const loaderQuery = getLoaderQueryParams();
  const worldOpts = parseWorldLayerQuery(loaderQuery);
  const {
    gateDemo,
    meteorDemo,
    cloudDemo,
    celestialDemo,
    backdropKind,
    fantasyDev,
    fantasyFaction,
    fantasySeed,
    fantasyFormation,
    fxIntensity,
    fxEnabled,
  } = worldOpts;
  const progressDurationMs = gateDemo ? DURATION_DEMO_MS : DURATION_MS;

  /** @type {{ destroy: () => void } | null} */
  let spaceOrbitTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let meteorTeardown = null;
  /** @type {{ destroy: () => void; kind?: string; layers?: unknown } | null} */
  let fantasyBackdropTeardown = null;
  /** @type {{ destroy: () => void; profile?: import('./loader-fantasy-terrain.js').TerrainProfile } | null} */
  let fantasyTerrainTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let fantasyCloudsTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let fantasyCelestialTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let fantasySceneTeardown = null;
  let fantasyLayersMounted = reusedWorldLayers;
  let spaceLayersMounted = reusedWorldLayers;

  if (reusedWorldLayers) {
    const session = getWorldSession();
    if (session) {
      spaceOrbitTeardown = session.spaceOrbitTeardown;
      meteorTeardown = session.meteorTeardown;
      fantasyBackdropTeardown = session.fantasyBackdropTeardown;
      fantasyTerrainTeardown = session.fantasyTerrainTeardown;
      fantasyCloudsTeardown = session.fantasyCloudsTeardown;
      fantasyCelestialTeardown = session.fantasyCelestialTeardown;
      fantasySceneTeardown = session.fantasySceneTeardown;
      fantasyLayersMounted = session.fantasyLayersMounted;
      spaceLayersMounted = session.spaceLayersMounted;
    }
  }

  const syncWorldSessionState = () => {
    if (worldLayersHaveFantasyMounted(layers)) fantasyLayersMounted = true;
    if (worldLayersHaveSpaceMounted(layers)) spaceLayersMounted = true;
    if (!fantasyLayersMounted || !spaceLayersMounted) return;
    registerWorldSession({
      layers,
      ownerScene: scene,
      teardownLogoMaskSync,
      spaceOrbitTeardown,
      meteorTeardown,
      fantasyBackdropTeardown,
      fantasyTerrainTeardown,
      fantasyCloudsTeardown,
      fantasyCelestialTeardown,
      fantasySceneTeardown,
      fantasyLayersMounted,
      spaceLayersMounted,
    });
  };

  function adoptFantasyFromSession() {
    if (!worldLayersHaveFantasyMounted(layers)) return false;
    const existing = getWorldSession();
    if (existing) {
      fantasyBackdropTeardown = existing.fantasyBackdropTeardown;
      fantasyTerrainTeardown = existing.fantasyTerrainTeardown;
      fantasyCloudsTeardown = existing.fantasyCloudsTeardown;
      fantasyCelestialTeardown = existing.fantasyCelestialTeardown;
      fantasySceneTeardown = existing.fantasySceneTeardown;
    }
    fantasyLayersMounted = true;
    syncWorldSessionState();
    return true;
  }

  function adoptSpaceFromSession() {
    if (!worldLayersHaveSpaceMounted(layers)) return false;
    const existing = getWorldSession();
    if (existing) {
      spaceOrbitTeardown = existing.spaceOrbitTeardown;
      meteorTeardown = existing.meteorTeardown;
    }
    spaceLayersMounted = true;
    syncWorldSessionState();
    return true;
  }

  function mountFantasyWorldLayers() {
    if (fantasyLayersMounted || adoptFantasyFromSession()) return;
    fantasyLayersMounted = true;
    fantasyBackdropTeardown = mountFantasyBackdropLayer(layers, { kind: backdropKind });
    fantasyTerrainTeardown = mountFantasyTerrainLayer(layers);
    const terrainProfile = fantasyTerrainTeardown.profile;
    fantasyCloudsTeardown = mountFantasyCloudsLayer(layers, { reducedMotion, demoFast: cloudDemo });
    fantasyCelestialTeardown = mountFantasyCelestialLayer(layers, { reducedMotion, demoFast: celestialDemo });
    const fantasyTerrainH = measureFantasyTerrainHeightPx(layers);
    fantasySceneTeardown = mountFantasyScene(layers, {
      reducedMotion,
      terrainHeightPx: fantasyTerrainH,
      terrainProfile,
      devKind: fantasyDev,
      devFaction: fantasyFaction,
      devSeed: fantasySeed,
      devFormation: fantasyFormation,
      fxEnabled,
      fxIntensity,
    });
    syncLoaderLogoMask(scene, focal);
    syncWorldSessionState();
  }

  function mountSpaceWorldLayers() {
    if (spaceLayersMounted || adoptSpaceFromSession()) return;
    spaceLayersMounted = true;
    spaceOrbitTeardown = mountSpaceOrbitLayer(layers, { reducedMotion });
    meteorTeardown = mountMeteorShowerLayer(layers, { reducedMotion, demoBurst: meteorDemo });
    syncLoaderLogoMask(scene, focal);
    syncWorldSessionState();
  }

  let destroyed = false;
  let progress = 0;
  let rafId = 0;
  let startTime = 0;
  let orbitActive = false;
  let progressStarted = false;
  let logoRevealStageReached = false;
  let logoAssetReady = false;
  /** @type {{ destroy: () => void } | null} */
  let homeWelcomePanel = null;

  const gate = mountLoaderGate({
    scene,
    chrome,
    focal,
    ringWrap,
    logoWrap,
    reducedMotion,
    demo: gateDemo,
  });

  const markMissingBg = () => {
    scene.classList.add("is-placeholder-art");
  };

  const revealLogoIfReady = () => {
    if (!logoRevealStageReached || !logoAssetReady) return;
    logoWrap.classList.add("is-ready");
    if (!reducedMotion) {
      logoWrap.classList.add("is-ambi-active");
    }
  };

  const markLogoAssetReady = () => {
    logoAssetReady = true;
    revealLogoIfReady();
  };

  /**
   * Carga el wordmark del chrome (siempre; las capas del mundo sí se reutilizan).
   * @returns {Promise<void>}
   */
  async function ensureChromeLogoLoaded() {
    if (revealLoadedWorldLogo(logoWrap)) {
      markLogoAssetReady();
      return;
    }

    syncLogoRevealState(logoWrap, "pending");

    const logoSrc = assetUrl("loader.logo");
    if (!logoSrc) {
      syncLogoRevealState(logoWrap, "error");
      markLogoAssetReady();
      return;
    }

    const logoOk = await probeImage(logoSrc);
    if (!logoOk) {
      syncLogoRevealState(logoWrap, "error");
      markLogoAssetReady();
      return;
    }

    const reveal = () => {
      syncLogoRevealState(logoWrap, "ready");
      markLogoAssetReady();
    };

    logoImg.addEventListener("load", reveal, { once: true });
    logoImg.addEventListener(
      "error",
      () => {
        syncLogoRevealState(logoWrap, "error");
        markLogoAssetReady();
      },
      { once: true },
    );
    logoImg.src = logoSrc;
    // Caché: a veces no dispara `load`
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      reveal();
    }
  }

  void (async () => {
    if (reusedWorldLayers) {
      if (!scene.classList.contains("is-bg-ready")) {
        const hasBgImg = bg.querySelector(".loader-layer__img");
        if (hasBgImg) scene.classList.add("is-bg-ready");
      }
    } else {
      const bgOk = await mountOptionalImage(bg, "loader.bg.plain", {
        fit: "cover",
        onLoad: () => scene.classList.add("is-bg-ready"),
      });
      if (!bgOk) markMissingBg();
    }

    await ensureChromeLogoLoaded();
  })();

  const revealSequence = startLoaderRevealSequence(scene, {
    reducedMotion,
    onStage(stage) {
      if (welcomeHome || statusMessage) return;
      if (stage === "logo") {
        logoRevealStageReached = true;
        revealLogoIfReady();
      }
      if (stage === "ring") {
        startProgressLoop();
      }
      if (stage === "fantasy") {
        mountFantasyWorldLayers();
      }
      if (stage === "space") {
        mountSpaceWorldLayers();
      }
    },
  });

  if (welcomeHome || statusMessage || compactSection) {
    revealSequence.destroy();
    gate.destroy();

    const shellTransition = welcomeHome
      ? consumeWorldTransition()
      : compactSection
        ? peekWorldTransition()
        : { snapshot: null, intent: null };
    const resumeShell = Boolean(welcomeHome) && shouldResumeShellTransition(shellTransition);
    const bandTransition = shellTransition.intent?.bandTransition === true
      && typeof shellTransition.snapshot?.fromBandsCompressed === "boolean";
    const fromLogo = shellTransition.snapshot?.logo;
    const reusedLogoEl = shellTransition.snapshot?.logoEl;
    const fromPath = shellTransition.snapshot?.from;
    const resumeMs = reducedMotion ? 120 : 720;

    scene.classList.add(
      "is-reveal-bg",
      "is-reveal-fantasy",
      "is-reveal-space",
      "is-reveal-logo",
      "is-reveal-ring",
      "is-auth-idle",
    );
    if (welcomeHome) scene.classList.add("is-home-welcome");
    if (compactSection) scene.classList.add("is-section-compact");
    if (statusMessage) scene.classList.add("is-auth-status");
    scene.classList.remove("is-gate-ready", "is-gate-exiting");
    scene.removeAttribute("role");
    scene.removeAttribute("aria-valuemin");
    scene.removeAttribute("aria-valuemax");
    scene.removeAttribute("aria-valuenow");
    scene.setAttribute(
      "aria-label",
      compactSection
        ? "Sección de gestión KidepiK"
        : welcomeHome
          ? `Bienvenido a KidepiK, ${welcomeHome.displayName}`
          : statusMessage,
    );

    mountFantasyWorldLayers();
    mountSpaceWorldLayers();
    if (resumeShell) {
      setWorldBandLayout(scene, false);
      setOrbitLayoutPaused(scene, true);
    } else if (compactSection) {
      const pending = shellTransition;
      const fromCompressed = typeof pending.snapshot?.fromBandsCompressed === "boolean"
        ? pending.snapshot.fromBandsCompressed
        : false;
      // Estado inicial ya fijado antes del attach; aquí solo forzar destino si no hay anim.
      if (!pending.intent?.bandTransition) {
        setWorldBandLayout(scene, true);
        setOrbitLayoutPaused(scene, false);
      } else if (fromCompressed !== true) {
        // Home/expandido → sección: applySectionEnter anima; mantener origen.
        setWorldBandLayout(scene, fromCompressed);
      }
    } else if (bandTransition) {
      const fromCompressed = shellTransition.snapshot.fromBandsCompressed === true;
      setWorldBandLayout(scene, fromCompressed);
      setOrbitLayoutPaused(scene, true);
      void scene.offsetWidth;
      void animateWorldBands(scene, false, resumeMs).then(() => {
        setOrbitLayoutPaused(scene, false);
        getWorldSession()?.fantasySceneTeardown?.relayout?.();
        getWorldSession()?.spaceOrbitTeardown?.relayout?.();
      });
    } else {
      setWorldBandLayout(scene, Boolean(compactSection));
      setOrbitLayoutPaused(scene, false);
    }
    logoRevealStageReached = true;
    ringWrap.style.visibility = "hidden";
    ringWrap.style.pointerEvents = "none";
    ringSpin.classList.remove("is-orbiting");

    const authStack = document.createElement("div");
    authStack.className = "loader-auth-stack";
    chrome.appendChild(authStack);

    /** @type {HTMLElement | null} */
    let sectionHost = null;
    if (compactSection) {
      sectionHost = document.createElement("div");
      sectionHost.className = "section-host";
      chrome.appendChild(sectionHost);
      // @ts-expect-error stash for return
      chrome._sectionHost = sectionHost;
    }

    const brand = document.createElement("div");
    brand.className = "loader-auth-brand is-static";
    if (!compactSection) {
      authStack.appendChild(brand);
    }

    /** @type {HTMLElement} */
    let authLogo = logoWrap;
    if (
      (resumeShell || fromPath === "account")
      && reusedLogoEl instanceof HTMLElement
    ) {
      logoWrap.remove();
      authLogo = reusedLogoEl;
      authLogo.classList.remove("legal-logo-wrap");
      if (fromLogo) {
        document.body.appendChild(authLogo);
        pinLogoAtRect(authLogo, fromLogo);
      }
    }

    if (welcomeHome) {
      homeWelcomePanel = mountHomeWelcomePanel(authStack, {
        displayName: welcomeHome.displayName,
        lineSci: welcomeHome.lineSci,
        lineFantasy: welcomeHome.lineFantasy,
        onSignOut: welcomeHome.onSignOut,
      });
    }

    void (async () => {
      if (compactSection) {
        markLogoAssetReady();
        return;
      }
      const authFallback = authLogo.querySelector(".loader-logo-fallback");
      if (!revealLoadedWorldLogo(authLogo)) {
        await mountWorldLogo(
          authLogo,
          authFallback instanceof HTMLElement ? authFallback : logoFallback,
        );
      }
      if (destroyed) return;

      if ((resumeShell || fromPath === "account") && fromLogo) {
        void brand.offsetWidth;
        const settleProbe = document.createElement("div");
        settleProbe.className = "loader-logo-wrap is-auth-positioned is-ready world-logo-placeholder";
        settleProbe.setAttribute("aria-hidden", "true");
        settleProbe.style.visibility = "hidden";
        const settleW = Math.min(188, Math.round(window.innerWidth * 0.48));
        settleProbe.style.width = `${settleW}px`;
        if (fromLogo.height > 0 && fromLogo.width > 0) {
          settleProbe.style.aspectRatio = `${fromLogo.width} / ${fromLogo.height}`;
        }
        brand.appendChild(settleProbe);
        void brand.offsetWidth;
        const settleTo = captureRect(settleProbe);
        settleProbe.remove();

        if (settleTo) {
          await morphLogoBetweenRects(authLogo, fromLogo, settleTo, Math.min(220, resumeMs), {
            keepPinned: true,
          });
        }
        mountStaticAuthBrand(brand, authLogo, { showSlogan: !welcomeHome });
        clearLogoPinStyles(authLogo);
        // Si hay animación de bandas en curso, el then() de animateWorldBands libera la órbita.
        if (!bandTransition) {
          setOrbitLayoutPaused(scene, false);
          getWorldSession()?.fantasySceneTeardown?.relayout?.();
          getWorldSession()?.spaceOrbitTeardown?.relayout?.();
        }
      } else {
        mountStaticAuthBrand(brand, authLogo, { showSlogan: !welcomeHome });
      }

      if (statusMessage) {
        const statusEl = document.createElement("p");
        statusEl.className = "loader-auth-status";
        statusEl.textContent = statusMessage;
        authStack.appendChild(statusEl);
      }
      markLogoAssetReady();
    })();
  }

  if (!compactSection) {
    const resumeTransition = consumeWorldTransition();
    if (resumeTransition.intent?.resumeAuth) {
    const resumeMs = reducedMotion ? 120 : 720;
    revealSequence.destroy();
    gate.destroy();

    scene.classList.add(
      "is-reveal-bg",
      "is-reveal-fantasy",
      "is-reveal-space",
      "is-reveal-logo",
      "is-reveal-ring",
      "is-auth-idle",
    );
    scene.classList.remove("is-gate-ready", "is-gate-exiting");
    scene.removeAttribute("role");
    scene.removeAttribute("aria-valuemin");
    scene.removeAttribute("aria-valuemax");
    scene.removeAttribute("aria-valuenow");
    scene.setAttribute("aria-label", "Iniciar sesión en KidepiK");

    mountFantasyWorldLayers();
    mountSpaceWorldLayers();
    logoRevealStageReached = true;
    markLogoAssetReady();
    ringWrap.style.visibility = "hidden";
    ringWrap.style.pointerEvents = "none";

    let authStack = chrome.querySelector(".loader-auth-stack");
    if (!(authStack instanceof HTMLElement)) {
      authStack = document.createElement("div");
      authStack.className = "loader-auth-stack";
      chrome.appendChild(authStack);
    }

    let brand = authStack.querySelector(".loader-auth-brand");
    if (!(brand instanceof HTMLElement)) {
      brand = document.createElement("div");
      brand.className = "loader-auth-brand is-static";
      authStack.appendChild(brand);
    }

    const reusedLogo = resumeTransition.snapshot?.logoEl;
    const fromLogo = resumeTransition.snapshot?.logo;
    const alreadyExpanded = resumeTransition.snapshot?.bandsAlreadyExpanded === true;
    /** @type {HTMLElement} */
    let authLogo = logoWrap;
    if (reusedLogo instanceof HTMLElement) {
      logoWrap.remove();
      authLogo = reusedLogo;
      authLogo.classList.remove("legal-logo-wrap");
    }

    // No meter un logo `position:fixed` dentro de `.loader-auth-stack` (tiene transform
    // y convierte el containing block → salto enorme). Morph/settle desde body.
    if (fromLogo || alreadyExpanded) {
      document.body.appendChild(authLogo);
    } else if (authLogo.parentElement !== brand) {
      brand.insertBefore(authLogo, brand.firstChild);
    }

    authLogo.classList.add("is-auth-positioned", "is-ready");

    const authPanel = mountAuthPanel(authStack, {
      embedded: true,
      deferredReveal: true,
    });
    bindLegalLinkTransitions(authPanel.root);

    if (alreadyExpanded) {
      setWorldBandLayout(scene, false);
      if (fromLogo) pinLogoAtRect(authLogo, fromLogo);

      void brand.offsetWidth;
      const settleProbe = document.createElement("div");
      settleProbe.className = "loader-logo-wrap is-auth-positioned is-ready world-logo-placeholder";
      settleProbe.setAttribute("aria-hidden", "true");
      settleProbe.style.visibility = "hidden";
      const settleW = Math.min(188, Math.round(window.innerWidth * 0.48));
      settleProbe.style.width = `${settleW}px`;
      if (fromLogo && fromLogo.height > 0 && fromLogo.width > 0) {
        settleProbe.style.aspectRatio = `${fromLogo.width} / ${fromLogo.height}`;
      }
      brand.appendChild(settleProbe);
      void brand.offsetWidth;
      const settleTo = captureRect(settleProbe);
      settleProbe.remove();

      void (async () => {
        const authFallback = authLogo.querySelector(".loader-logo-fallback");
        if (!revealLoadedWorldLogo(authLogo)) {
          await mountWorldLogo(
            authLogo,
            authFallback instanceof HTMLElement ? authFallback : logoFallback,
          );
          authLogo.classList.add("is-ready");
        }
        if (fromLogo && settleTo) {
          await morphLogoBetweenRects(authLogo, fromLogo, settleTo, Math.min(220, resumeMs), {
            keepPinned: true,
          });
        }
        brand.insertBefore(authLogo, brand.firstChild);
        clearLogoPinStyles(authLogo);
        setOrbitLayoutPaused(scene, false);
        if (!destroyed) {
          getWorldSession()?.fantasySceneTeardown?.relayout?.();
          getWorldSession()?.spaceOrbitTeardown?.relayout?.();
          authPanel.reveal();
        }
      })();
    } else {
      void brand.offsetWidth;
      const probe = document.createElement("div");
      probe.className = "loader-logo-wrap is-auth-positioned is-ready world-logo-placeholder";
      probe.setAttribute("aria-hidden", "true");
      probe.style.visibility = "hidden";
      const authLogoWidth = Math.min(188, Math.round(window.innerWidth * 0.48));
      probe.style.width = `${authLogoWidth}px`;
      if (fromLogo && fromLogo.height > 0 && fromLogo.width > 0) {
        probe.style.aspectRatio = `${fromLogo.width} / ${fromLogo.height}`;
      }
      brand.appendChild(probe);
      void brand.offsetWidth;
      /** @type {{ left: number; top: number; width: number; height: number } | null} */
      const toHint = captureRect(probe);
      probe.remove();

      if (fromLogo) {
        document.body.appendChild(authLogo);
        pinLogoAtRect(authLogo, fromLogo);
      }

      setWorldBandLayout(scene, true);
      setOrbitLayoutPaused(scene, true);
      void (async () => {
        const authFallback = authLogo.querySelector(".loader-logo-fallback");
        if (!revealLoadedWorldLogo(authLogo)) {
          await mountWorldLogo(
            authLogo,
            authFallback instanceof HTMLElement ? authFallback : logoFallback,
          );
          authLogo.classList.add("is-ready");
        }
        await morphLogoWithBands(scene, authLogo, fromLogo, false, resumeMs, toHint, {
          keepPinned: true,
        });
        brand.insertBefore(authLogo, brand.firstChild);
        clearLogoPinStyles(authLogo);
        if (!destroyed) authPanel.reveal();
      })();
    }
    }
  }

  if (pingHealth) {
    void pingHealth();
  }

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function updateProgressVisual(p) {
    const pct = Math.min(100, Math.round(p * 100));
    const offset = RING_CIRCUMFERENCE * (1 - p);
    if (ringProgress instanceof SVGElement) {
      ringProgress.setAttribute("stroke-dashoffset", String(offset));
    }
    if (ringReveal instanceof SVGElement) {
      ringReveal.setAttribute("stroke-dashoffset", String(offset));
    }
    scene.setAttribute("aria-valuenow", String(pct));
  }

  function startOrbit() {
    if (orbitActive) return;
    orbitActive = true;
    if (!reducedMotion) {
      ringSpin.classList.add("is-orbiting");
    }
    gate.onLoadingComplete();
  }

  function tick(now) {
    if (destroyed || orbitActive) return;
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / progressDurationMs);
    progress = easeOutCubic(t);
    updateProgressVisual(progress);

    if (t >= 1) {
      startOrbit();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function startProgressLoop() {
    if (progressStarted || destroyed) return;
    progressStarted = true;
    if (reducedMotion) {
      progress = 1;
      updateProgressVisual(1);
      startOrbit();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  return {
    /** @type {HTMLElement | undefined} */
    sectionHost: /** @type {HTMLElement | undefined} */ (
      // @ts-expect-error optional stash
      chrome._sectionHost
    ),
    destroy(options = {}) {
      destroyed = true;
      document.body.classList.remove("is-loader-active");
      homeWelcomePanel?.destroy();
      homeWelcomePanel = null;
      gate.destroy();
      revealSequence.destroy();
      if (rafId) cancelAnimationFrame(rafId);

      if (isWorldRouteHash()) {
        teardownLogoMaskSync();
        syncWorldSessionState();
        if (options.worldHandoff) {
          parkWorldLayersForHandoff();
        } else {
          detachWorldLayers();
        }
        return;
      }

      destroyWorldSession();
    },
  };
}
