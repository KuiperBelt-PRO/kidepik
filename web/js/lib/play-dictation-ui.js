/**
 * Copy y helpers del reproductor de dictado en play.
 * @module play-dictation-ui
 */

/**
 * @param {unknown} world
 * @returns {string}
 */
export function startDictationLabel(world) {
  return world === "sci-fi" ? "Sintonizar el parte" : "Escuchar el recado";
}

/**
 * @param {unknown} seconds
 * @returns {string}
 */
export function formatAudioClock(seconds) {
  let n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) n = 0;
  const total = Math.floor(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Segundos restantes con signo menos cuando hay duración.
 * @param {unknown} current
 * @param {unknown} duration
 * @returns {string}
 */
export function formatAudioRemaining(current, duration) {
  const dur = Number(duration);
  const cur = Number(current);
  if (!Number.isFinite(dur) || dur <= 0) return "–:––";
  const left = Math.max(0, dur - (Number.isFinite(cur) ? cur : 0));
  return `−${formatAudioClock(left)}`;
}

/**
 * Vuelve al inicio y deja la locución en pausa.
 * @param {{ pause?: () => void, currentTime?: number } | null | undefined} audio
 */
export function rewindDictationToStart(audio) {
  if (!audio) return;
  if (typeof audio.pause === "function") audio.pause();
  audio.currentTime = 0;
}

/**
 * @param {unknown} world
 * @returns {string[]}
 */
export function dictationWaitFallback(world) {
  if (world === "sci-fi") {
    return ["Ajustando la baliza de transcripción…"];
  }
  return ["El Guía sopla el pergamino antes de dictarlo…"];
}

/**
 * @param {unknown} world
 * @returns {string[]}
 */
export function dictationGradeFallback(world) {
  if (world === "sci-fi") {
    return ["Analizando la captura del recado…"];
  }
  return ["El cronista lee tu letra con calma…"];
}
