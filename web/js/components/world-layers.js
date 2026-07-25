/**
 * Capas de fondo compartidas (loader + legal): degradado, fantasía y espacio.
 * @module world-layers
 */

import { assetUrl } from "../lib/assets.manifest.js";
import { mountFantasyTerrainLayer, measureFantasyTerrainHeightPx } from "./loader-fantasy-terrain.js";
import { mountFantasyBackdropLayer } from "./loader-fantasy-backdrop.js";
import { mountFantasyScene } from "./loader-fantasy-scene.js";
import { mountFantasyCelestialLayer } from "./loader-fantasy-celestial.js";
import { mountFantasyCloudsLayer } from "./loader-fantasy-clouds.js";
import { mountMeteorShowerLayer } from "./loader-meteor-shower.js";
import { mountSpaceOrbitLayer } from "./loader-space-orbit.js?v=138";
import { mountLoaderLogoMaskSync, syncLoaderLogoMask } from "./loader-logo-mask.js";
import {
  mountOptionalImage,
  parseWorldLayerQuery,
  probeImage,
} from "./loader-world-utils.js";
import {
  getWorldSession,
  registerWorldSession,
  worldLayersHaveFantasyMounted,
  worldLayersHaveSpaceMounted,
} from "../lib/world-session.js?v=156";

/**
 * @returns {{
 *   layers: HTMLDivElement;
 *   bg: HTMLDivElement;
 *   accentFantasy: HTMLDivElement;
 *   accentSpace: HTMLDivElement;
 * }}
 */
export function createWorldLayersDom() {
  const layers = document.createElement("div");
  layers.className = "loader-layers";

  const bg = document.createElement("div");
  bg.className = "loader-layer loader-layer--bg";

  const bgAttenuate = document.createElement("div");
  bgAttenuate.className = "loader-bg-attenuate";
  bgAttenuate.setAttribute("aria-hidden", "true");
  bg.appendChild(bgAttenuate);

  const accentFantasy = document.createElement("div");
  accentFantasy.className = "loader-layer loader-layer--accent loader-layer--fantasy";

  const accentSpace = document.createElement("div");
  accentSpace.className = "loader-layer loader-layer--accent loader-layer--space";

  layers.append(bg, accentFantasy, accentSpace);
  return { layers, bg, accentFantasy, accentSpace };
}

/**
 * @param {{
 *   layers: HTMLElement;
 *   scene: HTMLElement;
 *   focal?: HTMLElement | null;
 *   reducedMotion?: boolean;
 *   query?: URLSearchParams;
 *   revealed?: boolean;
 * }} options
 * @returns {{ destroy: () => void; reveal: () => void; syncMask: () => void; getSessionState: () => object }}
 */
