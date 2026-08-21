/**
 * Sesión tutor | crew (SPEC_APP_CREW_MEMBER_ACCOUNT).
 * @module session-account
 */

const STORAGE_KEY = "kidepik.sessionAccount";

/**
 * @typedef {{
 *   role: 'tutor' | 'crew';
 *   auth_user_id?: string;
 *   email?: string;
 *   parent_id?: string | null;
 *   child_id?: string;
 *   display_name?: string | null;
 *   created?: boolean;
 *   debug_capabilities?: {
 *     operator_eligible?: boolean;
 *     debug_enabled?: boolean;
 *     debug_allowed?: boolean;
 *   };
 * }} SessionAccountDto
 */

/** @type {SessionAccountDto | null} */
let memoryCache = null;

/**
 * @param {SessionAccountDto | null} dto
 */
export function cacheSessionAccount(dto) {
  memoryCache = dto;
  try {
    if (dto) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dto));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @returns {SessionAccountDto | null} */
export function getCachedSessionAccount() {
  if (memoryCache) return memoryCache;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    memoryCache = JSON.parse(raw);
    return memoryCache;
  } catch {
    return null;
  }
}

export function clearSessionAccount() {
  cacheSessionAccount(null);
}

/** @returns {'tutor' | 'crew'} */
export function getCachedSessionRole() {
  return getCachedSessionAccount()?.role === "crew" ? "crew" : "tutor";
}

export function isCrewSession() {
  return getCachedSessionRole() === "crew";
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @returns {Promise<{ ok: boolean; account?: SessionAccountDto }>}
 */
export async function bootstrapSession(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/session/bootstrap`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) {
      console.warn("session/bootstrap failed", res.status);
      return { ok: false };
    }
    /** @type {SessionAccountDto} */
    const account = await res.json();
    cacheSessionAccount(account);
    return { ok: true, account };
  } catch (err) {
    console.warn("session/bootstrap error", err);
    return { ok: false };
  }
}

/**
 * @param {string} [path]
 * @returns {string | null} ruta de redirección o null si ok
 */
export function wrongRoleRedirect(path = "") {
  const normalized = String(path).replace(/^#\/?/, "").split("?")[0] || "";
  if (isCrewSession()) {
    if (
      normalized === "crew" ||
      normalized.startsWith("crew/")
    ) {
      return "/member";
    }
  }
  return null;
}
