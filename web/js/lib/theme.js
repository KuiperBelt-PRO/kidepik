/** @typedef {'fantasy'|'spaceOpera'} ThemeId */

const STORAGE_KEY = "kidepik-theme";

/** @type {Record<ThemeId, { worldName: string, progressUnit: string, hintLabel: string, continueLabel: string, retroScanlines: boolean }>} */
export const THEME_LABELS = {
  fantasy: {
    worldName: "Reinos Unidos",
    progressUnit: "Runa",
    hintLabel: "Pista del sabio",
    continueLabel: "Continuar",
    retroScanlines: false,
  },
  spaceOpera: {
    worldName: "Sector Alfa",
    progressUnit: "Módulo",
    hintLabel: "Datos del navegador",
    continueLabel: "Continuar",
    retroScanlines: true,
  },
};

const LOADER_PHRASES = {
  fantasy: [
    "Despertando las runas del bosque…",
    "Las luciérnagas doradas guían el camino…",
    "El reino verde te espera…",
  ],
  spaceOpera: [
    "Calibrando motores de curvatura…",
    "Sincronizando mapa estelar…",
    "Bienvenido a la flota azul…",
  ],
};

/** @returns {ThemeId} */
export function getThemeId() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "fantasy" || stored === "spaceOpera") return stored;
  return "fantasy";
}

/** @param {ThemeId} id */
export function setThemeId(id) {
  localStorage.setItem(STORAGE_KEY, id);
  document.documentElement.dataset.theme = id;
  document.body.classList.toggle("scanlines", id === "spaceOpera");
  window.dispatchEvent(new CustomEvent("kidepik:theme", { detail: { id } }));
}

export function initTheme() {
  const id = getThemeId();
  document.documentElement.dataset.theme = id;
  document.body.classList.toggle("scanlines", id === "spaceOpera");
}

export function getLabels() {
  return THEME_LABELS[getThemeId()];
}

export function getLoaderPhrases() {
  return LOADER_PHRASES[getThemeId()];
}
