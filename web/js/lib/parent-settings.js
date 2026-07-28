/**
 * Cliente API + merge local de parent settings.
 * @module parent-settings
 */

import { setShellUiTheme, isShellUiTheme } from "./shell-theme.js";

export const PARENT_SETTINGS_STORAGE_KEY = "kidepik.parent.settings";

/** @typedef {'md'|'lg'|'xl'} FontScale */
/** @typedef {'fantasy'|'sci-fi'} UiTheme */

/**
 * @typedef {object} ParentSettings
 * @property {UiTheme} ui_theme
 * @property {FontScale} font_scale_ui
 * @property {FontScale} font_scale_play
 * @property {'system'|'always'|'never'} reduce_motion
 * @property {'calm'|'lively'} world_intensity
 * @property {object} crew_defaults
 * @property {object} learning
 * @property {object} narrative
 * @property {object} privacy
 * @property {number} schema_version
 */

/** @returns {ParentSettings} */
export function defaultParentSettings() {
  return {
    ui_theme: "fantasy",
    font_scale_ui: "md",
    font_scale_play: "md",
    reduce_motion: "system",
    world_intensity: "lively",
    crew_defaults: {
      session_limit_per_day: 3,
      max_session_minutes: 10,
      require_exit_pin: false,
      allow_solo_start: true,
      lock_world_theme: true,
      font_scale_play: "md",
    },
    learning: {
      adaptation_policy: "balanced",
      active_subjects: ["math", "language", "logic", "science", "culture"],
      show_levels_to_child: false,
      pause_adaptation: false,
    },
    narrative: {
      creativity: "balanced",
      avoid_themes: [],
      resume_mode: "continue",
    },
    privacy: {
      story_retention: "full",
      analytics_opt_in: false,
    },
    schema_version: 1,
  };
}

/**
 * @param {unknown} stored
 * @returns {ParentSettings}
 */
export function mergeParentSettings(stored) {
  const base = defaultParentSettings();
  if (!stored || typeof stored !== "object") return base;
  return /** @type {ParentSettings} */ (deepMerge(base, /** @type {Record<string, unknown>} */ (stored)));
}

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} over
 */
function deepMerge(base, over) {
  /** @type {Record<string, unknown>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const prev = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMerge(
        /** @type {Record<string, unknown>} */ (prev),
        /** @type {Record<string, unknown>} */ (value),
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * @param {ParentSettings} settings
 */
export function applyParentSettingsToDom(settings) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.dataset.fontScaleUi = settings.font_scale_ui;
  root.dataset.fontScalePlay = settings.font_scale_play;
  root.dataset.reduceMotionPref = settings.reduce_motion;
  root.dataset.worldIntensity = settings.world_intensity;
  if (isShellUiTheme(settings.ui_theme)) {
    setShellUiTheme(settings.ui_theme);
  }
}

/**
 * @param {ParentSettings} settings
 */
export function cacheParentSettingsLocal(settings) {
  try {
    globalThis.localStorage?.setItem(PARENT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/** @returns {ParentSettings | null} */
export function readCachedParentSettings() {
  try {
    const raw = globalThis.localStorage?.getItem(PARENT_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return mergeParentSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @returns {Promise<{ ok: true; settings: ParentSettings; member_count: number } | { ok: false; status?: number }>}
 */
export async function fetchParentSettings(session) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/parents/me/settings`, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    const settings = mergeParentSettings(data.settings);
    cacheParentSettingsLocal(settings);
    applyParentSettingsToDom(settings);
    return {
      ok: true,
      settings,
      member_count: Number(data.crew_summary?.member_count ?? 0),
    };
  } catch (err) {
    console.warn("parents/me/settings error", err);
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {Record<string, unknown>} patch
 * @returns {Promise<{ ok: true; settings: ParentSettings; member_count: number } | { ok: false; status?: number; error?: string }>}
 */
export async function patchParentSettings(session, patch) {
  try {
    const { config } = await import("../config.js");
    const res = await fetch(`${config.apiUrl}/parents/me/settings`, {
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
        const body = await res.json();
        error = body.detail || error;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, error };
    }
    const data = await res.json();
    const settings = mergeParentSettings(data.settings);
    cacheParentSettingsLocal(settings);
    applyParentSettingsToDom(settings);
    return {
      ok: true,
      settings,
      member_count: Number(data.crew_summary?.member_count ?? 0),
    };
  } catch (err) {
    console.warn("parents/me/settings patch error", err);
    return { ok: false };
  }
}

/**
 * Debounce helper for settings patches.
 * @param {(patch: Record<string, unknown>) => void | Promise<void>} fn
 * @param {number} [ms]
 */
export function createSettingsDebouncer(fn, ms = 400) {
  /** @type {ReturnType<typeof setTimeout> | 0} */
  let timer = 0;
  /** @type {Record<string, unknown>} */
  let pending = {};
  return {
    /**
     * @param {Record<string, unknown>} patch
     */
    schedule(patch) {
      pending = deepMerge(pending, patch);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const body = pending;
        pending = {};
        timer = 0;
        void fn(body);
      }, ms);
    },
    flush() {
      if (timer) clearTimeout(timer);
      timer = 0;
      if (Object.keys(pending).length === 0) return;
      const body = pending;
      pending = {};
      void fn(body);
    },
  };
}
