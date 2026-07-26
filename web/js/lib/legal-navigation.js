/**
 * Navegación y transiciones hacia/desde pantallas legales.
 * @module legal-navigation
 */

import { captureRect, prepareWorldTransition } from "./world-transition.js";
import { hashRoutePath, navigate } from "./router.js";

/** @typedef {'authenticated-home' | 'auth-handoff'} LegalBackMode */

/** @typedef {'auth' | 'home' | 'account' | 'shell'} LegalTransitionSource */

/** @type {((path: string) => void | Promise<void>) | null} */
let legalExitHandler = null;

/**
 * @param {boolean} hasSession
 * @returns {{ mode: LegalBackMode; path: string }}
 */
export function resolveLegalBackNavigation(hasSession) {
  if (hasSession) {
    return { mode: "authenticated-home", path: "/home" };
  }
  return { mode: "auth-handoff", path: "/loader" };
}

/**
 * @param {{ snapshot: { logo?: unknown; from?: string } | null; intent: { to?: string; from?: string } | null }} transition
 * @returns {boolean}
 */
export function shouldAnimateLegalEntry(transition) {
  return transition.intent?.to === "legal" && Boolean(transition.snapshot?.logo);
}

/**
 * @param {{ snapshot: { bandsAlreadyExpanded?: boolean } | null; intent: { resumeShell?: boolean } | null }} transition
 * @returns {boolean}
 */
export function shouldResumeShellTransition(transition) {
  return transition.intent?.resumeShell === true
    && transition.snapshot?.bandsAlreadyExpanded === true;
}

/**
 * @returns {boolean}
 */
export function isLegalRoutePath(path = hashRoutePath()) {
  return path.startsWith("legal/");
}

/**
 * @param {(path: string) => void | Promise<void>} handler
 * @returns {() => void}
 */
export function registerLegalExitHandler(handler) {
  legalExitHandler = handler;
  return () => {
    if (legalExitHandler === handler) legalExitHandler = null;
  };
}

/**
 * Navega saliendo de legal con animación si hay handler registrado.
 * @param {string} path
 */
export async function navigateFromLegal(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (legalExitHandler && isLegalRoutePath()) {
    await legalExitHandler(normalized);
    return;
  }
  navigate(normalized);
}

/**
 * Prepara transición animada (bandas + logo) antes de `navigate` a legal.
 * @param {LegalTransitionSource} [from]
 */
export function prepareLegalNavigation(from = "shell") {
  const logo = document.querySelector(".loader-auth-brand .loader-logo-wrap")
    ?? document.querySelector(".scene-loader .loader-logo-wrap");
  prepareWorldTransition(
    {
      logo: captureRect(logo),
      from,
      spaceBand: 0.48,
      fantasyBand: 0.52,
    },
    { to: "legal", from },
  );
}

/**
 * Marca handoff post-expansión de bandas + logo (legal autenticado → shell).
 * @param {string} path
 * @param {{ logo?: { left: number; top: number; width: number; height: number } | null; logoEl?: HTMLElement | null }} [extras]
 */
export function prepareAuthenticatedLegalExit(path, extras = {}) {
  const route = path.replace(/^#\/?/, "").replace(/^\//, "").split("/")[0] || "home";
  prepareWorldTransition(
    {
      from: "legal",
      bandsAlreadyExpanded: true,
      logo: extras.logo ?? null,
      logoEl: extras.logoEl ?? null,
    },
    { to: route, from: "legal", resumeShell: true },
  );
}

/**
 * Resuelve el origen de la transición legal según la ruta actual.
 * @param {string} [path]
 * @returns {LegalTransitionSource}
 */
export function legalTransitionSourceFromPath(path = "") {
  const normalized = path.replace(/^#\/?/, "").split("?")[0] || "loader";
  if (normalized === "home") return "home";
  if (normalized === "account") return "account";
  if (normalized === "loader" || normalized === "auth" || normalized.startsWith("auth/")) return "auth";
  return "shell";
}
