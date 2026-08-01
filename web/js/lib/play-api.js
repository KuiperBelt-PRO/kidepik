/**
 * Cliente API diálogo de play.
 * @module play-api
 */

import { debugAiRequestHeaders } from "./debug-ai.js";
import { appLogApi } from "./app-logger.js";
import { getValidSession } from "./supabase.js";

/**
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
async function requirePlaySession() {
  return getValidSession();
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 * @param {string} [flowId]
 */
export async function openDialogueSession(_session, childId, flowId = "first_run") {
  try {
    const session = await requirePlaySession();
    if (!session) {
      appLogApi("play/dialogue/session", 401, { child_id: childId, error: "session_expired" });
      return { ok: false, status: 401, error: "session_expired" };
    }
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/play/${encodeURIComponent(childId)}/dialogue/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...debugAiRequestHeaders(),
      },
      body: JSON.stringify({ flow_id: flowId }),
    });
    if (!res.ok) {
      appLogApi("play/dialogue/session", res.status, { child_id: childId });
      return { ok: false, status: res.status };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    console.warn("play session error", err);
    appLogApi("play/dialogue/session", 0, { child_id: childId, transport: true });
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 * @param {string} sessionId
 * @param {{ kind: string, option_id?: string, text?: string }} reply
 */
export async function submitDialogueTurn(_session, childId, sessionId, reply) {
  try {
    const session = await requirePlaySession();
    if (!session) {
      appLogApi("play/dialogue/turn", 401, {
        child_id: childId,
        session_id: sessionId,
        error: "session_expired",
      });
      return { ok: false, status: 401, error: "session_expired" };
    }
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/play/${encodeURIComponent(childId)}/dialogue/turn`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...debugAiRequestHeaders(),
      },
      body: JSON.stringify({ session_id: sessionId, reply }),
    });
    if (!res.ok) {
      let detail = "turn";
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch {
        /* ignore */
      }
      appLogApi("play/dialogue/turn", res.status, { child_id: childId, session_id: sessionId, error: detail });
      return { ok: false, status: res.status, error: detail };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    console.warn("play turn error", err);
    appLogApi("play/dialogue/turn", 0, { child_id: childId, transport: true });
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 * @param {{ cursor?: string, limit?: number }} [opts]
 */
export async function fetchJourneyTimeline(_session, childId, opts = {}) {
  try {
    const session = await requirePlaySession();
    if (!session) {
      return { ok: false, status: 401, error: "session_expired" };
    }
    const { config } = await import("../config.js");
    const q = new URLSearchParams();
    if (opts.cursor) q.set("cursor", opts.cursor);
    if (opts.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    const res = await fetch(
      `${config.apiUrl}/play/${encodeURIComponent(childId)}/journey/timeline${qs ? `?${qs}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...debugAiRequestHeaders(),
        },
      },
    );
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    console.warn("journey timeline error", err);
    return { ok: false };
  }
}
