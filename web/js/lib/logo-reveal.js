/**
 * Estados de revelación del wordmark KidepiK (pending / ready / error).
 * @module logo-reveal
 */

/**
 * @param {HTMLElement | null | undefined} logoWrap
 * @returns {boolean}
 */
export function isLogoAssetReady(logoWrap) {
  if (!(logoWrap instanceof HTMLElement)) return false;
  const logoImg = logoWrap.querySelector(".loader-logo");
  if (!(logoImg instanceof HTMLImageElement)) return false;
  if (!logoImg.getAttribute("src")) return false;
  return logoImg.complete && logoImg.naturalWidth > 0;
}

/**
 * Sincroniza clases e hidratación visual del logo wrap.
 * @param {HTMLElement} logoWrap
 * @param {"pending"|"ready"|"error"} state
 */
export function syncLogoRevealState(logoWrap, state) {
  if (!(logoWrap instanceof HTMLElement)) return;
  logoWrap.classList.toggle("is-logo-pending", state === "pending");
  logoWrap.classList.toggle("is-logo-error", state === "error");
  logoWrap.classList.toggle("is-logo-ready", state === "ready");
  logoWrap.classList.toggle("is-ready", state === "ready");

  const logoImg = logoWrap.querySelector(".loader-logo");
  const fallback = logoWrap.querySelector(".loader-logo-fallback");
  if (state === "pending") {
    if (logoImg instanceof HTMLElement) logoImg.hidden = true;
    if (fallback instanceof HTMLElement) fallback.hidden = true;
    return;
  }
  if (state === "ready") {
    if (logoImg instanceof HTMLElement) logoImg.hidden = false;
    if (fallback instanceof HTMLElement) fallback.hidden = true;
    return;
  }
  if (logoImg instanceof HTMLElement) logoImg.hidden = true;
  if (fallback instanceof HTMLElement) fallback.hidden = false;
}

/**
 * Infiere estado desde el DOM actual del wrap.
 * @param {HTMLElement} logoWrap
 * @returns {"pending"|"ready"|"error"}
 */
export function inferLogoRevealState(logoWrap) {
  if (!(logoWrap instanceof HTMLElement)) return "pending";
  if (logoWrap.classList.contains("is-logo-error")) return "error";
  if (isLogoAssetReady(logoWrap)) return "ready";
  const fallback = logoWrap.querySelector(".loader-logo-fallback");
  if (fallback instanceof HTMLElement && !fallback.hidden) return "error";
  return "pending";
}
