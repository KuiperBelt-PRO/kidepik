/**
 * Tema visual de play según mundo del tripulante (≠ tema UI del tutor).
 * @module play-theme
 */

/** @typedef {'fantasy' | 'sci-fi'} PlayWorldTheme */

export const PLAY_WORLD_THEME_CHANGE_EVENT = "kidepik:play-world-theme-change";

/**
 * @param {unknown} value
 * @returns {value is PlayWorldTheme}
 */
export function isPlayWorldTheme(value) {
  return value === "fantasy" || value === "sci-fi";
}

/**
 * @param {PlayWorldTheme | null | undefined} theme
 */
export function applyPlayWorldTheme(theme) {
  const frames = document.querySelectorAll(".section-frame");
  for (const frame of frames) {
    if (!(frame instanceof HTMLElement)) continue;
    if (isPlayWorldTheme(theme)) {
      frame.dataset.playTheme = theme;
    } else {
      delete frame.dataset.playTheme;
    }
  }
  try {
    globalThis.dispatchEvent?.(
      new CustomEvent(PLAY_WORLD_THEME_CHANGE_EVENT, { detail: { theme } }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Tema visual de la ficha tripulante según mundo del niño (≠ tema UI del tutor).
 * @param {PlayWorldTheme | null | undefined} theme
 */
export function applyCrewMemberWorldTheme(theme) {
  const frames = document.querySelectorAll(".section-frame");
  for (const frame of frames) {
    if (!(frame instanceof HTMLElement)) continue;
    if (isPlayWorldTheme(theme)) {
      frame.dataset.crewWorldTheme = theme;
    } else {
      delete frame.dataset.crewWorldTheme;
    }
  }
}
