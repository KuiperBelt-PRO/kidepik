/**
 * Home post-login: mismo mundo que el loader + mensaje de bienvenida.
 * @module scenes/home
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=164";
import {
  mountHomeWelcomePanel,
  resolveDisplayName,
} from "../components/home-welcome-panel.js";
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

  void (async () => {
    const session = await getValidSession();
    if (cancelled) return;
    if (!session) {
      navigate("/loader");
      return;
    }

    const displayName = resolveDisplayName(session);
    chromeHandle = mountLoaderChrome(app, {
      welcomeHome: {
        displayName,
        async onSignOut() {
          await signOut();
          navigate("/loader");
        },
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
