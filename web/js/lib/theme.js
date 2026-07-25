/**
 * Tema visual (fantasy | spaceOpera). Persistido en localStorage.
 * @module theme
 */

/** @typedef {'fantasy'|'spaceOpera'} ThemeId */

const STORAGE_KEY = "kidepik-theme";

/** @returns {ThemeId} */
export function getThemeId() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "fantasy" || stored === "spaceOpera") return stored;
  return "fantasy";
}

export function initTheme() {
  const id = getThemeId();
  document.documentElement.dataset.theme = id;
  // Scanlines legacy eliminados: el fondo del producto es el mundo del loader.
  document.body.classList.remove("scanlines");
}
