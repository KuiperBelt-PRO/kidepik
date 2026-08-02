import { registerRoute, startRouter } from "./lib/router.js";
import "./lib/shell-navigation.js";
import { initTheme } from "./lib/theme.js";
import { initShellUiTheme } from "./lib/shell-theme.js";
import { initAppLogger } from "./lib/app-logger.js";
import { renderLoader } from "./scenes/loader.js?v=236";
import { renderAuthCallback } from "./scenes/auth-callback.js?v=184";
import { renderHome } from "./scenes/home.js?v=236";
import { renderAccount } from "./scenes/account.js?v=237";
import { renderSettings } from "./scenes/settings.js?v=236";
import { renderCrew, renderCrewNew, renderCrewDetail } from "./scenes/crew.js?v=237";
import { renderPlay } from "./scenes/play.js?v=249";
import { renderLegal } from "./scenes/legal.js?v=184";
import {
  initDebugAiFromUrl,
  isDebugAiClientActive,
  setDebugAiClientActive,
  setDebugAiServerAllowed,
} from "./lib/debug-ai.js?v=243";
import { fetchDebugAiStatus } from "./lib/debug-ai-api.js?v=243";
import { mountDebugAiFab, openDebugAiPanel } from "./components/debug-ai-panel.js?v=243";
import { getValidSession } from "./lib/supabase.js";

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
  initDebugAiFromUrl();
  // Tras ?debugAi=1, conservar query en la URL pero asegurar hash para el router.
  if (!window.location.hash || window.location.hash === "#") {
    window.location.replace(`${window.location.pathname}${window.location.search}#/loader`);
  }
  void bootstrapDebugAiFab();

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

async function bootstrapDebugAiFab() {
  if (!isDebugAiClientActive()) return;
  const session = await getValidSession();
  if (!session) return;
  const res = await fetchDebugAiStatus(session);
  if (!res.ok || !res.data?.debug_allowed) {
    setDebugAiClientActive(false);
    return;
  }
  setDebugAiServerAllowed(true);
  mountDebugAiFab(() => {
    void openDebugAiPanel({ session });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
