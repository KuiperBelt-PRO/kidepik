/**
 * Modales glass centrados (alerta y confirmación).
 * @module glass-modal
 */

import { bindGlassIconTheme, setGlassButton } from "./glass-controls.js";

/** @typedef {'sm' | 'md' | 'lg' | 'auto'} GlassModalSize */

/** @typedef {import('./shell-ui-icons.js').UiIconId} UiIconId */

/**
 * @typedef {Object} GlassModalBaseOptions
 * @property {string} title
 * @property {string | HTMLElement} [body]
 * @property {string} [footer]
 * @property {GlassModalSize} [size]
 * @property {boolean} [closeOnScrim]
 * @property {boolean} [closeOnEscape]
 */

/**
 * @typedef {GlassModalBaseOptions & {
 *   okLabel?: string;
 * }} GlassAlertOptions
 */

/**
 * @typedef {GlassModalBaseOptions & {
 *   confirmLabel?: string;
 *   cancelLabel?: string;
 *   danger?: boolean;
 *   confirmIcon?: UiIconId;
 *   onConfirm?: () => Promise<void> | void;
 * }} GlassConfirmOptions
 */

/** @type {HTMLElement | null} */
let activeRoot = null;

/**
 * Añade `glass-scroll-fade` solo si el cuerpo tiene overflow vertical.
 * @param {HTMLElement} el
 */
export function syncGlassModalBodyScrollFade(el) {
  el.classList.remove("glass-scroll-fade");
  if (el.scrollHeight > el.clientHeight + 1) {
    el.classList.add("glass-scroll-fade");
  }
}

/**
 * @param {HTMLElement} body
 * @returns {() => void}
 */
function watchGlassModalBodyScrollFade(body) {
  const sync = () => syncGlassModalBodyScrollFade(body);
  const ro = new ResizeObserver(sync);
  ro.observe(body);
  requestAnimationFrame(() => {
    sync();
    requestAnimationFrame(sync);
  });
  return () => ro.disconnect();
}

/**
 * @param {boolean} value
 */
function finishActive(value) {
  if (!activeRoot) return;
  // @ts-expect-error stash
  const finish = activeRoot._finish;
  if (typeof finish === "function") finish(value);
}

/**
 * @param {GlassModalBaseOptions & {
 *   mode: 'alert' | 'confirm';
 *   confirmLabel?: string;
 *   cancelLabel?: string;
 *   okLabel?: string;
 *   danger?: boolean;
 *   confirmIcon?: UiIconId;
 *   onConfirm?: () => Promise<void> | void;
 * }} options
 * @returns {Promise<boolean>}
 */
