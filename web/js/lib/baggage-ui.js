/**
 * HTML compartido para vista equipaje (tutor / viajero).
 * @module baggage-ui
 */

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * @param {any} baggage
 * @param {{ audience?: 'tutor' | 'child' }} [opts]
 */
export function renderBaggageHtml(baggage, opts = {}) {
  const audience = opts.audience === "child" ? "child" : "tutor";
  const wallet = baggage?.wallet || {};
  const items = Array.isArray(baggage?.items) ? baggage.items : [];
  const label = audience === "child" ? wallet.label_child : wallet.label_tutor;
  const helper =
    audience === "child"
      ? "Las ganas al superar retos."
      : "Se ganan al superar retos en la aventura. El gasto en tienda llegará más adelante.";
  const slots =
    audience === "tutor"
      ? `<p class="crew-baggage__slots">Hallazgos (${Number(baggage?.slot_count) || 0}/${Number(baggage?.slot_soft_max) || 20})</p>`
      : "";
  const grid =
    items.length === 0
      ? `<p class="crew-panel__helper">${
          audience === "child"
            ? "Tu equipaje está vacío. ¡Sigue la aventura!"
            : "Aún no hay hallazgos en este mundo."
        }</p>`
      : `<div class="crew-baggage__grid" role="list">${items
          .map((it) => {
            const name = audience === "child" ? it.label_child : it.label_tutor;
            const unusable = it.usable_now ? "" : " crew-baggage__cell--unusable";
            const rare = it.rarity === "rare" ? " crew-baggage__cell--rare" : "";
            const qty = Number(it.qty) > 1 ? `<span class="crew-baggage__qty">${Number(it.qty)}</span>` : "";
            return `<button type="button" class="crew-baggage__cell${unusable}${rare}" role="listitem" data-baggage-item="${escapeHtml(it.id)}" aria-label="${escapeHtml(name)}">
              <span class="crew-baggage__icon" data-icon="${escapeHtml(it.icon_id || "baggage")}"></span>
              ${qty}
              <span class="crew-baggage__name">${escapeHtml(name)}</span>
            </button>`;
          })
          .join("")}</div>`;

  return `<section class="crew-baggage">
    <div class="crew-baggage__wallet">
      <span class="crew-baggage__wallet-label">${escapeHtml(label || "Monedas")}</span>
      <span class="crew-baggage__wallet-balance">${Number(wallet.balance) || 0}</span>
    </div>
    <p class="crew-panel__helper">${escapeHtml(helper)}</p>
    ${slots}
    <div data-baggage-grid>${grid}</div>
    <div class="crew-baggage__detail" data-baggage-detail hidden></div>
  </section>`;
}

/**
 * @param {any} item
 * @param {'tutor' | 'child'} audience
 * @param {{ allowUse?: boolean }} [opts]
 */
export function renderBaggageDetailHtml(item, audience, opts = {}) {
  const title = audience === "child" ? item.label_child : item.label_tutor;
  const desc =
    audience === "child"
      ? item.description_child
      : item.description_tutor || item.description_child;
  const subjects = Array.isArray(item.subject_labels) ? item.subject_labels.join(", ") : "";
  const effects = Array.isArray(item.effect_labels) ? item.effect_labels.join(" · ") : "";
  const implemented = Array.isArray(item.effects)
    ? item.effects.find((e) => e === "challenge_hint" || e === "challenge_retry")
    : null;
  const canUse = Boolean(opts.allowUse && item.can_use && implemented);
  const status = item.can_use
    ? audience === "child"
      ? "Listo para usar en el reto."
      : "Usable en play (pista / reintento)."
    : item.use_blocked_reason || "No usable ahora";
  const useBtn =
    audience === "child" && canUse
      ? `<button type="button" class="crew-panel__btn crew-panel__btn--primary" data-baggage-use data-effect-id="${escapeHtml(String(implemented))}">Usar</button>`
      : audience === "child" && item.can_use && !opts.allowUse
        ? `<p class="crew-panel__helper">Ábrelo durante un reto para usarlo.</p>`
        : "";
  return `<div class="crew-baggage__detail-card">
    <h3 class="crew-baggage__detail-title">${escapeHtml(title || "")}</h3>
    <p class="crew-panel__helper">${escapeHtml(desc || "")}</p>
    ${subjects ? `<p class="crew-panel__helper">Materias: ${escapeHtml(subjects)}</p>` : ""}
    ${effects ? `<p class="crew-panel__helper">${escapeHtml(effects)}</p>` : ""}
    <p class="crew-panel__helper">${escapeHtml(status)}</p>
    <div class="crew-baggage__detail-actions">
      ${useBtn}
      <button type="button" class="crew-panel__btn" data-baggage-detail-close>Cerrar</button>
    </div>
  </div>`;
}
