import { registerRoute, startRouter } from "./lib/router.js";
import { initTheme } from "./lib/theme.js";
import { renderLoader } from "./scenes/loader.js";
import { renderGallery } from "./scenes/gallery.js";
import { renderWorldPicker } from "./scenes/world-picker.js";
import { renderMockup } from "./scenes/mockup.js";
import { renderPoc } from "./scenes/poc.js";

function updateOfflineBanner() {
  const banner = document.getElementById("offline-banner");
  if (banner) {
    banner.classList.toggle("is-visible", !navigator.onLine);
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("SW registration failed", e);
  }
}

function boot() {
  initTheme();

  registerRoute("loader", () => renderLoader());
  registerRoute("gallery", () => renderGallery());
  registerRoute("world-picker", () => renderWorldPicker());
  registerRoute("mockup/:id", ({ id }) => renderMockup(id));
  registerRoute("poc", () => renderPoc());

  startRouter();

  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);
  updateOfflineBanner();

  void registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
