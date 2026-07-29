/**
 * Escena Ajustes.
 * @module scenes/settings
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=185";
import { mountSectionFrame } from "../components/section-frame.js?v=185";
import { mountSettingsPanel } from "../components/settings-panel.js?v=221";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=185";
import { navigate } from "../lib/router.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=185";

export function renderSettings() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  /** @type {{ destroy: (o?: object) => void; sectionHost?: HTMLElement } | null} */
  let chromeHandle = null;
  /** @type {{ destroy: () => Promise<void>; contentEl?: HTMLElement; logoMountEl?: HTMLElement } | null} */
  let frameHandle = null;
  /** @type {{ destroy: () => void } | null} */
  let panelHandle = null;
  /** @type {HTMLElement | null} */
  let sceneEl = null;
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
    chromeHandle = mountLoaderChrome(app, { compactSection: true });
    sceneEl = app.querySelector(".scene-loader");
    const host = chromeHandle.sectionHost;
    if (!(host instanceof HTMLElement) || !(sceneEl instanceof HTMLElement)) return;

    frameHandle = mountSectionFrame(host, { ariaLabel: "Ajustes" });
    panelHandle = mountSettingsPanel(frameHandle.contentEl, { session });
    await applySectionEnter({ scene: sceneEl, logoMount: frameHandle.logoMountEl });
  })();

  return {
    destroy(options = {}) {
      cancelled = true;
      panelHandle?.destroy();
      panelHandle = null;
      void frameHandle?.destroy();
      frameHandle = null;
      chromeHandle?.destroy(options);
      chromeHandle = null;
    },
  };
}
