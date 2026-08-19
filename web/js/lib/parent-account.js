/**
 * API cliente parent_accounts.
 * @module parent-account
 */

import { fetchParentSettings } from "./parent-settings.js";
import { normalizeDisplayNameInput } from "./account-display-name.js";

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
    void fetchParentSettings(session);
    return { ok: true, created: Boolean(data.created) };
  } catch (err) {
    console.warn("parents/bootstrap error", err);
    return { ok: false };
  }
}

/**
 * @typedef {{
 *   parent_id: string;
 *   auth_user_id: string;
 *   email: string;
 *   display_name: string | null;
 *   avatar_url: string | null;
 *   provider: string;
 * }} ParentAccountDto
 */

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @returns {Promise<{ ok: true; parent: ParentAccountDto } | { ok: false; status?: number }>}
 */
export async function fetchParentMe(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/parents/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    /** @type {ParentAccountDto} */
    const parent = await res.json();
    return { ok: true, parent };
  } catch (err) {
    console.warn("parents/me error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string | null} displayName
 * @returns {Promise<{ ok: true; parent: ParentAccountDto } | { ok: false; status?: number; error?: string }>}
 */
export async function updateParentDisplayName(session, displayName) {
  const normalized = normalizeDisplayNameInput(displayName);
  if (!normalized.ok) {
    return { ok: false, status: 422, error: normalized.error };
  }
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/parents/me`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ display_name: normalized.value }),
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    /** @type {ParentAccountDto} */
    const parent = await res.json();
    return { ok: true, parent };
  } catch (err) {
    console.warn("parents/me PATCH error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @returns {Promise<{ ok: boolean; status?: number }>}
 */
export async function deleteParentAccount(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/parents/me`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.warn("parents/me DELETE error", err);
    return { ok: false };
  }
}
