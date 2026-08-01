/**
 * Escenas Tripulación (lista / alta / ficha).
 * @module scenes/crew
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=236";
import { mountSectionFrame } from "../components/section-frame.js?v=236";
import { mountCrewListPanel, mountCrewNewPanel, mountCrewDetailPanel } from "../components/crew-panel.js?v=246";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=185";
import { navigate } from "../lib/router.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=236";

/**
 * @param {'list'|'new'|'detail'} mode
 * @param {{ childId?: string }} [opts]
 */
function renderCrewMode(mode, opts = {}) {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  /** @type {{ destroy: (o?: object) => void; sectionHost?: HTMLElement } | null} */
  let chromeHandle = null;
  /** @type {{
   *   destroy: () => Promise<void>;
   *   contentEl?: HTMLElement;
   *   logoMountEl?: HTMLElement;
   *   setTitle?: (text: string) => void;
   *   syncLogoSkeleton?: (logoWrap?: HTMLElement | null) => void;
   * } | null} */
  let frameHandle = null;
  /** @type {{ destroy: () => void } | null} */
  let panelHandle = null;
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
    const sceneEl = app.querySelector(".scene-loader");
    const host = chromeHandle.sectionHost;
    if (!(host instanceof HTMLElement) || !(sceneEl instanceof HTMLElement)) return;

    const title =
      mode === "new" ? "Nuevo tripulante" : mode === "detail" ? "Tripulante" : "Tripulación";
    frameHandle = mountSectionFrame(host, { title, ariaLabel: title });

    if (mode === "new") {
      panelHandle = mountCrewNewPanel(frameHandle.contentEl, { session });
    } else if (mode === "detail" && opts.childId) {
      panelHandle = mountCrewDetailPanel(frameHandle.contentEl, {
        session,
        childId: opts.childId,
        onTitleChange: (next) => frameHandle?.setTitle?.(next),
      });
    } else {
      panelHandle = mountCrewListPanel(frameHandle.contentEl, { session });
    }

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

export function renderCrew() {
  return renderCrewMode("list");
}

export function renderCrewNew() {
  return renderCrewMode("new");
}

/**
 * @param {{ id: string }} params
 */
export function renderCrewDetail(params) {
  return renderCrewMode("detail", { childId: params.id });
}
