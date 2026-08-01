/**
 * Cliente API debug IA.
 * @module debug-ai-api
 */

import { debugAiRequestHeaders } from "./debug-ai.js";

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function debugFetch(session, path, init = {}) {
  const { config } = await import("../config.js");
  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    ...debugAiRequestHeaders(),
    ...(init.headers || {}),
  };
  const res = await fetch(`${config.apiUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  return { ok: true, data: await res.json() };
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 */
export async function fetchDebugAiStatus(session) {
  return debugFetch(session, "/debug/ai/status");
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} [purpose]
 */
export async function fetchDebugAiQueues(session, purpose) {
  const q = purpose ? `?purpose=${encodeURIComponent(purpose)}` : "";
  return debugFetch(session, `/debug/ai/queues${q}`);
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} [purpose]
 */
export async function fetchDebugAiResolve(session, purpose = "placement_exam_composer") {
  return debugFetch(session, `/debug/ai/resolve?purpose=${encodeURIComponent(purpose)}`);
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {number} [limit]
 */
export async function fetchDebugAiAttempts(session, limit = 20) {
  return debugFetch(session, `/debug/ai/attempts?limit=${limit}`);
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} [childId]
 */
export async function postDebugAiPing(session, childId) {
  return debugFetch(session, "/debug/ai/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(childId ? { child_id: childId } : {}),
  });
}
