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
 * @param {string | null | undefined} iconId
 * @returns {string}
 */
export function baggageGlyphId(iconId) {
  const id = String(iconId || "").trim();
  if (!id) return "baggage";
  if (id === "currency" || id === "baggage") return id;
  if (id.startsWith("item-")) return id;
  return "baggage";
}

/**
 * @param {string | undefined} effectId
 * @param {'tutor' | 'child'} audience
 */
function effectActionText(effectId, audience) {
  const copy = {
    challenge_hint: {
      tutor: "Pide una pista durante un reto, sin revelar la respuesta.",
      child: "Pide una pista en el reto que estás haciendo.",
    },
    challenge_retry: {
      tutor: "Permite un segundo intento si el reto no salió bien.",
      child: "Vuelve a intentar un reto que no salió bien.",
    },
  };
  return copy[/** @type {keyof typeof copy} */ (effectId)]?.[audience] || "";
}

/**
 * @param {any} item
 * @param {'tutor' | 'child'} audience
 */
function baggageStatusMeta(item, audience) {
  const implemented = Array.isArray(item.effects)
    ? item.effects.find((e) => e === "challenge_hint" || e === "challenge_retry")
    : null;
  if (!item.usable_now) {
    return {
      tone: "warn",
      label: "Materia en pausa",
      hint:
        audience === "child"
          ? "Pide a tu tutor que active la materia en Progreso."
          : "Activa la materia en Progreso para que pueda usarse en la aventura.",
    };
  }
  if (!item.can_use && item.use_blocked_reason === "Próximamente") {
    return {
      tone: "muted",
      label: "Próximamente",
      hint: "Este objeto aún no se puede gastar en la aventura.",
    };
  }
  if (item.can_use) {
    const effectHint =
      implemented === "challenge_hint"
        ? audience === "child"
          ? "Úsalo en un reto para pedir una pista."
          : "Se gasta al pedir una pista en un reto."
        : implemented === "challenge_retry"
          ? audience === "child"
            ? "Úsalo si un reto no salió bien y quieres repetirlo."
            : "Se gasta al dar un segundo intento en un reto fallido."
          : "";
    return audience === "child"
      ? {
          tone: "ok",
          label: "Listo en un reto",
          hint: effectHint || "Ábrelo durante la aventura, mientras estés en un reto.",
        }
      : {
          tone: "ok",
          label: "Disponible en la aventura",
          hint: effectHint || "El explorador puede gastarlo durante un reto.",
        };
  }
  return {
    tone: "muted",
    label: String(item.use_blocked_reason || "No disponible"),
    hint: "",
  };
}

/**
 * @param {string | undefined} rarity
 */
function rarityLabel(rarity) {
  if (rarity === "rare") return "Raro";
  if (rarity === "uncommon") return "Poco común";
  return "";
}

/**
 * @param {string | undefined} rarity
 */
function rarityBadgeHtml(rarity) {
  const label = rarityLabel(rarity);
  if (!label) return "";
  const tone = rarity === "rare" ? "rare" : "uncommon";
  return `<span class="crew-baggage__rarity crew-baggage__rarity--${tone}">${escapeHtml(label)}</span>`;
}

