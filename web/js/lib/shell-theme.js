/**
 * Tema UI del shell post-login (sci-fi | fantasy).
 * Independiente del tema de mundo de cada niño.
 * @module shell-theme
 */

/** @typedef {'sci-fi' | 'fantasy'} ShellUiTheme */

export const SHELL_UI_THEME_STORAGE_KEY = "kidepik.shell.uiTheme";
export const DEFAULT_SHELL_UI_THEME = /** @type {ShellUiTheme} */ ("fantasy");

/**
 * @param {unknown} value
 * @returns {value is ShellUiTheme}
 */
export function isShellUiTheme(value) {
  return value === "sci-fi" || value === "fantasy";
}

/**
 * @returns {ShellUiTheme}
 */
export function getShellUiTheme() {
  try {
    const stored = globalThis.localStorage?.getItem(SHELL_UI_THEME_STORAGE_KEY);
    if (isShellUiTheme(stored)) return stored;
  } catch {
    /* private mode / node */
  }
  return DEFAULT_SHELL_UI_THEME;
}

/**
 * @param {ShellUiTheme} theme
 */
export function applyShellUiTheme(theme) {
  const next = isShellUiTheme(theme) ? theme : DEFAULT_SHELL_UI_THEME;
  try {
    if (globalThis.document?.documentElement) {
      globalThis.document.documentElement.dataset.shellTheme = next;
    }
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * @param {ShellUiTheme} theme
 * @returns {ShellUiTheme}
 */
export function setShellUiTheme(theme) {
  const next = applyShellUiTheme(theme);
  try {
    globalThis.localStorage?.setItem(SHELL_UI_THEME_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * @returns {ShellUiTheme}
 */
export function toggleShellUiTheme() {
  const next = getShellUiTheme() === "sci-fi" ? "fantasy" : "sci-fi";
  return setShellUiTheme(next);
}

/**
 * Aplica el tema persistido al documento (boot / remount).
 * @returns {ShellUiTheme}
 */
export function initShellUiTheme() {
  return applyShellUiTheme(getShellUiTheme());
}
