/**
 * Cliente API debug journey rewind.
 * @module debug-journey-api
 */

import { debugAiRequestHeaders } from "./debug-ai.js";

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function debugJourneyFetch(session, path, init = {}) {
  const { config } = await import("../config.js");
  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    ...debugAiRequestHeaders(),
    ...(init.headers || {}),
  };
  const res = await fetch(`${config.apiUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : "";
    } catch {
      detail = "";
    }
    return { ok: false, status: res.status, detail };
  }
  return { ok: true, data: await res.json() };
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 * @param {string} sessionId
 * @param {string} turnId
 */
export async function postDebugJourneyRewind(session, childId, sessionId, turnId) {
  return debugJourneyFetch(session, "/debug/journey/rewind", {
    method: "POST",
    body: JSON.stringify({
      child_id: childId,
      session_id: sessionId,
      turn_id: turnId,
    }),
  });
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 * @param {string} sessionId
 * @param {string} turnId
 */
export async function postDebugJourneyRewindDryRun(session, childId, sessionId, turnId) {
  return debugJourneyFetch(session, "/debug/journey/rewind/dry-run", {
    method: "POST",
    body: JSON.stringify({
      child_id: childId,
      session_id: sessionId,
      turn_id: turnId,
    }),
  });
}
