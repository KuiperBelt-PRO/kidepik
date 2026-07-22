/**
 * Panel de auth: CTA Google + texto legal.
 * @module auth-panel
 */

import { signInWithGoogle } from "../lib/supabase.js";

export const AUTH_COPY = {
  subtitle: "Cuenta de padre, madre o tutor",
  google: "Continuar con Google",
  legal: "Al continuar, aceptas los Términos y la Política de privacidad.",
  errorGeneric: "No hemos podido iniciar sesión. Inténtalo de nuevo.",
  errorOffline: "Necesitas conexión para continuar con Google.",
};

/**
 * @param {HTMLElement} container
 * @param {{ embedded?: boolean; deferredReveal?: boolean }} [options]
 * @returns {{ root: HTMLElement; reveal: () => void; destroy: () => void }}
 */
export function mountAuthPanel(container, { embedded = false, deferredReveal = false } = {}) {
  const root = document.createElement("div");
  root.className = embedded
    ? "auth-panel auth-panel--embedded"
    : "auth-panel";

  if (embedded && deferredReveal) {
    root.classList.add("is-awaiting-reveal");
    root.setAttribute("aria-hidden", "true");
  }

  const subtitle = document.createElement("p");
  subtitle.className = "auth-panel__subtitle";
  subtitle.textContent = AUTH_COPY.subtitle;

  const errorEl = document.createElement("p");
  errorEl.className = "auth-panel__error";
  errorEl.hidden = true;
  errorEl.setAttribute("role", "alert");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "auth-panel__google";
  button.setAttribute("aria-label", AUTH_COPY.google);
  if (deferredReveal) {
    button.tabIndex = -1;
    button.disabled = true;
  }

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "auth-panel__google-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = `
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  `;

  const label = document.createElement("span");
  label.textContent = AUTH_COPY.google;

  button.append(icon, label);

  const legal = document.createElement("p");
  legal.className = "auth-panel__legal";
  legal.innerHTML =
    'Al continuar, aceptas los <a class="auth-panel__legal-link" href="#/legal/terminos">Términos</a> y la <a class="auth-panel__legal-link" href="#/legal/privacidad">Política de privacidad</a>.';

  root.append(subtitle, errorEl, button, legal);
  container.appendChild(root);

  let busy = false;
  let revealed = !deferredReveal;

  /**
   * @param {string} message
   */
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  async function onGoogleClick() {
    if (!revealed || busy) return;
    busy = true;
    button.disabled = true;
    button.classList.add("is-loading");
    errorEl.hidden = true;

    const { error } = await signInWithGoogle();
    if (error) {
      busy = false;
      button.disabled = false;
      button.classList.remove("is-loading");
      showError(
        error.message === "offline" ? AUTH_COPY.errorOffline : AUTH_COPY.errorGeneric,
      );
    }
  }

  function onClick() {
    void onGoogleClick();
  }

  button.addEventListener("click", onClick);

  function reveal() {
    if (revealed) return;
    revealed = true;
    root.classList.remove("is-awaiting-reveal");
    root.classList.add("is-revealed");
    root.removeAttribute("aria-hidden");
    button.disabled = false;
    button.removeAttribute("tabindex");
  }

  return {
    root,
    reveal,
    destroy() {
      button.removeEventListener("click", onClick);
      root.remove();
    },
  };
}
