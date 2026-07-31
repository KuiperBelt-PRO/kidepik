import { registerRoute, startRouter } from "./lib/router.js";
import "./lib/shell-navigation.js";
import { initTheme } from "./lib/theme.js";
import { initShellUiTheme } from "./lib/shell-theme.js";
import { renderLoader } from "./scenes/loader.js?v=184";
import { renderAuthCallback } from "./scenes/auth-callback.js?v=184";
import { renderHome } from "./scenes/home.js?v=184";
import { renderAccount } from "./scenes/account.js?v=184";
import { renderSettings } from "./scenes/settings.js?v=221";
import { renderCrew, renderCrewNew, renderCrewDetail } from "./scenes/crew.js?v=233";
import { renderPlay } from "./scenes/play.js?v=8";
import { renderLegal } from "./scenes/legal.js?v=184";

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
  registerRoute("settings", () => renderSettings());
  registerRoute("crew", () => renderCrew());
  registerRoute("crew/new", () => renderCrewNew());
  registerRoute("crew/:id", (params) => renderCrewDetail(params));
  registerRoute("play/:childId", (params) => renderPlay({ childId: params.childId }));
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
