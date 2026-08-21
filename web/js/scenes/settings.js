/**
 * Escena Ajustes.
 * @module scenes/settings
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=236";
import { mountSectionFrame } from "../components/section-frame.js?v=261";
import { mountSettingsPanel } from "../components/settings-panel.js?v=271";
import { mountCrewSettingsPanel } from "../components/crew-settings-panel.js?v=1";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=281";
import { isCrewSession } from "../lib/session-account.js";
import { navigate } from "../lib/router.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { wrongRoleRedirect } from "../lib/session-account.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=236";

export function renderSettings() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  /** @type {{ destroy: (o?: object) => void; sectionHost?: HTMLElement } | null} */
  let chromeHandle = null;
  /** @type {{
   *   destroy: () => Promise<void>;
   *   contentEl?: HTMLElement;
   *   logoMountEl?: HTMLElement;
   *   syncLogoSkeleton?: (logoWrap?: HTMLElement | null) => void;
   * } | null} */
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
    const bounce = wrongRoleRedirect("settings");
    if (bounce) {
      navigate(bounce);
      return;
    }

    ensureAppShell({ onSignOut: doSignOut });
    chromeHandle = mountLoaderChrome(app, { compactSection: true });
    sceneEl = app.querySelector(".scene-loader");
    const host = chromeHandle.sectionHost;
    if (!(host instanceof HTMLElement) || !(sceneEl instanceof HTMLElement)) return;

    frameHandle = mountSectionFrame(host, { title: "Ajustes", ariaLabel: "Ajustes" });
    panelHandle = isCrewSession()
      ? mountCrewSettingsPanel(frameHandle.contentEl, { session })
      : mountSettingsPanel(frameHandle.contentEl, { session });
    await applySectionEnter({
      scene: sceneEl,
      logoMount: frameHandle.logoMountEl,
      onLogoSettled: (logoWrap) => frameHandle?.syncLogoSkeleton?.(logoWrap),
    });
    frameHandle.syncLogoSkeleton?.();
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
