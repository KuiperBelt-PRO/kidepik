/**
 * Home post-login: mismo mundo que el loader + mensaje de bienvenida + shell.
 * @module scenes/home
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=175";
import { resolveDisplayName } from "../components/home-welcome-panel.js";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=175";
import { navigate } from "../lib/router.js";
import { getValidSession, signOut } from "../lib/supabase.js";

/**
 * @returns {{ destroy: () => void }}
 */
export function renderHome() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  /** @type {{ destroy: () => void } | null} */
  let chromeHandle = null;
  let cancelled = false;

  async function doSignOut() {
    destroyAppShell();
    await signOut();
    navigate("/loader");
  }

  void (async () => {
    const session = await getValidSession();
    if (cancelled) return;
    if (!session) {
      destroyAppShell();
      navigate("/loader");
      return;
    }

    const displayName = resolveDisplayName(session);
    ensureAppShell({ onSignOut: doSignOut });

    chromeHandle = mountLoaderChrome(app, {
      welcomeHome: {
        displayName,
      },
    });
  })();

  return {
    destroy() {
      cancelled = true;
      chromeHandle?.destroy();
      chromeHandle = null;
    },
  };
}
