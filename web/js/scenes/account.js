/**
 * Pantalla de cuenta padre/tutor.
 * @module scenes/account
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=183";
import { mountSectionFrame } from "../components/section-frame.js?v=183";
import { mountAccountPanel } from "../components/account-panel.js?v=183";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=183";
import { navigate } from "../lib/router.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=183";

/**
 * @returns {{ destroy: () => void }}
 */
export function renderAccount() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  /** @type {{ destroy: () => void; sectionHost?: HTMLElement } | null} */
  let chromeHandle = null;
  /** @type {{ destroy: () => Promise<void>; logoMountEl?: HTMLElement } | null} */
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

  async function afterDeleted() {
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
    if (!(host instanceof HTMLElement) || !(sceneEl instanceof HTMLElement)) {
      console.warn("account: missing section host or scene");
      return;
    }

    frameHandle = mountSectionFrame(host, { ariaLabel: "Cuenta" });
    panelHandle = mountAccountPanel(frameHandle.contentEl, {
      session,
      onDeleted: afterDeleted,
    });

    await applySectionEnter({
      scene: sceneEl,
      logoMount: frameHandle.logoMountEl,
    });
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
      sceneEl = null;
    },
  };
}
