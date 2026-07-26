import { registerRoute, startRouter } from "./lib/router.js";
import { initTheme } from "./lib/theme.js";
import { initShellUiTheme } from "./lib/shell-theme.js";
import { renderLoader } from "./scenes/loader.js?v=182";
import { renderAuthCallback } from "./scenes/auth-callback.js?v=182";
import { renderHome } from "./scenes/home.js?v=182";
import { renderAccount } from "./scenes/account.js?v=182";
import { renderLegal } from "./scenes/legal.js?v=182";

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
  initShellUiTheme();

  registerRoute("loader", () => renderLoader());
  // Deep-link / fallback OAuth: auth embebido vive en el loader (no escena standalone).
  registerRoute("auth", () => renderLoader());
  registerRoute("auth/callback", () => renderAuthCallback());
  registerRoute("home", () => renderHome());
  registerRoute("account", () => renderAccount());
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
