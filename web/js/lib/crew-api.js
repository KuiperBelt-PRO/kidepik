/**
 * Cliente API Tripulación.
 * @module crew-api
 */

/**
 * @typedef {object} CrewListItem
 * @property {string} id
 * @property {string | null} display_name
 * @property {number | null} age_years
 * @property {string | null} age_band
 * @property {string | null} world_theme
 * @property {string | null} [explorer_gender]
 * @property {string | null} [explorer_gender_label]
 * @property {string} status
 * @property {string} onboarding_step
 * @property {string} placement_status
 * @property {string | null} tutor_label
 * @property {boolean} [is_tutor_profile]
 */

/**
 * @param {import('@supabase/supabase-js').Session} session
 */
export async function fetchCrewList(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/crew`, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    return {
      ok: true,
      members: /** @type {CrewListItem[]} */ (data.members || []),
      member_count: Number(data.member_count ?? 0),
      member_limit: Number(data.member_limit ?? 10),
      has_tutor_profile: Boolean(data.has_tutor_profile),
    };
  } catch (err) {
    console.warn("crew list error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {{ tutor_label?: string | null }} [body]
 */
export async function createCrewMember(session, body = {}) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/crew`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let error = "create";
      try {
        const data = await res.json();
        error = data.detail || error;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, error };
    }
    const member = await res.json();
    return { ok: true, member };
  } catch (err) {
    console.warn("crew create error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} id
 */
export async function fetchCrewMember(session, id) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/crew/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, member: await res.json() };
  } catch (err) {
    console.warn("crew get error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function patchCrewMember(session, id, patch) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/crew/${encodeURIComponent(id)}`, {
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
    console.warn("crew patch error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function patchCrewPermissions(session, id, patch) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/crew/${encodeURIComponent(id)}/permissions`, {
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
    console.warn("crew permissions error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} id
 */
export async function deleteCrewMember(session, id) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/crew/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirm: true }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch (err) {
    console.warn("crew delete error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} id
 * @param {string} pin
 */
export async function verifyCrewExitPin(session, id, pin) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(
      `${config.apiUrl}/crew/${encodeURIComponent(id)}/verify-exit-pin`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      },
    );
    if (res.status === 403) return { ok: false, status: 403, error: "PIN incorrecto" };
    if (!res.ok) {
      let error = "No se pudo verificar el PIN";
      try {
        const data = await res.json();
        error = data.detail || error;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, error };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, required: Boolean(data.required) };
  } catch (err) {
    console.warn("crew verify pin error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} id
 */
export async function requestTutorReport(session, id) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(
      `${config.apiUrl}/crew/${encodeURIComponent(id)}/tutor-report`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    );
    if (!res.ok) {
      let error = "report";
      try {
        const data = await res.json();
        error = data.detail || error;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, error };
    }
    return { ok: true, ...(await res.json()) };
  } catch (err) {
    console.warn("tutor report error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} id
 * @param {string} [worldTheme]
 * @param {{ includeUsage?: boolean }} [opts]
 */
export async function fetchCrewBaggage(session, id, worldTheme, opts = {}) {
  try {
    const { config } = await import("../config.js");
    const params = new URLSearchParams();
    if (worldTheme) params.set("world_theme", worldTheme);
    if (opts.includeUsage !== false) params.set("include_usage", "1");
    const q = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(
      `${config.apiUrl}/crew/${encodeURIComponent(id)}/baggage${q}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } },
    );
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, baggage: await res.json() };
  } catch (err) {
    console.warn("crew baggage error", err);
    return { ok: false };
  }
}