export function mountWorldLayers({
  layers,
  scene,
  focal = null,
  reducedMotion = false,
  query = new URLSearchParams(),
  revealed = false,
}) {
  const opts = parseWorldLayerQuery(query);

  /** @type {{ destroy: () => void } | null} */
  let spaceOrbitTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let meteorTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let fantasyBackdropTeardown = null;
  /** @type {{ destroy: () => void; profile?: import('./loader-fantasy-terrain.js').TerrainProfile } | null} */
  let fantasyTerrainTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let fantasyCloudsTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let fantasyCelestialTeardown = null;
  /** @type {{ destroy: () => void } | null} */
  let fantasySceneTeardown = null;
  let fantasyLayersMounted = false;
  let spaceLayersMounted = false;

  const teardownLogoMaskSync = focal
    ? mountLoaderLogoMaskSync(scene, focal)
    : () => {};

  const syncMask = () => {
    if (focal) syncLoaderLogoMask(scene, focal);
  };

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
    fantasyBackdropTeardown = mountFantasyBackdropLayer(layers, { kind: opts.backdropKind });
    fantasyTerrainTeardown = mountFantasyTerrainLayer(layers);
    const terrainProfile = fantasyTerrainTeardown.profile;
    fantasyCloudsTeardown = mountFantasyCloudsLayer(layers, { reducedMotion, demoFast: opts.cloudDemo });
    fantasyCelestialTeardown = mountFantasyCelestialLayer(layers, { reducedMotion, demoFast: opts.celestialDemo });
    const fantasyTerrainH = measureFantasyTerrainHeightPx(layers);
    fantasySceneTeardown = mountFantasyScene(layers, {
      reducedMotion,
      terrainHeightPx: fantasyTerrainH,
      terrainProfile,
      devKind: opts.fantasyDev,
      devFaction: opts.fantasyFaction,
      devSeed: opts.fantasySeed,
      devFormation: opts.fantasyFormation,
      fxEnabled: opts.fxEnabled,
      fxIntensity: opts.fxIntensity,
    });
    syncMask();
    syncWorldSessionState();
  }

  function mountSpaceWorldLayers() {
    if (spaceLayersMounted || adoptSpaceFromSession()) return;
    spaceLayersMounted = true;
    const spaceLayout = scene.classList.contains("scene-legal") ? "legal" : "loader";
    spaceOrbitTeardown = mountSpaceOrbitLayer(layers, { reducedMotion, layout: spaceLayout });
    meteorTeardown = mountMeteorShowerLayer(layers, { reducedMotion, demoBurst: opts.meteorDemo, layout: spaceLayout });
    syncMask();
    syncWorldSessionState();
  }

  function reveal() {
    scene.classList.add("is-reveal-bg", "is-reveal-fantasy", "is-reveal-space");
    mountFantasyWorldLayers();
    mountSpaceWorldLayers();
  }

  if (revealed) reveal();

  const bg = layers.querySelector(".loader-layer--bg");
  if (bg instanceof HTMLElement) {
    void (async () => {
      const bgOk = await mountOptionalImage(bg, "loader.bg.plain", {
        fit: "cover",
        onLoad: () => scene.classList.add("is-bg-ready"),
      });
      if (!bgOk) scene.classList.add("is-placeholder-art");
    })();
  }

  return {
    reveal,
    syncMask,
    getSessionState: () => ({
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
    }),
    destroy() {
      teardownLogoMaskSync();
      spaceOrbitTeardown?.destroy();
      meteorTeardown?.destroy();
      fantasyBackdropTeardown?.destroy();
      fantasyTerrainTeardown?.destroy();
      fantasyCloudsTeardown?.destroy();
      fantasyCelestialTeardown?.destroy();
      fantasySceneTeardown?.destroy();
    },
  };
}

/**
 * @param {HTMLElement} logoWrap
 * @param {HTMLElement} fallback
 * @returns {Promise<void>}
 */
export async function mountWorldLogo(logoWrap, fallback) {
  const logoImg = logoWrap.querySelector(".loader-logo");
  if (!(logoImg instanceof HTMLImageElement)) return;

  const logoSrc = assetUrl("loader.logo");
  if (!logoSrc) {
    logoImg.hidden = true;
    fallback.hidden = false;
    logoWrap.classList.add("is-ready");
    return;
  }

  const logoOk = await probeImage(logoSrc);
  if (!logoOk) {
    logoImg.hidden = true;
    fallback.hidden = false;
    logoWrap.classList.add("is-ready");
    return;
  }

  logoImg.addEventListener("load", () => {
    logoImg.hidden = false;
    fallback.hidden = true;
    logoWrap.classList.add("is-ready");
  }, { once: true });
  logoImg.src = logoSrc;
}

/**
 * @returns {{ logoWrap: HTMLDivElement; fallback: HTMLParagraphElement }}
 */
export function createWorldLogoDom() {
  const logoWrap = document.createElement("div");
  logoWrap.className = "loader-logo-wrap";

  const logoImg = document.createElement("img");
  logoImg.className = "loader-logo";
  logoImg.alt = "KidepiK";
  logoImg.hidden = true;

  const fallback = document.createElement("p");
  fallback.className = "loader-logo-fallback";
  fallback.textContent = "KidepiK";

  logoWrap.append(logoImg, fallback);
  return { logoWrap, fallback };
}
