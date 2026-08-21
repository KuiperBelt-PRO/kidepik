/**
 * Preferencias de sesión del tripulante (play + chrome reducido).
 * @module member-settings
 */

import { fetchMember, patchMember } from "./member-api.js";
import { setShellUiTheme, isShellUiTheme } from "./shell-theme.js";

export const MEMBER_SETTINGS_STORAGE_KEY = "kidepik.member.settings";

/** @typedef {'md'|'lg'|'xl'} FontScale */
/** @typedef {'fantasy'|'sci-fi'} UiTheme */

/**
 * @typedef {object} MemberUiPreferences
 * @property {UiTheme} ui_theme
 * @property {'system'|'always'|'never'} reduce_motion
 */

/**
 * @typedef {object} MemberSettings
 * @property {FontScale} font_scale_play
 * @property {MemberUiPreferences} ui_preferences
 */

/** @returns {MemberSettings} */
export function defaultMemberSettings() {
  return {
    font_scale_play: "md",
    ui_preferences: {
      ui_theme: "fantasy",
      reduce_motion: "system",
    },
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} member
 * @returns {MemberSettings}
 */
export function memberSettingsFromDto(member) {
  const base = defaultMemberSettings();
  if (!member || typeof member !== "object") return base;
  const ui =
    member.ui_preferences && typeof member.ui_preferences === "object"
      ? /** @type {Record<string, unknown>} */ (member.ui_preferences)
      : {};
  const theme = ui.ui_theme;
  const motion = ui.reduce_motion;
  const world = member.world_theme;
  return {
    font_scale_play:
      member.font_scale_play === "lg" || member.font_scale_play === "xl"
        ? member.font_scale_play
        : "md",
    ui_preferences: {
      ui_theme:
        theme === "sci-fi" || theme === "fantasy"
          ? theme
          : world === "sci-fi" || world === "fantasy"
            ? world
            : base.ui_preferences.ui_theme,
      reduce_motion:
        motion === "always" || motion === "never" || motion === "system"
          ? motion
          : base.ui_preferences.reduce_motion,
    },
  };
}

/**
 * @param {MemberSettings} settings
 */
export function applyMemberSettingsToDom(settings) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.dataset.fontScalePlay = settings.font_scale_play;
  root.dataset.reduceMotionPref = settings.ui_preferences.reduce_motion;
  if (isShellUiTheme(settings.ui_preferences.ui_theme)) {
    setShellUiTheme(settings.ui_preferences.ui_theme);
  }
}

/**
 * @param {MemberSettings} settings
 */
export function cacheMemberSettingsLocal(settings) {
  try {
    globalThis.localStorage?.setItem(MEMBER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    applyMemberSettingsToDom(settings);
  } catch {
    /* ignore */
  }
}

/** @returns {MemberSettings | null} */
export function readCachedMemberSettings() {
  try {
    const raw = globalThis.localStorage?.getItem(MEMBER_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return memberSettingsFromDto(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 */
export async function fetchMemberSettings(session) {
  const res = await fetchMember(session);
  if (!res.ok) return { ok: false, status: res.status };
  const settings = memberSettingsFromDto(res.member);
  cacheMemberSettingsLocal(settings);
  return { ok: true, settings, member: res.member };
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @param {Record<string, unknown>} patch
 */
export async function patchMemberSettings(session, patch) {
  const body = {};
  if (patch.font_scale_play === "md" || patch.font_scale_play === "lg" || patch.font_scale_play === "xl") {
    body.font_scale_play = patch.font_scale_play;
  }
  if (patch.ui_preferences && typeof patch.ui_preferences === "object") {
    body.ui_preferences = patch.ui_preferences;
  }
  if (!Object.keys(body).length) {
    return { ok: false, error: "empty_patch" };
  }
  const res = await patchMember(session, body);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof res.error === "string" ? res.error : "save",
    };
  }
  const settings = memberSettingsFromDto(res.member);
  cacheMemberSettingsLocal(settings);
  return { ok: true, settings, member: res.member };
}
