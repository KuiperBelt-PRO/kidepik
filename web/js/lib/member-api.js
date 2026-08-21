/**
 * API ficha propia del tripulante.
 * @module member-api
 */

/**
 * @param {import('@supabase/supabase-js').Session} session
 */
export async function fetchMember(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/member`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, member: await res.json() };
  } catch (err) {
    console.warn("member get error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {Record<string, unknown>} patch
 */
export async function patchMember(session, patch) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/member`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      let error = "save";
      try {
        const data = await res.json();
        error = data.detail || error;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, error };
    }
    return { ok: true, member: await res.json() };
  } catch (err) {
    console.warn("member patch error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 */
export async function unlinkMemberAccount(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/member/unlink`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch (err) {
    console.warn("member unlink error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 */
export async function fetchMemberBaggage(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/member/baggage`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, baggage: await res.json() };
  } catch (err) {
    console.warn("member baggage error", err);
    return { ok: false };
  }
}
