import { assetUrl } from "../lib/assets.manifest.js";
import { parseDevFaction } from "./loader-fantasy-castle-factions.js";
import { mountFantasyTerrainLayer, measureFantasyTerrainHeightPx } from "./loader-fantasy-terrain.js";
import { mountFantasyBackdropLayer, parseBackdropKind } from "./loader-fantasy-backdrop.js";
import { mountFantasyScene } from "./loader-fantasy-scene.js";
import { mountFantasyCelestialLayer } from "./loader-fantasy-celestial.js";
import { mountFantasyCloudsLayer } from "./loader-fantasy-clouds.js";
import { mountMeteorShowerLayer } from "./loader-meteor-shower.js";
import { mountSpaceOrbitLayer } from "./loader-space-orbit.js?v=138";
import { startLoaderRevealSequence } from "./loader-reveal-sequence.js";
import { mountLoaderLogoMaskSync, syncLoaderLogoMask } from "./loader-logo-mask.js";
import { mountLoaderGate } from "./loader-gate.js?v=109";
import { mountAuthPanel } from "./auth-panel.js?v=109";
import {
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
  registerWorldSession,
  worldLayersHaveFantasyMounted,
  worldLayersHaveSpaceMounted,
} from "../lib/world-session.js?v=152";
import { mountWorldLogo } from "./world-layers.js?v=138";
import { bindLegalLinkTransitions } from "../scenes/legal.js?v=142";

/**
 * @param {HTMLElement} logoWrap
 * @returns {boolean}
 */
function revealLoadedWorldLogo(logoWrap) {
  const logoImg = logoWrap.querySelector(".loader-logo");
  const fallback = logoWrap.querySelector(".loader-logo-fallback");
  if (!(logoImg instanceof HTMLImageElement)) return false;
  if (!logoImg.getAttribute("src")) return false;

  logoImg.hidden = false;
  if (fallback instanceof HTMLElement) fallback.hidden = true;
  logoWrap.classList.add("is-ready");
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
 * Lee query params del loader desde `?…` o desde `#/loader?…` (ambos formatos).
 * @returns {URLSearchParams}
 */
function getLoaderQueryParams() {
  const fromSearch = new URLSearchParams(window.location.search);
  if ([...fromSearch.keys()].length > 0) return fromSearch;
  const hash = window.location.hash || "";
  const q = hash.indexOf("?");
  if (q >= 0) return new URLSearchParams(hash.slice(q + 1));
  return fromSearch;
}

/**
 * @param {string} src
 * @returns {Promise<boolean>}
 */
function probeImage(src) {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(true);
    probe.onerror = () => resolve(false);
    probe.src = src;
  });
}

/**
 * @param {HTMLElement} layer
 * @param {string} slotId
 * @param {{ fit?: "cover" | "contain"; onLoad?: () => void; onError?: () => void }} [options]
 * @returns {Promise<boolean>}
 */
async function mountOptionalImage(layer, slotId, options = {}) {
  const { fit = "cover", onLoad, onError } = options;
  const src = assetUrl(slotId);
  if (!src) return false;

  const img = document.createElement("img");
  img.className = "loader-layer__img";
  img.alt = "";
  img.decoding = "async";
  img.style.objectFit = fit;

  const loaded = await new Promise((resolve) => {
    img.addEventListener(
      "load",
      () => {
        onLoad?.();
        resolve(true);
      },
      { once: true },
    );
    img.addEventListener(
      "error",
      () => {
        onError?.();
        resolve(false);
      },
      { once: true },
    );
    img.src = src;
  });

  if (!loaded) return false;
  layer.appendChild(img);
  return true;
}

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
 * @param {{ pingHealth?: () => Promise<boolean> }} [options]
 * @returns {{ destroy: () => void }}
 */
