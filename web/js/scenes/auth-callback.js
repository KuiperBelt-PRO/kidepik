/**
 * Callback OAuth: mundo del loader + mensaje mientras se completa la sesión.
 * @module scenes/auth-callback
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=164";
import { navigate } from "../lib/router.js";
import { bootstrapParentIfNeeded } from "../lib/parent-account.js";
import { exchangeCodeFromUrl, getValidSession } from "../lib/supabase.js";

const CALLBACK_TIMEOUT_MS = 15_000;

/**
 * @returns {{ destroy: () => void }}
 */
export function renderAuthCallback() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  const chromeHandle = mountLoaderChrome(app, {
    statusMessage: "Completando acceso…",
  });

  let cancelled = false;
  const timeoutId = window.setTimeout(() => {
    if (cancelled) return;
    cancelled = true;
    navigate("/loader");
  }, CALLBACK_TIMEOUT_MS);

  void (async () => {
    await exchangeCodeFromUrl();
    const session = await getValidSession();
    if (cancelled) return;
    window.clearTimeout(timeoutId);
    if (session) {
      await bootstrapParentIfNeeded(session);
      if (cancelled) return;
      navigate("/home");
    } else {
      navigate("/loader");
    }
  })();

  return {
    destroy() {
      cancelled = true;
      window.clearTimeout(timeoutId);
      chromeHandle.destroy();
    },
  };
}
