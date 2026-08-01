/**
 * Home post-login: mismo mundo que el loader + mensaje de bienvenida + shell.
 * @module scenes/home
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=236";
import { resolveDisplayName } from "../components/home-welcome-panel.js";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=183";
import { navigate } from "../lib/router.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { fetchParentMe } from "../lib/parent-account.js?v=183";
import { resolveAccountDisplayName } from "../lib/account-display-name.js?v=183";

/**
 * @returns {{ destroy: (options?: { worldHandoff?: boolean }) => void }}
 */
export function renderHome() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  /** @type {{ destroy: (options?: { worldHandoff?: boolean }) => void } | null} */
  let chromeHandle = null;
  /** @type {{ destroy: () => void; updateDisplayName?: (name: string) => void } | null} */
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

    // Montar YA con el nombre de sesión: no bloquear el handoff del mundo
    // esperando /parents/me (eso provocaba #app vacío → parpadeo negro).
    const displayName = resolveDisplayName(session);
    ensureAppShell({ onSignOut: doSignOut });

    chromeHandle = mountLoaderChrome(app, {
      welcomeHome: {
        displayName,
      },
    });

    void fetchParentMe(session).then((me) => {
      if (cancelled || !me.ok) return;
      const next = resolveAccountDisplayName(me.parent, session);
      const sci = app.querySelector(".loader-home-welcome__sci");
      if (sci instanceof HTMLElement && next) {
        // El panel usa "Hola, {name}," en fantasy/sci lines — actualizar si cambió.
        const current = sci.textContent || "";
        if (current.includes(displayName) && displayName !== next) {
          sci.textContent = current.replace(displayName, next);
        }
      }
    });
  })();

  return {
    destroy(options = {}) {
      cancelled = true;
      chromeHandle?.destroy(options);
      chromeHandle = null;
    },
  };
}
