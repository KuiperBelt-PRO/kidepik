/**
 * Lógica pura de fichas tripulación (cartas TCG).
 * @module crew-member-card
 */

/**
 * @typedef {import('./crew-api.js').CrewListItem} CrewListItem
 */

/**
 * @param {CrewListItem} m
 */
export function memberTitle(m) {
  if (m.is_tutor_profile) return m.display_name || "Tú";
  return m.display_name || "Nuevo tripulante";
}

/**
 * Título de cabecera en ficha (#/crew/:id). Sin nombre → genérico, no placeholder de carta.
 * @param {CrewListItem} m
 */
export function memberSectionTitle(m) {
  if (m.is_tutor_profile) return m.display_name || "Tú";
  const name = m.display_name?.trim();
  return name || "Tripulante";
}

/**
 * @param {CrewListItem} m
 */
export function memberTutorLabel(m) {
  return m.tutor_label?.trim() || "";
}

/**
 * @param {CrewListItem} m
 */
export function memberWorldLabel(m) {
  if (m.world_theme === "sci-fi") return "Ciencia ficción";
  if (m.world_theme === "fantasy") return "Fantasía";
  return "Sin mundo aún";
}

/**
 * @param {CrewListItem} m
 * @returns {'pending' | 'exam' | 'ready' | 'paused' | 'tutor'}
 */
export function memberCardTone(m) {
  if (m.is_tutor_profile) return "tutor";
  if (m.status === "paused") return "paused";
  if (m.placement_status === "in_progress" || m.onboarding_step === "placement") return "exam";
  if (m.onboarding_step === "complete") return "ready";
  return "pending";
}

/**
 * @param {CrewListItem} m
 * @returns {import('../components/shell-ui-icons.js').UiIconId}
 */
export function memberAvatarIcon(m) {
  if (m.is_tutor_profile) return "account";
  if (m.status === "paused") return "pause";
  if (m.world_theme === "sci-fi") return "theme-to-scifi";
  if (m.world_theme === "fantasy") return "theme-to-fantasy";
  if (m.onboarding_step === "complete") return "crew";
  return "pending";
}

/**
 * @param {CrewListItem} m
 */
export function memberAgeLabel(m) {
  if (m.is_tutor_profile) return "Tu perfil";
  if (m.age_years != null) return `${m.age_years} años`;
  return "Edad pendiente";
}

/**
 * @param {CrewListItem} m
 */
export function memberCornerStateLabel(m) {
  if (m.is_tutor_profile) return "Tú";
  if (m.rank_label) return m.rank_label;
  const tone = memberCardTone(m);
  if (tone === "paused") return "Pausa";
  if (tone === "exam") return "Examen";
  if (tone === "ready") return "Listo";
  return "Nuevo";
}

/**
 * @param {CrewListItem} m
 */
export function memberWorldModifier(m) {
  if (m.world_theme === "fantasy") return "crew-card--world-fantasy";
  if (m.world_theme === "sci-fi") return "crew-card--world-scifi";
  return "crew-card--world-neutral";
}

/**
 * @param {CrewListItem} m
 */
export function memberTypeLine(m) {
  if (m.is_tutor_profile) return "Perfil de tutor";
  const level = m.general_level ? ` · ${m.general_level}` : "";
  return `${memberWorldLabel(m)} · ${memberAgeLabel(m)}${level}`;
}

/**
 * @param {CrewListItem} m
 */
export function memberTextBoxContent(m) {
  const tutorLabel = memberTutorLabel(m);
  if (tutorLabel) return tutorLabel;
  if (!m.is_tutor_profile && m.onboarding_step !== "complete") {
    return "Completará su perfil en la primera aventura";
  }
  return "";
}

/**
 * @param {CrewListItem} m
 */
export function memberCardAriaLabel(m) {
  return [memberTitle(m), memberCornerStateLabel(m), memberTypeLine(m)].join(", ");
}

/**
 * @param {string} s
 */
export function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * @param {CrewListItem} m
 */
export function buildCrewMemberCardInner(m) {
  const tone = memberCardTone(m);
  const textBox = memberTextBoxContent(m);
  const stateCorner = memberCornerStateLabel(m);

  return `
    <span class="crew-card__frame">
      <span class="crew-card__header">
        <span class="crew-card__title">${escapeHtml(memberTitle(m))}</span>
        <span class="crew-card__status-gem crew-card__status-gem--${tone}">${escapeHtml(stateCorner)}</span>
      </span>
      <span class="crew-card__art" data-icon="${memberAvatarIcon(m)}" aria-hidden="true"></span>
      <span class="crew-card__type-line">${escapeHtml(memberTypeLine(m))}</span>
      ${textBox ? `<span class="crew-card__text-box">${escapeHtml(textBox)}</span>` : ""}
    </span>
  `;
}