function openGlassModal(options) {
  closeGlassModal();

  const mode = options.mode;
  const size = options.size ?? "md";
  const closeOnScrim = options.closeOnScrim ?? true;
  const closeOnEscape = options.closeOnEscape ?? true;

  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "glass-modal";
    activeRoot = root;

    const scrim = document.createElement("div");
    scrim.className = "glass-modal__scrim";

    const dialog = document.createElement("div");
    dialog.className = `glass-modal__dialog glass-modal__dialog--${size}`;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const titleId = `glass-modal-title-${Date.now()}`;
    const title = document.createElement("h2");
    title.id = titleId;
    title.className = "glass-modal__title";
    title.textContent = options.title;
    dialog.setAttribute("aria-labelledby", titleId);

    const body = document.createElement("div");
    body.className = "glass-modal__body";
    if (options.body instanceof HTMLElement) {
      body.appendChild(options.body);
    } else if (typeof options.body === "string" && options.body.trim()) {
      body.innerHTML = options.body;
    }

    const footer =
      options.footer && options.footer.trim()
        ? document.createElement("p")
        : null;
    if (footer) {
      footer.className = "glass-modal__footer";
      footer.textContent = options.footer;
    }

    const err = document.createElement("p");
    err.className = "glass-modal__error";
    err.hidden = true;

    const actions = document.createElement("div");
    actions.className = "glass-modal__actions";

    /** @type {HTMLButtonElement | null} */
    let primaryBtn = null;
    /** @type {HTMLButtonElement | null} */
    let secondaryBtn = null;

    if (mode === "confirm") {
      secondaryBtn = document.createElement("button");
      secondaryBtn.type = "button";
      secondaryBtn.className = "crew-panel__btn";
      secondaryBtn.textContent = options.cancelLabel ?? "Cancelar";

      primaryBtn = document.createElement("button");
      primaryBtn.type = "button";
      primaryBtn.className = "crew-panel__btn";
      const confirmIcon = options.confirmIcon ?? (options.danger ? "danger" : "save");
      setGlassButton(
        primaryBtn,
        confirmIcon,
        options.confirmLabel ?? "Aceptar",
        options.danger ? { dangerIcon: true } : {},
      );

      actions.append(secondaryBtn, primaryBtn);
    } else {
      primaryBtn = document.createElement("button");
      primaryBtn.type = "button";
      primaryBtn.className = "crew-panel__btn crew-panel__btn--primary";
      setGlassButton(primaryBtn, "save", options.okLabel ?? "Aceptar");
      actions.append(primaryBtn);
    }

    dialog.append(title);
    if (body.childNodes.length > 0 || options.body) dialog.append(body);
    if (footer) dialog.append(footer);
    dialog.append(err, actions);
    root.append(scrim, dialog);
    document.body.appendChild(root);

    const unsubIcons = bindGlassIconTheme(root);
    const unwatchBodyScroll = watchGlassModalBodyScrollFade(body);

    /**
     * @param {boolean} confirmed
     */
    const finish = (confirmed) => {
      window.clearTimeout(scrimTimer);
      unwatchBodyScroll();
      unsubIcons();
      window.removeEventListener("keydown", onKey);
      root.remove();
      if (activeRoot === root) activeRoot = null;
      resolve(confirmed);
    };
    // @ts-expect-error stash
    root._finish = finish;

    const onKey = (ev) => {
      if (ev.key !== "Escape" || !closeOnEscape) return;
      ev.preventDefault();
      finish(mode === "confirm" ? false : false);
    };
    window.addEventListener("keydown", onKey);

    let scrimReady = false;
    const scrimTimer = window.setTimeout(() => {
      scrimReady = true;
    }, 320);

    if (closeOnScrim) {
      scrim.addEventListener("click", () => {
        if (!scrimReady) return;
        finish(mode === "confirm" ? false : false);
      });
    }

    if (mode === "confirm" && secondaryBtn) {
      secondaryBtn.addEventListener("click", () => finish(false));
      secondaryBtn.focus();
    } else if (primaryBtn) {
      primaryBtn.focus();
    }

    if (mode === "confirm" && primaryBtn) {
      primaryBtn.addEventListener("click", () => {
        if (!options.onConfirm) {
          finish(true);
          return;
        }
        void (async () => {
          err.hidden = true;
          if (secondaryBtn) secondaryBtn.disabled = true;
          primaryBtn.disabled = true;
          try {
            await options.onConfirm();
            finish(true);
          } catch (caught) {
            const message =
              caught instanceof Error && caught.message
                ? caught.message
                : "No hemos podido completar la acción. Inténtalo de nuevo.";
            err.textContent = message;
            err.hidden = false;
            if (secondaryBtn) secondaryBtn.disabled = false;
            primaryBtn.disabled = false;
          }
        })();
      });
    } else if (primaryBtn) {
      primaryBtn.addEventListener("click", () => finish(false));
    }
  });
}

/** Cierra el modal activo sin confirmar. */
export function closeGlassModal() {
  finishActive(false);
}

/**
 * @param {GlassAlertOptions} options
 * @returns {Promise<void>}
 */
export function showGlassAlert(options) {
  return openGlassModal({
    ...options,
    mode: "alert",
  }).then(() => undefined);
}

/**
 * @param {GlassConfirmOptions} options
 * @returns {Promise<boolean>}
 */
export function showGlassConfirm(options) {
  return openGlassModal({
    ...options,
    mode: "confirm",
  });
}
