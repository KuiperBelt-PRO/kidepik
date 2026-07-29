/**
 * Pila acotada de navegación shell (atrás / adelante en el marco de sección).
 * @module shell-nav-stack
 */

import { normalizeShellPath } from "./world-band-layout.js";

/** Máximo de entradas en la pila «atrás» (no infinito). */
export const SHELL_NAV_STACK_MAX = 16;

/** @type {(path: string) => void} */
let navigateHash = (path) => {
  if (typeof window === "undefined") return;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.hash = normalized;
};

/**
 * Enlaza la función de navegación hash (inyectada desde router.js).
 * @param {(path: string) => void} fn
 */
export function setShellNavNavigate(fn) {
  navigateHash = fn;
}

/**
 * @returns {string}
 */
function currentHashPath() {
  if (typeof window === "undefined") return "loader";
  let path = (window.location.hash || "#/loader").replace(/^#\/?/, "") || "loader";
  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  return path || "loader";
}

/** @type {string[]} */
let backStack = [];

/** @type {string[]} */
let forwardStack = [];

/** @type {string} */
let currentPath = "loader";

let initialized = false;

/** @type {((state: ShellNavState) => void)[]} */
const listeners = [];

/** @type {((path: string) => void | Promise<void>) | null} */
let shellNavDispatch = null;

/**
 * @typedef {{ current: string; canBack: boolean; canForward: boolean; backDepth: number; forwardDepth: number }} ShellNavState
 */

/**
 * @returns {ShellNavState}
 */
export function getShellNavState() {
  return {
    current: currentPath,
    canBack: backStack.length > 0,
    canForward: forwardStack.length > 0,
    backDepth: backStack.length,
    forwardDepth: forwardStack.length,
  };
}

/**
 * @param {(state: ShellNavState) => void} fn
 * @returns {() => void}
 */
export function subscribeShellNav(fn) {
  listeners.push(fn);
  fn(getShellNavState());
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function notify() {
  const state = getShellNavState();
  for (const fn of listeners) fn(state);
}

function trimBack() {
  while (backStack.length > SHELL_NAV_STACK_MAX) backStack.shift();
}

function trimForward() {
  while (forwardStack.length > SHELL_NAV_STACK_MAX) forwardStack.shift();
}

/**
 * @param {string} fromPath
 * @param {string} toPath
 */
function recordPathChange(fromPath, toPath) {
  const from = normalizeShellPath(fromPath);
  const to = normalizeShellPath(toPath);
  if (from === to) return;

  const backTop = backStack.length > 0 ? normalizeShellPath(backStack[backStack.length - 1]) : "";
  const forwardTop =
    forwardStack.length > 0 ? normalizeShellPath(forwardStack[forwardStack.length - 1]) : "";

  if (backTop && backTop === to) {
    backStack.pop();
    forwardStack.push(from);
    trimForward();
    currentPath = to;
    return;
  }

  if (forwardTop && forwardTop === to) {
    forwardStack.pop();
    backStack.push(from);
    trimBack();
    currentPath = to;
    return;
  }

  backStack.push(from);
  trimBack();
  forwardStack = [];
  currentPath = to;
}

/**
 * Reinicia la pila (p. ej. demo o tests).
 * @param {string} [path]
 */
export function resetShellNavStack(path = currentHashPath()) {
  backStack = [];
  forwardStack = [];
  currentPath = normalizeShellPath(path);
  initialized = true;
  notify();
}

/**
 * Navegación in-frame sin hash (demo / vistas embebidas).
 * @param {(path: string) => void | Promise<void>} fn
 */
export function setShellNavDispatch(fn) {
  shellNavDispatch = fn;
}

/**
 * @param {string} fromPath
 * @param {string} toPath
 */
export function onShellPathChange(fromPath, toPath) {
  if (!initialized) {
    initialized = true;
    currentPath = normalizeShellPath(toPath);
    notify();
    return;
  }

  recordPathChange(fromPath, toPath);
  notify();
}

/**
 * @param {string} path
 */
async function applyShellNavTarget(path) {
  const normalized = normalizeShellPath(path);
  if (shellNavDispatch) {
    await shellNavDispatch(normalized);
    return;
  }
  navigateHash(normalized.startsWith("/") ? normalized : `/${normalized}`);
}

/**
 * @returns {boolean}
 */
export function canShellNavBack() {
  return backStack.length > 0;
}

/**
 * @returns {boolean}
 */
export function canShellNavForward() {
  return forwardStack.length > 0;
}

/**
 * @returns {Promise<boolean>}
 */
export async function shellNavBack() {
  if (!canShellNavBack()) return false;

  const target = backStack[backStack.length - 1];

  if (shellNavDispatch) {
    backStack.pop();
    forwardStack.push(currentPath);
    trimForward();
    currentPath = normalizeShellPath(target);
    await shellNavDispatch(currentPath);
    notify();
    return true;
  }

  await applyShellNavTarget(target);
  return true;
}

/**
 * @returns {Promise<boolean>}
 */
export async function shellNavForward() {
  if (!canShellNavForward()) return false;

  const target = forwardStack[forwardStack.length - 1];

  if (shellNavDispatch) {
    forwardStack.pop();
    backStack.push(currentPath);
    trimBack();
    currentPath = normalizeShellPath(target);
    await shellNavDispatch(currentPath);
    notify();
    return true;
  }

  await applyShellNavTarget(target);
  return true;
}

/**
 * Navegación con registro en pila (subvistas sin router o rutas hash).
 * @param {string} path
 */
export async function navigateShellSubview(path) {
  const from = currentPath;
  const to = normalizeShellPath(path);
  if (from === to) return;

  if (shellNavDispatch) {
    recordPathChange(from, to);
    notify();
    await shellNavDispatch(to);
    return;
  }

  await applyShellNavTarget(to);
}
