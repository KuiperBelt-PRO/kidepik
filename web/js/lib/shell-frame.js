/**
 * Sincroniza el overlay del shell con el rect real de `#app`.
 * Necesario porque loader/legal/home quitan `max-width: 430px` de `#app`.
 * @module shell-frame
 */

/** @type {ResizeObserver | null} */
let resizeObserver = null;

/** @type {MutationObserver | null} */
let mutationObserver = null;

/** @type {(() => void) | null} */
let onWindowResize = null;

/** @type {HTMLElement | null} */
let boundShellRoot = null;

/** @type {number} */
let syncRafId = 0;

/**
 * @param {HTMLElement} shellRoot
 * @param {HTMLElement} app
 */
function applyShellFrame(shellRoot, app) {
  const rect = app.getBoundingClientRect();
  const width = Math.max(0, Math.round(rect.width));
  const height = Math.max(0, Math.round(rect.height));
  const top = Math.max(0, Math.round(rect.top));
  const left = Math.max(0, Math.round(rect.left));

  shellRoot.style.top = `${top}px`;
  shellRoot.style.left = `${left}px`;
  shellRoot.style.width = `${width}px`;
  shellRoot.style.height = `${height}px`;
  shellRoot.style.maxWidth = "none";
  shellRoot.style.transform = "none";
  shellRoot.style.setProperty("--shell-app-width", `${width}px`);
}

function syncFrame() {
  const app = document.getElementById("app");
  if (!app || !boundShellRoot?.isConnected) return;
  applyShellFrame(boundShellRoot, app);
}

/** Re-sincroniza el frame si el shell ya está montado. */
export function syncShellFrameNow() {
  syncFrame();
}

/** Re-sincroniza tras cambios de layout del DOM (coalescido a un rAF). */
export function scheduleShellFrameSync() {
  if (!boundShellRoot?.isConnected) return;
  if (syncRafId) return;
  syncRafId = requestAnimationFrame(() => {
    syncRafId = 0;
    syncFrame();
    requestAnimationFrame(syncFrame);
  });
}

/**
 * @param {HTMLElement} shellRoot
 */
export function bindShellFrame(shellRoot) {
  unbindShellFrame();
  boundShellRoot = shellRoot;

  scheduleShellFrameSync();

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleShellFrameSync);
    const app = document.getElementById("app");
    if (app) resizeObserver.observe(app);
  }

  if (typeof MutationObserver !== "undefined") {
    const app = document.getElementById("app");
    if (app) {
      mutationObserver = new MutationObserver(() => scheduleShellFrameSync());
      mutationObserver.observe(app, { childList: true });
    }
  }

  onWindowResize = scheduleShellFrameSync;
  window.addEventListener("resize", onWindowResize, { passive: true });
  window.addEventListener("orientationchange", onWindowResize, { passive: true });
  if (document.fonts?.ready) {
    void document.fonts.ready.then(scheduleShellFrameSync);
  }
}

export function unbindShellFrame() {
  if (syncRafId) {
    cancelAnimationFrame(syncRafId);
    syncRafId = 0;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
  mutationObserver?.disconnect();
  mutationObserver = null;
  boundShellRoot = null;
  if (onWindowResize) {
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("orientationchange", onWindowResize);
    onWindowResize = null;
  }
}
