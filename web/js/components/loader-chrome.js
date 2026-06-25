import { assetUrl } from "../lib/assets.manifest.js";
import { mountSpaceOrbitLayer } from "./loader-space-orbit.js";

export const LOADER_SLOGAN = "Dos mundos. Un viaje épico.";

const DURATION_MS = 4500;
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
        font-family="Orbitron, sans-serif"
        font-size="5.8"
        font-weight="700"
        letter-spacing="0.2em"
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
        font-family="Cinzel, Georgia, serif"
        font-size="5.6"
        font-weight="700"
        letter-spacing="0.12em"
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
 * @param {{ onComplete: () => void; pingHealth?: () => Promise<boolean> }} options
 * @returns {{ destroy: () => void }}
 */
export function mountLoaderChrome(app, { onComplete, pingHealth }) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = document.createElement("div");
  scene.className = "scene scene-loader";
  scene.tabIndex = 0;
  scene.setAttribute("role", "progressbar");
  scene.setAttribute("aria-valuemin", "0");
  scene.setAttribute("aria-valuemax", "100");
  scene.setAttribute("aria-valuenow", "0");
  scene.setAttribute("aria-label", `Cargando KidepiK — ${LOADER_SLOGAN}`);

  const layers = document.createElement("div");
  layers.className = "loader-layers";

  const bg = document.createElement("div");
  bg.className = "loader-layer loader-layer--bg";

  const accentFantasy = document.createElement("div");
  accentFantasy.className = "loader-layer loader-layer--accent loader-layer--fantasy";

  const accentSpace = document.createElement("div");
  accentSpace.className = "loader-layer loader-layer--accent loader-layer--space";

  layers.append(bg, accentFantasy, accentSpace);

  const chrome = document.createElement("div");
  chrome.className = "loader-chrome";

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
  scene.append(layers, chrome);
  app.appendChild(scene);
  document.body.classList.add("is-loader-active");

  let spaceOrbitTeardown = mountSpaceOrbitLayer(layers, { reducedMotion });

  let destroyed = false;
  let progress = 0;
  let rafId = 0;
  let startTime = 0;
  let orbitActive = false;

  const markMissingBg = () => {
    scene.classList.add("is-placeholder-art");
  };

  const revealLogo = () => {
    logoWrap.classList.add("is-ready");
    if (!reducedMotion) {
      logoWrap.classList.add("is-ambi-active");
    }
  };

  void (async () => {
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
            revealLogo();
          },
          { once: true },
        );
        logoImg.src = logoSrc;
      } else {
        logoImg.hidden = true;
        logoWrap.classList.add("is-ready");
      }
    } else {
      logoImg.hidden = true;
      logoWrap.classList.add("is-ready");
    }

    await mountOptionalImage(accentFantasy, "loader.accent.fantasy");
    await mountOptionalImage(accentSpace, "loader.accent.space");
  })();

  if (pingHealth) {
    void pingHealth();
  }

  function finish() {
    if (destroyed) return;
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    onComplete();
  }

  function trySkip() {
    finish();
  }

  scene.addEventListener("click", trySkip);
  scene.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") trySkip();
  });

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
    if (orbitActive || reducedMotion) return;
    orbitActive = true;
    ringSpin.classList.add("is-orbiting");
  }

  function tick(now) {
    if (destroyed || orbitActive) return;
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / DURATION_MS);
    progress = easeOutCubic(t);
    updateProgressVisual(progress);

    if (t >= 1) {
      startOrbit();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  if (reducedMotion) {
    progress = 1;
    updateProgressVisual(1);
  } else {
    rafId = requestAnimationFrame(tick);
  }

  return {
    destroy() {
      destroyed = true;
      document.body.classList.remove("is-loader-active");
      spaceOrbitTeardown.destroy();
      if (rafId) cancelAnimationFrame(rafId);
      scene.removeEventListener("click", trySkip);
    },
  };
}
