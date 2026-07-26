/**
 * Pantalla stub de cuenta padre/tutor.
 * @module scenes/account
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=175";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=175";
import { navigate } from "../lib/router.js";
import { getValidSession, signOut } from "../lib/supabase.js";

/**
 * @returns {{ destroy: () => void }}
 */
export function renderAccount() {
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

    ensureAppShell({ onSignOut: doSignOut });

    chromeHandle = mountLoaderChrome(app, {
      welcomeHome: {
        displayName: "cuenta",
        lineSci: "Tu cuenta",
        lineFantasy: "gestión del viaje (próximamente)",
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
