/**
 * Bucle de animación único para el loader (evita docenas de requestAnimationFrame).
 *
 * @module loader-animation-frame
 */

/** @typedef {(now: number, dt: number) => void} LoaderFrameCallback */

/** @type {Set<LoaderFrameCallback>} */
const subscribers = new Set();

let rafId = 0;
let lastNow = 0;
let running = false;

function pump(now) {
  if (!running) return;
  const dt = lastNow > 0 ? Math.min(48, now - lastNow) : 16;
  lastNow = now;
  for (const fn of subscribers) {
    fn(now, dt);
  }
  rafId = requestAnimationFrame(pump);
}

function ensureRunning() {
  if (running || subscribers.size === 0) return;
  if (typeof requestAnimationFrame !== "function") return;
  if (typeof document !== "undefined" && document.hidden) return;
  running = true;
  lastNow = 0;
  rafId = requestAnimationFrame(pump);
}

function stopIfIdle() {
  if (subscribers.size > 0) return;
  running = false;
  lastNow = 0;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

/**
 * @param {LoaderFrameCallback} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeLoaderAnimationFrame(callback) {
  subscribers.add(callback);
  ensureRunning();
  return () => {
    subscribers.delete(callback);
    stopIfIdle();
  };
}

/** Solo tests. */
export function resetLoaderAnimationFrameForTests() {
  running = false;
  lastNow = 0;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  subscribers.clear();
}

/** Solo tests. */
export function loaderAnimationFrameSubscriberCount() {
  return subscribers.size;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      return;
    }
    ensureRunning();
  });
}
