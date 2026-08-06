import { mountLoaderChrome } from "../components/loader-chrome.js?v=236";
import { destroyAppShell } from "../components/app-shell.js?v=186";

/**
 * @returns {Promise<boolean>}
 */
async function pingHealth() {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @returns {{ destroy: () => void }}
 */
export function renderLoader() {
  destroyAppShell();
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  return mountLoaderChrome(app, { pingHealth });
}
