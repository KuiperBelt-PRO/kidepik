/**
 * Cliente API diálogo de play.
 * @module play-api
 */

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 * @param {string} [flowId]
 */
export async function openDialogueSession(session, childId, flowId = "first_run") {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/play/${encodeURIComponent(childId)}/dialogue/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ flow_id: flowId }),
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    console.warn("play session error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 * @param {string} sessionId
 * @param {{ kind: string, option_id?: string, text?: string }} reply
 */
export async function submitDialogueTurn(session, childId, sessionId, reply) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/play/${encodeURIComponent(childId)}/dialogue/turn`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
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
      return { ok: false, status: res.status, error: detail };
    }
    return { ok: true, data: await res.json() };
  } catch (err) {
    console.warn("play turn error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 * @param {{ cursor?: string, limit?: number }} [opts]
 */
export async function fetchJourneyTimeline(session, childId, opts = {}) {
  try {
    const { config } = await import("../config.js");
    const q = new URLSearchParams();
    if (opts.cursor) q.set("cursor", opts.cursor);
    if (opts.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    const res = await fetch(
      `${config.apiUrl}/play/${encodeURIComponent(childId)}/journey/timeline${qs ? `?${qs}` : ""}`,
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
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
