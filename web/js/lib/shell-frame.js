/**
 * Sincroniza el overlay del shell con el rect real de `#app`.
 * Necesario porque loader/legal/home quitan `max-width: 430px` de `#app`.
 * @module shell-frame
 */

/** @type {ResizeObserver | null} */
let resizeObserver = null;

/** @type {(() => void) | null} */
let onWindowResize = null;

/** @type {HTMLElement | null} */
let boundShellRoot = null;

/**
 * @param {HTMLElement} shellRoot
 */
export function bindShellFrame(shellRoot) {
  unbindShellFrame();
  boundShellRoot = shellRoot;

  const sync = () => {
    const app = document.getElementById("app");
    if (!app || !boundShellRoot?.isConnected) return;

    const rect = app.getBoundingClientRect();
    const width = Math.max(0, Math.round(rect.width));
    const height = Math.max(0, Math.round(rect.height));
    const top = Math.max(0, Math.round(rect.top));
    const left = Math.max(0, Math.round(rect.left));

    boundShellRoot.style.top = `${top}px`;
    boundShellRoot.style.left = `${left}px`;
    boundShellRoot.style.width = `${width}px`;
    boundShellRoot.style.height = `${height}px`;
    boundShellRoot.style.maxWidth = "none";
    boundShellRoot.style.transform = "none";
    boundShellRoot.style.setProperty("--shell-app-width", `${width}px`);
  };

  sync();
  requestAnimationFrame(sync);
  requestAnimationFrame(() => requestAnimationFrame(sync));

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(sync);
    const app = document.getElementById("app");
    if (app) resizeObserver.observe(app);
  }

  onWindowResize = sync;
  window.addEventListener("resize", onWindowResize, { passive: true });
  window.addEventListener("orientationchange", onWindowResize, { passive: true });
  if (document.fonts?.ready) {
    void document.fonts.ready.then(sync);
  }
}

/** Re-sincroniza el frame si el shell ya está montado. */
export function syncShellFrameNow() {
  if (!boundShellRoot?.isConnected) return;
  const app = document.getElementById("app");
  if (!app) return;
  const rect = app.getBoundingClientRect();
  boundShellRoot.style.top = `${Math.round(rect.top)}px`;
  boundShellRoot.style.left = `${Math.round(rect.left)}px`;
  boundShellRoot.style.width = `${Math.round(rect.width)}px`;
  boundShellRoot.style.height = `${Math.round(rect.height)}px`;
  boundShellRoot.style.maxWidth = "none";
  boundShellRoot.style.transform = "none";
  boundShellRoot.style.setProperty("--shell-app-width", `${Math.round(rect.width)}px`);
}

export function unbindShellFrame() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  boundShellRoot = null;
  if (onWindowResize) {
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("orientationchange", onWindowResize);
    onWindowResize = null;
  }
}
