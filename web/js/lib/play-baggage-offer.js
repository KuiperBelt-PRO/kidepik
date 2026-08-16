/**
 * Franja inline de equipaje en retos de play.
 * @module play-baggage-offer
 */

/**
 * @param {string} s
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {any[]} offers
 * @param {{ phase?: string, retry?: boolean }} turnMeta
 * @returns {string}
 */
export function shouldShowBaggageOfferStrip(offers, turnMeta = {}) {
  const phase = String(turnMeta.phase || "");
  const showPhase =
    phase === "path_challenge" || (phase === "path_intro" && Boolean(turnMeta.retry));
  return showPhase && Array.isArray(offers) && offers.length > 0;
}

/**
 * @param {any[]} offers
 * @returns {string}
 */
export function renderBaggageOfferStripHtml(offers) {
  if (!Array.isArray(offers) || offers.length === 0) return "";
  const chips = offers.slice(0, 3);
  const parts = chips
    .map((chip) => {
      const label = String(chip.label_child || "Objeto");
      const effect = chip.effect_id === "challenge_retry" ? "Reintentar" : "Pista";
      const disabled = chip.can_use ? "" : " disabled aria-disabled=\"true\"";
      const blocked = chip.can_use ? "" : " play-baggage-offer__chip--blocked";
      const title = chip.use_blocked_reason
        ? ` title="${escapeHtml(chip.use_blocked_reason)}"`
        : "";
      const glyph = String(chip.icon_id || "baggage");
      return `<button type="button" class="play-baggage-offer__chip${blocked}" data-baggage-offer-chip="${escapeHtml(String(chip.item_row_id))}" data-effect-id="${escapeHtml(String(chip.effect_id || "challenge_hint"))}"${disabled}${title}>
          <span class="play-baggage-offer__icon" data-icon="${escapeHtml(glyph)}" aria-hidden="true"></span>
          <span class="play-baggage-offer__label">${escapeHtml(label)}</span>
          <span class="play-baggage-offer__effect">${escapeHtml(effect)}</span>
        </button>`;
    })
    .join("");
  return `<div class="play-baggage-offer__row" role="group" aria-label="Equipaje útil">
      <span class="play-baggage-offer__title">Equipaje</span>
      ${parts}
      <button type="button" class="play-baggage-offer__more" data-baggage-offer-more>Ver todo</button>
    </div>`;
}
