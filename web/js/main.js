import { registerRoute, startRouter } from "./lib/router.js";
import "./lib/shell-navigation.js";
import { initTheme } from "./lib/theme.js";
import { initShellUiTheme } from "./lib/shell-theme.js";
import { initAppLogger } from "./lib/app-logger.js";
import { renderLoader } from "./scenes/loader.js?v=236";
import { renderAuthCallback } from "./scenes/auth-callback.js?v=184";
import { renderHome } from "./scenes/home.js?v=253";
import { renderAccount } from "./scenes/account.js?v=237";
import { renderSettings } from "./scenes/settings.js?v=244";
import { watchNoSpellcheck } from "./components/glass-controls.js?v=227";
import { renderCrew, renderCrewNew, renderCrewDetail } from "./scenes/crew.js?v=260";
import { renderPlay } from "./scenes/play.js?v=269";
import { renderLegal } from "./scenes/legal.js?v=256";
import {
  readCachedParentSettings,
} from "./lib/parent-settings.js?v=245";
import { ensureDebugAiShellBadge } from "./lib/debug-ai-shell.js?v=1";

watchNoSpellcheck(document.documentElement);

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
  void initAppLogger();
  readCachedParentSettings();
  // Asegurar hash para el router si falta.
  if (!window.location.hash || window.location.hash === "#") {
    window.location.replace(`${window.location.pathname}${window.location.search}#/loader`);
  }
  void ensureDebugAiShellBadge();

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
