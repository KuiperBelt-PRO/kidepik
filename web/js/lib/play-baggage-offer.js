/**
 * Franja inline de equipaje en retos de play (hotbar estilo catálogo).
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
 * @param {string | undefined} effectId
 */
export function effectActionLabel(effectId) {
  return effectId === "challenge_retry" ? "Reintentar" : "Usar ahora";
}

/**
 * @param {string | undefined} rarity
 */
function rarityTone(rarity) {
  if (rarity === "rare") return "rare";
  if (rarity === "uncommon") return "uncommon";
  return "common";
}

/**
 * @param {any} offer
 * @returns {any}
 */
export function offerToBaggageItem(offer) {
  const effectId = String(offer?.effect_id || "challenge_hint");
  return {
    id: String(offer?.item_row_id || ""),
    label_child: String(offer?.label_child || "Objeto"),
    description_child: String(offer?.description_child || ""),
    subject_labels: Array.isArray(offer?.subject_labels) ? offer.subject_labels : [],
    effects: [effectId],
    rarity: offer?.rarity || "common",
    // Play offers omit inventory hydration; without this, detail UI assumes materia pausada.
    usable_now: offer?.usable_now !== false,
    can_use: Boolean(offer?.can_use),
    use_blocked_reason: offer?.use_blocked_reason,
  };
}

/**
 * @param {any[]} offers
 * @param {{ collapsed?: boolean, selectedId?: string | null }} [opts]
 * @returns {string}
 */
export function renderBaggageOfferStripHtml(offers, opts = {}) {
  if (!Array.isArray(offers) || offers.length === 0) return "";
  const collapsed = Boolean(opts.collapsed);
  const selectedId = opts.selectedId ? String(opts.selectedId) : "";
  const slots = offers
    .map((chip) => {
      const label = String(chip.label_child || "Objeto");
      const blocked = chip.can_use ? "" : " play-baggage-hotbar__slot--blocked";
      const selected =
        selectedId && selectedId === String(chip.item_row_id)
          ? " play-baggage-hotbar__slot--selected"
          : "";
      const title = chip.use_blocked_reason
        ? ` title="${escapeHtml(chip.use_blocked_reason)}"`
        : "";
      const glyph = String(chip.icon_id || "baggage");
      const tone = rarityTone(chip.rarity);
      return `<article class="play-baggage-hotbar__slot${blocked}${selected}" data-baggage-offer-slot="${escapeHtml(String(chip.item_row_id))}"${title}>
          <button type="button" class="play-baggage-hotbar__preview" data-baggage-offer-preview aria-label="Ver detalle de ${escapeHtml(label)}">
            <div class="play-baggage-hotbar__icon-wrap play-baggage-hotbar__icon-wrap--${tone}">
              <span class="play-baggage-hotbar__icon" data-icon="${escapeHtml(glyph)}" aria-hidden="true"></span>
            </div>
            <p class="play-baggage-hotbar__name">${escapeHtml(label)}</p>
          </button>
        </article>`;
    })
    .join("");

  const collapsedClass = collapsed ? " play-baggage-hotbar--collapsed" : "";
  const usableCount = offers.filter((chip) => chip.can_use).length;
  const hintText =
    usableCount > 0
      ? `${usableCount} listo${usableCount === 1 ? "" : "s"} en este reto`
      : "Desliza para ver todo tu equipaje";
  const hint = collapsed
    ? ""
    : `<span class="play-baggage-hotbar__hint">${escapeHtml(hintText)}</span>`;
  const moreBtn = collapsed
    ? ""
    : `<button type="button" class="crew-panel__btn crew-panel__btn--ghost play-baggage-hotbar__more" data-baggage-offer-more>Ver equipaje completo</button>`;
  return `<div class="play-baggage-hotbar${collapsedClass}" role="group" aria-label="Equipaje útil">
      <div class="play-baggage-hotbar__head">
        <button type="button" class="play-baggage-hotbar__toggle" data-baggage-hotbar-toggle aria-expanded="${collapsed ? "false" : "true"}" aria-label="${collapsed ? "Desplegar equipaje" : "Plegar equipaje"}">
          <span class="play-baggage-hotbar__chevron" data-icon="chevron" aria-hidden="true"></span>
          <span class="play-baggage-hotbar__title-wrap">
            <span class="play-baggage-hotbar__title">Equipaje (${offers.length})</span>
            ${hint}
          </span>
        </button>
        ${moreBtn}
      </div>
      <div class="play-baggage-hotbar__body" data-baggage-hotbar-body${collapsed ? " hidden" : ""}>
        <div class="play-baggage-hotbar__strip">${slots}</div>
        <div class="play-baggage-hotbar__detail-host" data-baggage-offer-detail hidden></div>
      </div>
    </div>`;
}