export function mountLoaderChrome(app, { pingHealth } = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pendingResume = peekWorldTransition();
  const resumingAuth = pendingResume.intent?.resumeAuth === true;
  const bandsAlreadyExpanded = pendingResume.snapshot?.bandsAlreadyExpanded === true;

  const scene = document.createElement("div");
  scene.className = "scene scene-loader scene-world";
  scene.tabIndex = 0;
  scene.setAttribute("role", "progressbar");
  scene.setAttribute("aria-valuemin", "0");
  scene.setAttribute("aria-valuemax", "100");
  scene.setAttribute("aria-valuenow", "0");
  scene.setAttribute("aria-label", `Cargando KidepiK — ${LOADER_SLOGAN}`);

  // Al volver de legal: si las bandas ya se expandieron allí, partir en loader;
  // si no, partir comprimido para animar la expansión.
  if (resumingAuth) {
    setWorldBandLayout(scene, !bandsAlreadyExpanded);
    setOrbitLayoutPaused(scene, true);
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

  const teardownLogoMaskSync = mountLoaderLogoMaskSync(scene, focal);

  const loaderQuery = getLoaderQueryParams();
  const meteorDemo = loaderQuery.get("meteorDemo") === "1";
  const cloudDemo = loaderQuery.get("cloudDemo") === "1";
  const celestialDemo = loaderQuery.get("celestialDemo") === "1";
  const backdropKind = parseBackdropKind(loaderQuery.get("backdropKind"));
  const fantasyDev = loaderQuery.get("fantasyDev") || undefined;
  const fantasyFaction = parseDevFaction(loaderQuery.get("fantasyFaction"));
  const fantasySeedRaw = loaderQuery.get("fantasySeed");
  const fantasySeed = fantasySeedRaw != null && fantasySeedRaw !== ""
    ? Number.parseInt(fantasySeedRaw, 10)
    : undefined;
  const fantasyFormationRaw = loaderQuery.get("fantasyFormation");
  const fantasyFormation = fantasyFormationRaw === "cliff" || fantasyFormationRaw === "rocks"
    ? fantasyFormationRaw
    : undefined;
  const fxIntensityRaw = loaderQuery.get("fxIntensity");
  const fxIntensityParsed = fxIntensityRaw != null && fxIntensityRaw !== ""
    ? Number.parseFloat(fxIntensityRaw)
    : NaN;
  const fxIntensity = Number.isFinite(fxIntensityParsed) ? fxIntensityParsed : 1;
  const fxEnabled = loaderQuery.get("fxDev") !== "0";
  const gateDemo = loaderQuery.get("gateDemo") === "1";
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
      devSeed: Number.isFinite(fantasySeed) ? fantasySeed : undefined,
      devFormation: fantasyFormation,
      fxEnabled,
      fxIntensity,
    });
    void mountOptionalImage(accentFantasy, "loader.accent.fantasy");
    syncLoaderLogoMask(scene, focal);
    syncWorldSessionState();
  }

  function mountSpaceWorldLayers() {
    if (spaceLayersMounted || adoptSpaceFromSession()) return;
    spaceLayersMounted = true;
    spaceOrbitTeardown = mountSpaceOrbitLayer(layers, { reducedMotion });
    meteorTeardown = mountMeteorShowerLayer(layers, { reducedMotion, demoBurst: meteorDemo });
    void mountOptionalImage(accentSpace, "loader.accent.space");
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

  void (async () => {
    if (reusedWorldLayers) {
      if (!scene.classList.contains("is-bg-ready")) {
        const hasBgImg = bg.querySelector(".loader-layer__img");
        if (hasBgImg) scene.classList.add("is-bg-ready");
      }
      markLogoAssetReady();
      return;
    }

    const bgOk = await mountOptionalImage(bg, "loader.bg.plain", {
      fit: "cover",
      onLoad: () => scene.classList.add("is-bg-ready"),
    });
    if (!bgOk) markMissingBg();

    const logoSrc = assetUrl("loader.logo");
    if (logoSrc) {
      const logoOk = await probeImage(logoSrc);
      if (logoOk) {
        logoImg.addEventListener(
          "load",
          () => {
            logoImg.hidden = false;
            logoFallback.hidden = true;
            markLogoAssetReady();
          },
          { once: true },
        );
        logoImg.src = logoSrc;
      } else {
        logoImg.hidden = true;
        markLogoAssetReady();
      }
    } else {
      logoImg.hidden = true;
      markLogoAssetReady();
    }
  })();

  const revealSequence = startLoaderRevealSequence(scene, {
    reducedMotion,
    onStage(stage) {
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
    destroy() {
      destroyed = true;
      document.body.classList.remove("is-loader-active");
      gate.destroy();
      revealSequence.destroy();
      if (rafId) cancelAnimationFrame(rafId);

      if (isWorldRouteHash()) {
        teardownLogoMaskSync();
        syncWorldSessionState();
        detachWorldLayers();
        return;
      }

      destroyWorldSession();
    },
  };
}