/**
 * @param {any} baggage
 * @param {{ audience?: 'tutor' | 'child', allowUse?: boolean }} [opts]
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
  const slotCount = Number(baggage?.slot_count) || 0;
  const slotMax = Number(baggage?.slot_soft_max) || 20;
  const findingsTitle = audience === "child" ? "Hallazgos" : "Hallazgos";
  const findingsCount =
    audience === "tutor"
      ? `<span class="crew-baggage__section-count" aria-label="${slotCount} de ${slotMax}">${slotCount}/${slotMax}</span>`
      : "";
  const grid =
    items.length === 0
      ? `<p class="crew-baggage__section-empty">${
          audience === "child"
            ? "Tu equipaje está vacío. ¡Sigue la aventura!"
            : "Aún no hay hallazgos en este mundo."
        }</p>`
      : `<div class="crew-baggage__grid" role="list" data-baggage-grid-inner>${items
          .map((it, idx) => {
            const name = it.label || (audience === "child" ? it.label_child : it.label_child || it.label_tutor);
            const unusable = it.usable_now ? "" : " crew-baggage__cell--unusable";
            const rare = it.rarity === "rare" ? " crew-baggage__cell--rare" : "";
            const uncommon = it.rarity === "uncommon" ? " crew-baggage__cell--uncommon" : "";
            const qty = Number(it.qty) > 1 ? `<span class="crew-baggage__qty">${Number(it.qty)}</span>` : "";
            const glyph = baggageGlyphId(it.icon_id);
            return `<div class="crew-baggage__entry" data-baggage-entry="${escapeHtml(it.id)}" data-baggage-index="${idx}">
              <div class="crew-baggage__cell${unusable}${rare}${uncommon}">
                <button type="button" class="crew-baggage__compact" data-baggage-item="${escapeHtml(it.id)}" aria-expanded="false" aria-controls="baggage-body-${escapeHtml(it.id)}" aria-label="${escapeHtml(name)}">
                  ${rarityBadgeHtml(it.rarity)}
                  <span class="crew-baggage__icon" data-icon="${escapeHtml(glyph)}"></span>
                  ${qty}
                  <span class="crew-baggage__name">${escapeHtml(name)}</span>
                </button>
                <div class="crew-baggage__body" id="baggage-body-${escapeHtml(it.id)}" data-baggage-body aria-hidden="true">
                  ${renderBaggageDetailHtml(it, audience, opts)}
                </div>
              </div>
            </div>`;
          })
          .join("")}</div>`;

  const currencyIcon = baggageGlyphId(wallet.icon_id || "currency");
  return `<section class="crew-baggage">
    <div class="crew-baggage__section crew-baggage__section--wallet">
      <h3 class="crew-baggage__section-title">
        <span class="crew-baggage__section-title-icon" data-icon="${currencyIcon}" aria-hidden="true"></span>
        <span class="crew-baggage__section-title-text">${escapeHtml(label || "Monedas")}</span>
      </h3>
      <div class="crew-baggage__wallet-card">
        <span class="crew-baggage__wallet-balance">${Number(wallet.balance) || 0}</span>
      </div>
      <p class="crew-baggage__section-helper">${escapeHtml(helper)}</p>
    </div>
    <div class="crew-baggage__section crew-baggage__section--findings">
      <h3 class="crew-baggage__section-title">
        <span class="crew-baggage__section-title-text">${escapeHtml(findingsTitle)}</span>
        ${findingsCount}
      </h3>
      <div data-baggage-grid>${grid}</div>
    </div>
  </section>`;
}

/**
 * @param {any} item
 * @param {'tutor' | 'child'} audience
 * @param {{ allowUse?: boolean }} [opts]
 */
export function renderBaggageDetailHtml(item, audience, opts = {}) {
  const title = item.label || (audience === "child" ? item.label_child : item.label_child || item.label_tutor);
  const desc =
    audience === "child"
      ? item.description_child
      : item.description_tutor || item.description_child;
  const subjects = Array.isArray(item.subject_labels) ? item.subject_labels.join(", ") : "";
  const implemented = Array.isArray(item.effects)
    ? item.effects.find((e) => e === "challenge_hint" || e === "challenge_retry")
    : null;
  const action = implemented ? effectActionText(String(implemented), audience) : "";
  const status = baggageStatusMeta(item, audience);
  const rarity = rarityLabel(item.rarity);
  const canUse = Boolean(opts.allowUse && item.can_use && implemented);
  const useBtn =
    audience === "child" && canUse
      ? `<button type="button" class="crew-panel__btn crew-panel__btn--primary" data-baggage-use data-effect-id="${escapeHtml(String(implemented))}">Usar ahora</button>`
      : audience === "child" && item.can_use && !opts.allowUse
        ? `<p class="crew-baggage__inline-hint">Solo puedes usarlo mientras estás en un reto.</p>`
        : "";
  return `<div class="crew-baggage__detail">
    <h3 class="crew-baggage__detail-title">${escapeHtml(title || "")}</h3>
    ${desc ? `<p class="crew-baggage__detail-desc">${escapeHtml(desc)}</p>` : ""}
    <dl class="crew-baggage__meta">
      ${rarity ? `<div class="crew-baggage__meta-row"><dt>Rareza</dt><dd>${rarityBadgeHtml(item.rarity)}</dd></div>` : ""}
      ${subjects ? `<div class="crew-baggage__meta-row"><dt>Materias</dt><dd>${escapeHtml(subjects)}</dd></div>` : ""}
      ${action ? `<div class="crew-baggage__meta-row"><dt>En la aventura</dt><dd>${escapeHtml(action)}</dd></div>` : ""}
      <div class="crew-baggage__meta-row">
        <dt>Estado</dt>
        <dd>
          <span class="crew-baggage__status crew-baggage__status--${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
          ${status.hint ? `<p class="crew-baggage__status-hint">${escapeHtml(status.hint)}</p>` : ""}
        </dd>
      </div>
    </dl>
    <div class="crew-baggage__detail-actions">
      ${useBtn}
      <button type="button" class="crew-panel__btn crew-panel__btn--ghost" data-baggage-detail-close>Ocultar</button>
    </div>
  </div>`;
}

