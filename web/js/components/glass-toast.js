/**
 * Notificaciones flotantes glass reutilizables.
 * @module glass-toast
 */

import { createGlassIconSvg } from "./glass-controls.js";

/** @typedef {'error' | 'warning' | 'success' | 'info'} GlassToastVariant */

const ICON_BY_VARIANT = Object.freeze({
  error: "danger",
  warning: "note",
  success: "save",
  info: "note",
});

const FILL_BY_VARIANT = Object.freeze({
  error: "#FF6B63",
  warning: "#FFD166",
  success: "#7BE495",
  info: "#FFFFFF",
});

/** @type {HTMLElement | null} */
let hostEl = null;

function ensureHost() {
  if (hostEl?.isConnected) return hostEl;
  hostEl = document.getElementById("glass-toast-host");
  if (hostEl instanceof HTMLElement) return hostEl;

  hostEl = document.createElement("div");
  hostEl.id = "glass-toast-host";
  hostEl.className = "glass-toast-host";
  hostEl.setAttribute("aria-live", "polite");
  document.body.appendChild(hostEl);
  return hostEl;
}

/**
 * @param {string} message
 * @param {{ variant?: GlassToastVariant; durationMs?: number; persist?: boolean }} [opts]
 */
export function showGlassToast(message, opts = {}) {
  const variant = opts.variant ?? "info";
  const persist =
    opts.persist ?? (variant === "error" && opts.durationMs === undefined);
  const durationMs = persist ? 0 : (opts.durationMs ?? 5200);
  const host = ensureHost();

  const toast = document.createElement("div");
  toast.className = `glass-toast glass-toast--${variant}`;
  toast.setAttribute("role", variant === "error" ? "alert" : "status");

  const iconWrap = document.createElement("span");
  iconWrap.className = "glass-toast__icon";
  iconWrap.appendChild(
    createGlassIconSvg(ICON_BY_VARIANT[variant], {
      size: 18,
      fill: FILL_BY_VARIANT[variant],
    }),
  );

  const bodyWrap = document.createElement("div");
  bodyWrap.className = "glass-toast__body";

  const body = document.createElement("p");
  body.className = "glass-toast__text";
  body.textContent = message;
  bodyWrap.appendChild(body);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "glass-toast__close";
  closeBtn.setAttribute("aria-label", "Cerrar notificación");
  closeBtn.appendChild(createGlassIconSvg("close", { size: 14, fill: "#FFFFFF" }));

  toast.append(iconWrap, bodyWrap, closeBtn);
  host.appendChild(toast);

  const remove = () => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 220);
  };

  /** @type {number | undefined} */
  let timer;
  if (durationMs > 0) {
    timer = window.setTimeout(remove, durationMs);
  }

  closeBtn.addEventListener("click", () => {
    if (timer) window.clearTimeout(timer);
    remove();
  });

  return remove;
}

/**
 * @param {string} code
 * @returns {string}
 */
export function mapPlayApiError(code) {
  switch (code) {
    case "display_name invalid":
    case "display_name invalid characters":
      return "Ese nombre no es válido. Usa solo letras, números y espacios (máx. 24).";
    case "display_name too long":
      return "El nombre es demasiado largo. Máximo 24 caracteres.";
    case "species invalid":
      return "No hemos entendido tu criatura. Escríbela en pocas palabras o elige una opción.";
    case "reply empty":
      return "Escribe una respuesta antes de enviar.";
    case "session not found":
      return "La sesión de diálogo ha caducado. Vuelve a entrar en la aventura.";
    case "session_expired":
      return "Tu sesión ha caducado. Vuelve al inicio e inicia sesión de nuevo.";
    case "Invalid token: Supabase auth rejected":
      return "Tu sesión ha caducado. Vuelve al inicio e inicia sesión de nuevo.";
    case "Invalid token: Supabase auth unreachable":
      return "No se pudo verificar la sesión. Comprueba que Supabase local está activo y reintenta.";
    case "world_theme locked":
      return "El mundo ya está bloqueado y no se puede cambiar desde la aventura.";
    case "invalid_json":
      return "La respuesta del servidor no se pudo leer. Reintenta o recarga la aventura.";
    case "transport":
      return "No se pudo continuar. Reintenta.";
    default:
      return code && code !== "turn" ? code : "No se pudo continuar. Reintenta.";
  }
}
