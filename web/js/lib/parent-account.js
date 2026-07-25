/**
 * Bootstrap de parent_accounts tras login OAuth.
 * @module parent-account
 */

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @returns {Promise<{ ok: boolean; created?: boolean }>}
 */
export async function bootstrapParentIfNeeded(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/parents/bootstrap`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) {
      console.warn("parents/bootstrap failed", res.status);
      return { ok: false };
    }
    const data = await res.json();
    return { ok: true, created: Boolean(data.created) };
  } catch (err) {
    console.warn("parents/bootstrap error", err);
    return { ok: false };
  }
}