/**
 * @param {HTMLElement} grid
 */
function gridColumnCount(grid) {
  const cols = getComputedStyle(grid).gridTemplateColumns.trim();
  if (!cols) return 2;
  return cols.split(/\s+/).filter(Boolean).length;
}

/**
 * @param {HTMLElement} entry
 * @param {HTMLElement} grid
 */
function applyExpandedSpan(entry, grid) {
  const cols = gridColumnCount(grid);
  const index = Number(entry.getAttribute("data-baggage-index") || 0);
  const col = index % cols;
  const row = Math.floor(index / cols) + 1;
  const span = Math.min(2, cols);
  const start = Math.min(col, cols - span) + 1;

  entry.style.gridColumn = `${start} / span ${span}`;
  // Último de la fila (3+ cols): bajar a la siguiente para no solapar vecinos.
  if (col === cols - 1 && cols > 2 && span > 1) {
    entry.style.gridRow = String(row + 1);
  } else {
    entry.style.gridRow = "";
  }
}

/**
 * @param {HTMLElement} entry
 */
function clearExpandedSpan(entry) {
  entry.style.gridColumn = "";
  entry.style.gridRow = "";
}

/**
 * @param {HTMLElement} grid
 * @param {() => void} mutate
 */
function flipGrid(grid, mutate) {
  const entries = [...grid.querySelectorAll("[data-baggage-entry]")].filter(
    (el) => el instanceof HTMLElement,
  );
  const first = entries.map((el) => el.getBoundingClientRect());
  mutate();
  void grid.offsetHeight;
  entries.forEach((el, i) => {
    const last = el.getBoundingClientRect();
    const dx = first[i].left - last.left;
    const dy = first[i].top - last.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = "transform 0s";
    requestAnimationFrame(() => {
      el.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "";
      const done = () => {
        el.style.transition = "";
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
    });
  });
}

/**
 * @param {HTMLElement} host
 * @param {any[]} items
 * @param {{ audience?: 'tutor' | 'child', allowUse?: boolean, onUse?: (item: any, effectId: string) => void }} [opts]
 */
export function wireBaggageGrid(host, items, opts = {}) {
  const grid = host.querySelector("[data-baggage-grid-inner]");
  if (!(grid instanceof HTMLElement)) return;

  /**
   * @param {HTMLElement} entry
   * @param {boolean} open
   */
  const setEntryOpen = (entry, open) => {
    const btn = entry.querySelector("[data-baggage-item]");
    const body = entry.querySelector("[data-baggage-body]");
    const cell = entry.querySelector(".crew-baggage__cell");
    if (!(btn instanceof HTMLButtonElement) || !(body instanceof HTMLElement)) return;
    entry.classList.toggle("crew-baggage__entry--open", open);
    cell?.classList.toggle("crew-baggage__cell--open", open);
    btn.setAttribute("aria-expanded", String(open));
    body.setAttribute("aria-hidden", String(!open));
    if (open) {
      applyExpandedSpan(entry, grid);
    } else {
      clearExpandedSpan(entry);
    }
  };

  const closeAll = () => {
    flipGrid(grid, () => {
      grid.querySelectorAll("[data-baggage-entry]").forEach((entry) => {
        if (entry instanceof HTMLElement) setEntryOpen(entry, false);
      });
    });
  };

  host.querySelectorAll("[data-baggage-entry]").forEach((entry) => {
    if (!(entry instanceof HTMLElement)) return;
    const btn = entry.querySelector("[data-baggage-item]");
    if (!(btn instanceof HTMLButtonElement)) return;

    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.getAttribute("data-baggage-item");
      const item = items.find((x) => String(x.id) === id);
      if (!item) return;
      const wasOpen = entry.classList.contains("crew-baggage__entry--open");
      flipGrid(grid, () => {
        grid.querySelectorAll("[data-baggage-entry]").forEach((other) => {
          if (other instanceof HTMLElement && other !== entry) setEntryOpen(other, false);
        });
        if (wasOpen) {
          setEntryOpen(entry, false);
        } else {
          setEntryOpen(entry, true);
        }
      });
    });

    entry.querySelector("[data-baggage-detail-close]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeAll();
    });

    entry.querySelector("[data-baggage-use]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.getAttribute("data-baggage-item");
      const item = items.find((x) => String(x.id) === id);
      const effectId = entry.querySelector("[data-baggage-use]")?.getAttribute("data-effect-id");
      if (item && effectId && typeof opts.onUse === "function") opts.onUse(item, effectId);
    });
  });
}
