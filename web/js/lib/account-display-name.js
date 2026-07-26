/**
 * Validación y helpers de cuenta padre (cliente).
 * @module account-display-name
 */

/**
 * @param {unknown} value
 * @returns {{ ok: true; value: string | null } | { ok: false; error: string }}
 */
export function normalizeDisplayNameInput(value) {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Usa entre 1 y 40 caracteres, o déjalo vacío." };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (trimmed.length > 40) {
    return { ok: false, error: "Usa entre 1 y 40 caracteres, o déjalo vacío." };
  }
  if (!/^[\p{L}\p{N} '\-]+$/u.test(trimmed)) {
    return { ok: false, error: "Usa entre 1 y 40 caracteres, o déjalo vacío." };
  }
  return { ok: true, value: trimmed };
}

/**
 * Nombre legal/metadata de la cuenta Google (solo lectura en UI).
 * @param {{ user?: { user_metadata?: Record<string, unknown> } } | null | undefined} session
 * @returns {string}
 */
export function resolveGoogleAccountName(session) {
  const meta = session?.user?.user_metadata;
  if (meta && typeof meta === "object") {
    for (const key of ["full_name", "name"]) {
      const v = meta[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "—";
}

/**
 * @param {{ display_name?: string | null; email?: string | null } | null | undefined} parent
 * @param {{ user?: { email?: string; user_metadata?: Record<string, unknown> } } | null | undefined} session
 * @returns {string}
 */
export function resolveAccountDisplayName(parent, session) {
  if (parent?.display_name && String(parent.display_name).trim()) {
    return String(parent.display_name).trim();
  }
  const meta = session?.user?.user_metadata;
  if (meta && typeof meta === "object") {
    for (const key of ["full_name", "name"]) {
      const v = meta[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  const email = parent?.email || session?.user?.email;
  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0];
  }
  return "explorador";
}
