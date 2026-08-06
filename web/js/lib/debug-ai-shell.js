/**
 * Badge de diagnóstico IA en el shell (FAB cuenta).
 * @module debug-ai-shell
 */

import { setAppShellDebugAiBadge } from "../components/app-shell.js?v=186";
import { openDebugAiPanel } from "../components/debug-ai-panel.js?v=245";
import {
  isDebugAiClientActive,
  setDebugAiClientActive,
  setDebugAiServerAllowed,
} from "./debug-ai.js";
import { fetchDebugAiStatus } from "./debug-ai-api.js";
import { getValidSession } from "./supabase.js";

/**
 * Sincroniza el badge <> sobre cuenta si el modo debug está activo y permitido.
 */
export async function ensureDebugAiShellBadge() {
  if (!isDebugAiClientActive()) {
    setAppShellDebugAiBadge(null);
    return;
  }

  const session = await getValidSession();
  if (!session) return;

  const res = await fetchDebugAiStatus(session);
  if (!res.ok || !res.data?.debug_allowed) {
    setDebugAiClientActive(false);
    setAppShellDebugAiBadge(null);
    return;
  }

  setDebugAiServerAllowed(true);
  setAppShellDebugAiBadge(() => {
    void getValidSession().then((nextSession) => {
      if (nextSession) void openDebugAiPanel({ session: nextSession });
    });
  });
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 */
export function showDebugAiShellBadge(session) {
  setAppShellDebugAiBadge(() => {
    void openDebugAiPanel({ session });
  });
}

export function hideDebugAiShellBadge() {
  setAppShellDebugAiBadge(null);
}
