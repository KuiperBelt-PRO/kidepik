import { registerRoute, startRouter } from "./lib/router.js";
import { initTheme } from "./lib/theme.js";
import { renderLoader } from "./scenes/loader.js?v=147";
import { renderAuth } from "./scenes/auth.js";
import { renderAuthCallback } from "./scenes/auth-callback.js";
import { renderHome } from "./scenes/home.js";
import { renderLegal } from "./scenes/legal.js?v=147";

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
  registerRoute("auth", () => renderAuth());
  registerRoute("auth/callback", () => renderAuthCallback());
  registerRoute("home", () => renderHome());
  registerRoute("legal/terminos", () => renderLegal({ slug: "terminos" }));
  registerRoute("legal/privacidad", () => renderLegal({ slug: "privacidad" }));

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
