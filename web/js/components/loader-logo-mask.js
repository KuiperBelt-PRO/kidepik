/** Capas con agujero circular sobre el disco del logo/anillo central. */
export const LOADER_LOGO_MASKED_LAYER_SELECTOR =
  ".loader-layer--fantasy-clouds, .loader-layer--fantasy-celestial, .loader-layer--space-orbit, .loader-layer--meteor-shower";

/** Margen extra sobre el radio interior para cubrir antialiasing del degradado. */
export const LOGO_MASK_EDGE_PAD = 4;

/** Debounce de sincronización de máscara (ms). */
export const LOGO_MASK_SYNC_DEBOUNCE_MS = 100;

/**
 * Fracción del ancho del focal: radio del círculo interior del anillo
 * (borde interior del trazo). Coherente con RING_RADIUS/RING_STROKE en loader-chrome.js.
 */
export const LOADER_RING_INNER_RADIUS_FRAC = (50 - 2.5 / 2) / 120;

/**
 * Radio de la máscara (px): solo el disco interior del anillo + margen de borde.
 * @param {number} focalWidthPx
 * @param {number} [edgePad]
 */
export function logoMaskRadiusPx(focalWidthPx, edgePad = LOGO_MASK_EDGE_PAD) {
  return focalWidthPx * LOADER_RING_INNER_RADIUS_FRAC + edgePad;
}

/**
 * Centro del focal en coordenadas locales de una capa (px desde esquina sup. izq.).
 * @param {HTMLElement} layer
 * @param {HTMLElement} focal
 * @returns {{ x: number; y: number }}
 */
export function measureLogoCenterInLayer(layer, focal) {
  const layerRect = layer.getBoundingClientRect();
  const focalRect = focal.getBoundingClientRect();
  return {
    x: focalRect.left + focalRect.width / 2 - layerRect.left,
    y: focalRect.top + focalRect.height / 2 - layerRect.top,
  };
}

/**
 * @param {DOMRect} rect
 * @returns {string}
 */
export function focalRectKey(rect) {
  return `${Math.round(rect.left)}|${Math.round(rect.top)}|${Math.round(rect.width)}|${Math.round(rect.height)}`;
}

/**
 * Alinea radio y centro de la máscara con el disco real del anillo/logo.
 * @param {HTMLElement} scene
 * @param {HTMLElement} focal
 */
export function syncLoaderLogoMask(scene, focal) {
  const focalRect = focal.getBoundingClientRect();
  if (focalRect.width <= 0 || focalRect.height <= 0) return;

  const radius = logoMaskRadiusPx(focalRect.width);
  scene.style.setProperty("--loader-logo-mask-r", `${radius}px`);

  for (const layer of scene.querySelectorAll(LOADER_LOGO_MASKED_LAYER_SELECTOR)) {
    const center = measureLogoCenterInLayer(layer, focal);
    layer.style.setProperty("--loader-logo-mask-cx", `${center.x}px`);
    layer.style.setProperty("--loader-logo-mask-cy", `${center.y}px`);
  }
}

/**
 * Observa layout y mantiene la máscara alineada al focal.
 * @param {HTMLElement} scene
 * @param {HTMLElement} focal
 * @returns {() => void}
 */
export function mountLoaderLogoMaskSync(scene, focal) {
  let lastFocalKey = "";
  let debounceTimer = 0;

  const runNow = () => {
    const focalRect = focal.getBoundingClientRect();
    const key = focalRectKey(focalRect);
    if (key === lastFocalKey) return;
    lastFocalKey = key;
    syncLoaderLogoMask(scene, focal);
  };

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = 0;
      runNow();
    }, LOGO_MASK_SYNC_DEBOUNCE_MS);
  };

  runNow();

  const ro = new ResizeObserver(schedule);
  ro.observe(scene);
  ro.observe(focal);

  window.addEventListener("resize", schedule);

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    ro.disconnect();
    window.removeEventListener("resize", schedule);
  };
}
