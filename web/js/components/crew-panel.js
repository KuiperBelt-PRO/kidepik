/**
 * Paneles Tripulación: lista, alta, ficha.
 * @module crew-panel
 */

import { navigateShellRoute } from "../lib/shell-navigation.js?v=184";
import {
  createCrewMember,
  deleteCrewMember,
  fetchCrewList,
  fetchCrewMember,
  patchCrewMember,
  patchCrewPermissions,
  requestTutorReport,
  verifyCrewExitPin,
  fetchCrewBaggage,
} from "../lib/crew-api.js?v=280";
import { fetchMember, fetchMemberBaggage, patchMember } from "../lib/member-api.js";
import { fetchJourneyTimeline } from "../lib/play-api.js";
import { baggageGlyphId, renderBaggageHtml, wireBaggageGrid, wireBaggageViewToggle } from "../lib/baggage-ui.js?v=10";
import { applyCrewMemberWorldTheme } from "../lib/play-theme.js";
import {
  bindGlassIconTheme,
  createGlassIconSvg,
  fillGlassSkeleton,
  mountAgeStepper,
  mountDurationSlider,
  mountGlassSelect,
  mountTimelineSkeletonItems,
  normalizeSessionMinutes,
  runGlassButtonAction,
  setGlassButton,
} from "./glass-controls.js?v=227";
import { showGlassConfirm } from "./glass-modal.js?v=2";
import { showPinPadModal } from "./pin-pad-modal.js?v=3";
import { markExitPinVerified } from "../lib/exit-pin-gate.js";
import {
  GENERAL_NOTE_PLACEHOLDER,
  generalNoteFromLearning,
  normalizeActiveSubjects,
  renderSubjectsChecklistHtml,
  subjectNotesById,
  subjectPrioritiesFromLearning,
  SUBJECT_CATALOG,
} from "../lib/subject-catalog.js?v=256";
import {
  buildCrewListCardInner,
  buildCrewMemberCardInner,
  escapeHtml,
  memberCardAriaLabel,
  memberCardTone,
  memberSectionTitle,
  memberTitle,
  memberWorldModifier,
  genderSelectOptions,
} from "../lib/crew-member-card.js?v=254";

/** Altura mínima ~2 líneas; máxima ~4 líneas; scroll nativo sin fade. */
const CHARACTER_SUMMARY_MIN_HEIGHT_PX = 72;
const CHARACTER_SUMMARY_MAX_HEIGHT_PX = 104;

/**
 * @param {string} childId
 */
function crewTabStorageKey(childId) {
  return `crew-tab:${childId}`;
}

function crewBaggageViewStorageKey(childId) {
  return `crew-baggage-view:${childId}`;
}

/**
 * @param {string} childId
 * @param {import('@supabase/supabase-js').Session} session
 * @param {{ require_exit_pin?: boolean, exit_pin_set?: boolean } | null | undefined} [perms]
 */
async function gatePlayNavigation(childId, session, perms) {
  const needPin = Boolean(perms?.require_exit_pin && perms?.exit_pin_set);
  if (needPin) {
    const ok = await showPinPadModal({
      title: "Introduce el PIN",
      verify: async (pin) => {
        const res = await verifyCrewExitPin(session, childId, pin);
        return { ok: Boolean(res.ok), error: res.error || "PIN incorrecto" };
      },
    });
    if (!ok) return;
    markExitPinVerified(childId);
  }
  void navigateShellRoute(`/play/${childId}`);
}

/**
 * @param {number} percent
 * @param {string} leftLabel
 * @param {string} [rightLabel]
 * @param {{ showRing?: boolean }} [opts]
 */
function renderLevelBar(percent, leftLabel, rightLabel = "", opts = {}) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const right = rightLabel
    ? `<span class="crew-progress__rank-next">${escapeHtml(rightLabel)}</span>`
    : `<span class="crew-progress__rank-next" aria-hidden="true"></span>`;
  const ring = opts.showRing
    ? `<span class="crew-progress__ring" style="--p:${p}" title="${p} %"><span class="crew-progress__ring-inner">${p}%</span></span>`
    : "";
  const leftInner = opts.showRing
    ? `<span class="crew-progress__rank-current crew-progress__rank-current--with-ring">${ring}<span class="crew-progress__rank-name">${escapeHtml(leftLabel)}</span></span>`
    : `<span class="crew-progress__rank-current">${escapeHtml(leftLabel)}</span>`;
  return `<div class="crew-progress__row">
    <div class="crew-progress__track">
      ${leftInner}
      <div class="crew-progress__bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(leftLabel)}${rightLabel ? ` hacia ${escapeHtml(rightLabel)}` : ""} (${p} %)">
        <div class="crew-progress__bar-fill" style="width:${p}%"></div>
      </div>
      ${right}
    </div>
  </div>`;
}

/**
 * @param {string} subjectLabel
 * @param {number} percent
 * @param {string} currentRank
 * @param {string} [nextRank]
 */
function renderSubjectProgressRow(subjectLabel, percent, currentRank, nextRank = "") {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const cur = currentRank || "—";
  const next = nextRank
    ? `<span class="crew-progress__rank-next">${escapeHtml(nextRank)}</span>`
    : `<span class="crew-progress__rank-next" aria-hidden="true"></span>`;
  return `<div class="crew-progress__row crew-progress__row--subject">
    <div class="crew-progress__subject-label">${escapeHtml(subjectLabel)}</div>
    <div class="crew-progress__track">
      <span class="crew-progress__rank-current">${escapeHtml(cur)}</span>
      <div class="crew-progress__bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(subjectLabel)}: ${escapeHtml(cur)}${nextRank ? ` hacia ${escapeHtml(nextRank)}` : ""}">
        <div class="crew-progress__bar-fill" style="width:${p}%"></div>
      </div>
      ${next}
    </div>
  </div>`;
}

/**
 * @param {any} member
 */
function inviteAccessBlock(member) {
  return `
      <section class="crew-panel__block" data-invite-block>
        <h2 class="crew-panel__block-title">Acceso del tripulante</h2>
        <p class="crew-panel__helper">Asigna un correo de Gmail distinto al tuyo. Quien entre con ese correo usará esta plaza, no una cuenta de tutor.</p>
        <label class="crew-panel__label">Gmail del tripulante
          <input class="crew-panel__input" data-invite-email type="email" inputmode="email" autocomplete="off" value="${escapeAttr(member.invite_email || "")}" placeholder="tucorreoelectronico@gmail.com" />
        </label>
        <p class="crew-panel__status" data-invite-status aria-live="polite"></p>
        <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-save-invite></button>
      </section>`;
}

function renderSubjectsReadOnly(member) {
  const active = Array.isArray(member.active_subjects) ? member.active_subjects : [];
  const labels = active.map((id) => escapeHtml(String(id))).join(", ");
  return `<section class="crew-panel__block">
    <h2 class="crew-panel__block-title">Materias</h2>
    <p class="crew-panel__helper">${labels || "Tu tutor elige las materias activas."}</p>
  </section>`;
}

function renderRankLegend(member) {
  const legend = member?.progress?.rank_legend;
  if (!Array.isArray(legend) || !legend.length) return "";
  const rows = legend
    .map((row) => {
      const age = row.age_hint ? `<span class="crew-progress__legend-age">${escapeHtml(row.age_hint)}</span>` : "";
      return `<li class="crew-progress__legend-item"><span class="crew-progress__legend-rank">${escapeHtml(row.label)}</span>${age}</li>`;
    })
    .join("");
  return `<div class="crew-progress__legend">
    <button type="button" class="crew-progress__legend-trigger" aria-expanded="false" aria-controls="crew-rank-legend-panel">
      <span class="crew-progress__legend-trigger-icon" data-icon="note" aria-hidden="true"></span>
      <span class="crew-progress__legend-trigger-label">Rangos del viaje</span>
      <span class="crew-progress__legend-chevron" data-icon="chevron" aria-hidden="true"></span>
    </button>
    <div class="crew-progress__legend-panel" id="crew-rank-legend-panel" hidden>
      <p class="crew-panel__helper crew-progress__legend-intro">Cada rango marca una etapa del viaje. La edad ajusta la dificultad, no el nombre del rango.</p>
      <ul class="crew-progress__legend-list">${rows}</ul>
    </div>
  </div>`;
}

/**
 * @param {ParentNode} host
 * @returns {() => void}
 */
function mountSubjectNoteDisclosures(host) {
  const toggles = host.querySelectorAll("[data-subject-notes-toggle]");
  /** @type {(() => void)[]} */
  const cleanups = [];
  toggles.forEach((trigger) => {
    if (!(trigger instanceof HTMLButtonElement)) return;
    const sid = trigger.getAttribute("data-subject-notes-toggle");
    if (!sid) return;
    const panel = host.querySelector(`[data-subject-notes-panel="${sid}"]`);
    if (!(panel instanceof HTMLElement)) return;
    const onToggle = () => {
      const open = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
      trigger.classList.toggle("is-open", !open);
    };
    trigger.addEventListener("click", onToggle);
    cleanups.push(() => trigger.removeEventListener("click", onToggle));
  });
  return () => cleanups.forEach((fn) => fn());
}

/**
 * @param {ParentNode} host
 * @returns {() => void}
 */
function mountRankLegend(host) {
  const root = host.querySelector(".crew-progress__legend");
  if (!root) return () => {};
  const trigger = root.querySelector(".crew-progress__legend-trigger");
  const panel = root.querySelector(".crew-progress__legend-panel");
  if (!(trigger instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return () => {};
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const id = el.getAttribute("data-icon") || "note";
    const size = id === "chevron" ? 16 : 18;
    el.replaceChildren(createGlassIconSvg(/** @type {any} */ (id), { size }));
  });
  const onToggle = () => {
    const open = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!open));
    panel.hidden = open;
    root.classList.toggle("is-open", !open);
  };
  trigger.addEventListener("click", onToggle);
  return () => trigger.removeEventListener("click", onToggle);
}

/**
 * @param {any} member
 */
function renderProgressSection(member, opts = {}) {
  const selfView = opts.viewer === "self";
  const prog = member.progress;
  if (!prog || member.placement_status !== "completed") {
    return `<section class="crew-panel__block">
      <h2 class="crew-panel__block-title">Tu explorador en el viaje</h2>
      <p class="crew-panel__helper">Completa el examen de acceso para ver niveles.</p>
    </section>`;
  }
  const gp = prog.general_progress;
  const rank = prog.rank;
  const rankNext = prog.rank_next;
  const subjects = Array.isArray(prog.subjects) ? prog.subjects : [];
  const subjectBars = subjects
    .filter((s) => s.level_progress)
    .map((s) => {
      const lp = s.level_progress;
      const curRank = s.rank_label || "";
      const nextRank = s.rank_next_label || "";
      return renderSubjectProgressRow(s.label || "", lp.percent_to_next, curRank, nextRank);
    })
    .join("");
  const gpLeft = selfView
    ? rank?.label_child || rank?.label_tutor || "Explorador"
    : rank?.label_tutor || rank?.label_child || "Explorador";
  const gpRight = selfView
    ? rankNext?.label_child || rankNext?.label_tutor || ""
    : rankNext?.label_tutor || rankNext?.label_child || "";
  const pendingHint =
    gp?.hint_tutor && String(gp.hint_tutor).includes("materias pendientes")
      ? `<p class="crew-panel__helper">${escapeHtml(gp.hint_tutor)}</p>`
      : "";
  return `<section class="crew-panel__block crew-progress">
    <h2 class="crew-panel__block-title">Tu explorador en el viaje</h2>
    ${gp ? renderLevelBar(gp.percent_to_next, gpLeft, gpRight, { showRing: true }) : ""}
    ${selfView ? "" : pendingHint}
    ${selfView ? "" : renderRankLegend(member)}
    ${subjectBars}
  </section>`;
}

/**
 * @param {any} member
 */
function renderJourneyMapSection(member) {
  const j = member.journey;
  if (!j) return "";
  const completed = Array.isArray(j.zones_completed_labels) ? j.zones_completed_labels : [];
  const pending = Array.isArray(j.pending_destinations) ? j.pending_destinations : [];
  const quest = j.active_quest;
  return `<section class="crew-panel__block">
    <h2 class="crew-panel__block-title">Mapa del viaje</h2>
    ${j.active_zone_label ? `<p class="crew-panel__helper">Zona activa: ${escapeHtml(j.active_zone_label)}</p>` : ""}
    ${quest ? `<p class="crew-panel__helper">Misión: ${escapeHtml(quest.title_child)} (${quest.steps_done}/${quest.steps_total})</p>` : ""}
    ${completed.length ? `<p class="crew-panel__helper">Zonas superadas: ${completed.map((z) => escapeHtml(String(z))).join(", ")}</p>` : ""}
    ${pending.length ? `<p class="crew-panel__helper">Destinos pendientes: ${pending.map((z) => escapeHtml(z.label)).join(", ")}</p>` : ""}
  </section>`;
}

/**
 * @param {HTMLTextAreaElement} el
 */
function autoGrowCharacterSummary(el) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.style.overflowY = "hidden";
  el.style.height = "auto";
  const sh = Math.max(CHARACTER_SUMMARY_MIN_HEIGHT_PX, el.scrollHeight);
  if (sh <= CHARACTER_SUMMARY_MAX_HEIGHT_PX) {
    el.style.height = `${sh}px`;
    el.style.overflowY = "hidden";
  } else {
    el.style.height = `${CHARACTER_SUMMARY_MAX_HEIGHT_PX}px`;
    el.style.overflowY = "auto";
  }
  if (typeof start === "number" && typeof end === "number") {
    try {
      el.setSelectionRange(start, end);
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {HTMLElement} card
 * @param {{ hero?: boolean }} [opts]
 */
function paintCrewCardIcons(card, opts = {}) {
  const artSize = opts.hero ? 56 : 36;
  card.querySelectorAll("[data-icon]").forEach((host) => {
    if (!(host instanceof HTMLElement)) return;
    const iconId = host.getAttribute("data-icon");
    if (!iconId) return;
    const size = host.classList.contains("crew-card__art") ? artSize : 14;
    host.replaceChildren(
      createGlassIconSvg(/** @type {import('./shell-ui-icons.js').UiIconId} */ (iconId), { size }),
    );
  });
}

/**
 * @param {HTMLElement} root
 * @param {string} sel
 * @param {import('./shell-ui-icons.js').UiIconId} iconId
 * @param {string} label
 * @param {{ dangerIcon?: boolean }} [opts]
 */
function paintBtn(root, sel, iconId, label, opts = {}) {
  const btn = root.querySelector(sel);
  if (btn instanceof HTMLButtonElement) setGlassButton(btn, iconId, label, opts);
}

/**
 * @param {number} memberCount
 * @param {number} memberLimit
 * @param {boolean} atLimit
 */
function addCrewButtonLabel(memberCount, memberLimit, atLimit) {
  if (atLimit) return "Añadir tripulante";
  const remaining = Math.max(0, memberLimit - memberCount);
  return `Añadir tripulante (te queda espacio para ${remaining})`;
}

/**
 * @param {HTMLElement} container
 * @param {{ session: import('@supabase/supabase-js').Session }} options
 */
export function mountCrewListPanel(container, { session }) {
  const root = document.createElement("div");
  root.className = "crew-panel";
  container.appendChild(root);
  let destroyed = false;
  /** @type {(() => void) | null} */
  let unsubIcons = null;

  async function load() {
    unsubIcons?.();
    unsubIcons = null;
    fillGlassSkeleton(root, { preset: "panel", ariaLabel: "Cargando tripulación" });
    const res = await fetchCrewList(session);
    if (destroyed) return;
    if (!res.ok) {
      root.innerHTML = `
        <p class="crew-panel__error">No hemos podido cargar la tripulación.</p>
        <button type="button" class="crew-panel__btn" data-retry></button>`;
      paintBtn(root, "[data-retry]", "home", "Reintentar");
      unsubIcons = bindGlassIconTheme(root);
      root.querySelector("[data-retry]")?.addEventListener("click", () => void load());
      return;
    }

    const atLimit = res.member_count >= res.member_limit;
    const addLabel = addCrewButtonLabel(res.member_count, res.member_limit, atLimit);
    root.innerHTML = `
      <button type="button" class="crew-panel__btn crew-panel__btn--primary crew-panel__add" data-add ${atLimit ? "disabled" : ""} aria-live="polite"></button>
      ${atLimit ? `<p class="crew-panel__helper crew-panel__add-hint">Has alcanzado el máximo de ${res.member_limit} tripulantes.</p>` : ""}
      <div class="crew-panel__grid" data-list></div>
    `;
    paintBtn(root, "[data-add]", "add", addLabel);
    unsubIcons = bindGlassIconTheme(root);

    const list = root.querySelector("[data-list]");
    if (res.members.length === 0) {
      list.innerHTML = `<p class="crew-panel__empty">Tu tripulación espera al primer miembro.</p>`;
    } else {
      for (const m of res.members) {
        const wrap = document.createElement("div");
        wrap.className = "crew-card-wrap";
        const tone = memberCardTone(m);
        const worldMod = memberWorldModifier(m);

        if (m.is_tutor_profile) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `crew-card crew-card--${tone} ${worldMod}`;
          btn.setAttribute("aria-label", memberCardAriaLabel(m));
          btn.innerHTML = buildCrewMemberCardInner(m);
          paintCrewCardIcons(btn);
          btn.addEventListener("click", () => navigateShellRoute(`/crew/${m.id}`));
          wrap.appendChild(btn);
        } else {
          const card = document.createElement("article");
          card.className = `crew-card crew-card--${tone} ${worldMod}`;
          card.innerHTML = buildCrewListCardInner(m);
          paintCrewCardIcons(card);
          card.querySelector(".crew-card__open")?.addEventListener("click", () => {
            navigateShellRoute(`/crew/${m.id}`);
          });
          card.querySelector(".crew-card__play")?.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            void (async () => {
              const detail = await fetchCrewMember(session, m.id);
              const perms = detail.ok ? detail.member?.permissions : null;
              await gatePlayNavigation(m.id, session, perms);
            })();
          });
          wrap.appendChild(card);
        }
        list.appendChild(wrap);
      }
    }

    root.querySelector("[data-add]")?.addEventListener("click", () => {
      if (!atLimit) navigateShellRoute("/crew/new");
    });
  }

  void load();
  return {
    destroy() {
      destroyed = true;
      unsubIcons?.();
      root.remove();
    },
  };
}

/**
 * @param {HTMLElement} container
 * @param {{ session: import('@supabase/supabase-js').Session }} options
 */
export function mountCrewNewPanel(container, { session }) {
  const root = document.createElement("div");
  root.className = "crew-panel";
  root.innerHTML = `
    <p class="crew-panel__subtitle">Reserva una plaza para un nuevo explorador.</p>
    <p class="crew-panel__body">El tripulante elegirá mundo, nombre y edad en su primera aventura. Aquí configurarás límites y permisos.</p>
    <label class="crew-panel__label">Nota para ti (opcional)
      <input class="crew-panel__input" type="text" maxlength="40" data-label placeholder="p. ej. El de Marta" />
    </label>
    <p class="crew-panel__error" data-error hidden></p>
    <div class="crew-panel__actions">
      <button type="button" class="crew-panel__btn" data-cancel></button>
      <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-create></button>
    </div>
  `;
  container.appendChild(root);
  paintBtn(root, "[data-cancel]", "close", "Cancelar");
  paintBtn(root, "[data-create]", "add", "Crear tripulante");
  const unsubIcons = bindGlassIconTheme(root);

  const err = root.querySelector("[data-error]");
  root.querySelector("[data-cancel]")?.addEventListener("click", () => navigateShellRoute("/crew"));
  root.querySelector("[data-create]")?.addEventListener("click", async () => {
    const input = root.querySelector("[data-label]");
    const tutor_label =
      input instanceof HTMLInputElement && input.value.trim() ? input.value.trim() : undefined;
    const createBtn = root.querySelector("[data-create]");
    if (createBtn instanceof HTMLButtonElement) createBtn.disabled = true;
    const res = await createCrewMember(session, tutor_label ? { tutor_label } : {});
    if (!res.ok) {
      if (err instanceof HTMLElement) {
        err.hidden = false;
        if (res.error === "Crew member limit reached") {
          err.textContent = "Has alcanzado el máximo de tripulantes.";
        } else if (res.error && res.error !== "create") {
          err.textContent = res.error;
        } else {
          err.textContent = "No hemos podido crear el tripulante.";
        }
      }
      if (createBtn instanceof HTMLButtonElement) createBtn.disabled = false;
      return;
    }
    navigateShellRoute(`/crew/${res.member.id}`);
  });

  return {
    destroy() {
      unsubIcons();
      root.remove();
    },
  };
}

/**
 * @param {HTMLElement} container
 * @param {{ session: import('@supabase/supabase-js').Session; childId: string; onTitleChange?: (title: string) => void }} options
 */
export function mountCrewDetailPanel(container, { session, childId, onTitleChange, viewer = "tutor" }) {
  const root = document.createElement("div");
  root.className = "crew-panel";
  container.appendChild(root);
  let destroyed = false;
  /** @type {(() => void)[]} */
  let cleanups = [];

  function resetCleanups() {
    cleanups.forEach((fn) => fn());
    cleanups = [];
  }

  async function load() {
    resetCleanups();
    fillGlassSkeleton(root, { preset: "panel", ariaLabel: "Cargando tripulante" });
    const res = viewer === "self" ? await fetchMember(session) : await fetchCrewMember(session, childId);
    if (destroyed) return;
    if (!res.ok) {
      root.innerHTML = `
        <p class="crew-panel__error">No hemos podido cargar este tripulante.</p>
        <button type="button" class="crew-panel__btn" data-back></button>`;
      paintBtn(root, "[data-back]", "chevron", "Volver");
      cleanups.push(bindGlassIconTheme(root));
      root.querySelector("[data-back]")?.addEventListener("click", () => navigateShellRoute(viewer === "self" ? "/member" : "/crew"));
      return;
    }
    paint(res.member);
  }

  /** @param {any} member */
  function paint(member) {
    resetCleanups();
    onTitleChange?.(memberSectionTitle({
      display_name: member.display_name,
      tutor_label: member.settings?.tutor_label ?? member.tutor_label ?? "",
      is_tutor_profile: Boolean(member.is_tutor_profile),
    }));
    const isSelf = viewer === "self";
    const p = member.permissions || {};
    const isTutor = Boolean(member.is_tutor_profile);
    const tutorLabel = member.settings?.tutor_label ?? member.tutor_label ?? "";
    const traveler = !isTutor ? member.traveler_profile || {} : null;
    const travelerFeatures = traveler?.features?.length
      ? traveler.features.join("\n")
      : "";
    const characterSummary =
      !isTutor && member.traits?.character_summary
        ? String(member.traits.character_summary).trim()
        : "";
    const listItem = {
      id: member.id,
      display_name: member.display_name,
      age_years: member.age_years,
      age_band: member.age_band,
      world_theme: member.world_theme,
      status: member.status,
      onboarding_step: member.onboarding_step,
      placement_status: member.placement_status,
      tutor_label: tutorLabel,
      is_tutor_profile: isTutor,
      rank_label: member.rank?.label_child || member.rank?.label_tutor || "",
      general_level: member.general_level || member.progress?.general_level || null,
      explorer_gender: member.explorer_gender,
      explorer_gender_label: member.explorer_gender_label,
    };
    /** @type {"male" | "female"} */
    let selectedGender = member.explorer_gender === "female" ? "female" : "male";
    const profileBlock = `
      <section class="crew-panel__block">
        <h2 class="crew-panel__block-title">Perfil</h2>
        <label class="crew-panel__label">${isTutor ? "Tu nombre en la tripulación" : "Nombre de tripulación"}
          <input class="crew-panel__input" data-profile="display_name" value="${escapeAttr(member.display_name || "")}" maxlength="24" />
        </label>
        ${
          isSelf
            ? ""
            : `<label class="crew-panel__label">Descripción (solo para ti)
          <input class="crew-panel__input" data-profile="tutor_label" value="${escapeAttr(String(tutorLabel))}" maxlength="40" placeholder="${isTutor ? "p. ej. Tu perfil de tutor" : "p. ej. El de Marta"}" />
        </label>
        <p class="crew-panel__helper">${
          isTutor
            ? "Esta nota solo la ves tú en el listado."
            : "Esta nota solo la ves tú; ayuda a identificar al tripulante en el listado."
        }</p>`
        }
        ${
          !isTutor
            ? `<section class="crew-panel__block crew-panel__block--nested">
        <h3 class="crew-panel__block-title">Personaje en el viaje</h3>
        <p class="crew-panel__helper">Generado en la primera aventura; la IA puede haber inventado detalles. Revísalos y corrígelos aquí.</p>
        <label class="crew-panel__label">Especie / tipo
          <input class="crew-panel__input" data-traveler="species" value="${escapeAttr(traveler?.species || "")}" maxlength="64" placeholder="p. ej. Intérprete del viento" />
        </label>
        <label class="crew-panel__label">Colores (paleta)
          <input class="crew-panel__input" data-traveler="palette" value="${escapeAttr(traveler?.palette || "")}" maxlength="64" placeholder="p. ej. verde y dorado (deja vacío si no aplica)" />
        </label>
        <label class="crew-panel__label">Rasgos (uno por línea)
          <textarea class="crew-panel__input crew-panel__input--character-summary" data-traveler="features" rows="3" maxlength="480" spellcheck="false">${escapeHtml(travelerFeatures)}</textarea>
        </label>
        <label class="crew-panel__label">Descripción narrativa
          <textarea class="crew-panel__input crew-panel__input--character-summary" data-traveler="description_md" rows="3" maxlength="1200" spellcheck="false">${escapeHtml(traveler?.description_md || "")}</textarea>
        </label>
      </section>`
            : ""
        }
        ${
          !isTutor
            ? `<label class="crew-panel__label">Descripción del personaje (resumen tutor)
          <textarea
            class="crew-panel__input crew-panel__input--character-summary"
            data-profile="character_summary"
            rows="2"
            maxlength="600"
            spellcheck="false"
            autocorrect="off"
            autocapitalize="sentences"
            placeholder="Tipo de personaje, aspecto, personalidad y logros…"
            aria-label="Descripción del personaje"
          >${escapeHtml(characterSummary)}</textarea>
        </label>
        <p class="crew-panel__helper">La aventura puede actualizar la descripción y los logros; puedes corregirlos aquí.</p>`
            : ""
        }
        ${
          isTutor
            ? ""
            : isSelf
            ? `<p class="crew-panel__helper">Mundo de juego: ${escapeHtml(member.world_theme === "sci-fi" ? "Ciencia ficción" : member.world_theme === "fantasy" ? "Fantasía" : "Sin mundo aún")}</p>
        <p class="crew-panel__helper">Edad: ${member.age_years != null ? `${member.age_years} años` : "Pendiente"}</p>
        <label class="crew-panel__label">Sexo
          <div data-gender-host></div>
        </label>`
            : `<label class="crew-panel__label">Mundo de juego
          <div class="crew-panel__segment" data-world-segment>
            <button type="button" class="crew-panel__chip" data-world="fantasy" aria-pressed="false">Fantasía</button>
            <button type="button" class="crew-panel__chip" data-world="sci-fi" aria-pressed="false">Ciencia ficción</button>
          </div>
          <p class="crew-panel__helper" data-world-hint></p>
        </label>`
        }
        ${
          isTutor || isSelf
            ? ""
            : `<label class="crew-panel__label">Edad
          <div data-age-host></div>
        </label>
        <label class="crew-panel__label">Sexo
          <div data-gender-host></div>
        </label>
        <label class="crew-panel__label">Estado
          <div data-status-host></div>
        </label>`
        }
        <p class="crew-panel__status" data-profile-status aria-live="polite"></p>
        <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-save-profile></button>
      </section>`;
    const permissionsBlock = `
      <section class="crew-panel__block">
        <h2 class="crew-panel__block-title">Permisos y límites</h2>
        <label class="crew-panel__check"><input type="checkbox" data-perm="allow_solo_start" ${p.allow_solo_start ? "checked" : ""}/> Puede empezar la aventura sin mí</label>
        <label class="crew-panel__check"><input type="checkbox" data-perm="require_exit_pin" ${p.require_exit_pin ? "checked" : ""}/> Pedir PIN antes de continuar con la aventura</label>
        <label class="crew-panel__label">PIN (4 dígitos)
          <input class="crew-panel__input" data-pin type="password" inputmode="numeric" maxlength="4" placeholder="${p.exit_pin_set ? "••••" : "····"}" />
        </label>
        <label class="crew-panel__check"><input type="checkbox" data-perm="can_choose_story_branch" ${p.can_choose_story_branch ? "checked" : ""}/> Puede elegir el siguiente camino</label>
        <label class="crew-panel__check"><input type="checkbox" data-perm="lock_world_theme" ${p.lock_world_theme ? "checked" : ""}/> Bloquear cambio de mundo</label>
        <div data-duration-host></div>
        <p class="crew-panel__label">Texto en aventuras</p>
        <div class="crew-panel__segment">
          ${["md", "lg", "xl"]
            .map((v) => {
              const label = v === "md" ? "Normal" : v === "lg" ? "Grande" : "Muy grande";
              return `<button type="button" class="crew-panel__chip" data-font="${v}" aria-pressed="${p.font_scale_play === v}">${label}</button>`;
            })
            .join("")}
        </div>
        <p class="crew-panel__status" data-perm-status aria-live="polite"></p>
        <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-save-perm></button>
      </section>`;
    const subjectsBlock = `
      <section class="crew-panel__block" data-subjects-block>
        <h2 class="crew-panel__block-title">Materias de aprendizaje</h2>
        <p class="crew-panel__helper">Activa materias y añade notas si quieres. Esta información se tendrá en cuenta para generar la historia del viaje, los retos y aprendizajes.</p>
        <label class="crew-panel__label">Información adicional (general)
          <textarea
            class="crew-panel__input"
            data-general-note
            rows="2"
            maxlength="400"
            placeholder="${escapeAttr(GENERAL_NOTE_PLACEHOLDER)}"
            aria-label="Información adicional general del explorador"
          >${escapeHtml(generalNoteFromLearning(member.settings?.learning))}</textarea>
        </label>
        <p class="crew-panel__helper">Contexto del explorador no ligado a una materia (edad, ritmo, intereses).</p>
        <div class="crew-panel__subjects" data-subjects-host></div>
        <p class="crew-panel__helper" data-subjects-warn hidden>Más de 10 materias: el examen puede ser largo; se puede reanudar.</p>
        <p class="crew-panel__status" data-subjects-status aria-live="polite"></p>
        <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-save-subjects></button>
      </section>`;
    const journeyPlayBlock = `
      <section class="crew-panel__block">
        <h2 class="crew-panel__block-title">Aventura</h2>
        <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-play>Entrar en la aventura</button>
      </section>
      <section class="crew-panel__block" data-journey-block>
        <h2 class="crew-panel__block-title">Diario del viaje</h2>
        <div class="crew-panel__helper" data-journey-summary></div>
        <ol class="crew-panel__timeline glass-scroll-fade" data-journey-timeline aria-label="Cronología del viaje"></ol>
        <button type="button" class="crew-panel__btn" data-journey-more hidden>Ver más</button>
      </section>`;
    const dangerBlock = `
      <section class="crew-panel__block crew-panel__block--danger">
        <h2 class="crew-panel__block-title">Zona peligrosa</h2>
        <button type="button" class="crew-panel__btn crew-panel__btn--danger" data-delete></button>
      </section>`;
    const heroTone = memberCardTone(listItem);
    root.innerHTML = `
      <div class="crew-panel__hero-wrap">
        <article
          class="crew-card crew-card--hero crew-card--${heroTone} ${memberWorldModifier(listItem)}"
          aria-label="${escapeAttr(memberCardAriaLabel(listItem))}"
        >${buildCrewMemberCardInner(listItem)}</article>
      </div>
      ${
        isTutor
          ? `<p class="crew-panel__helper">Siempre formas parte de la tripulación. Puedes editar tu nombre y nota, pero no eliminarte.</p>
      ${profileBlock}
      ${permissionsBlock}`
          : `<div class="crew-panel__tabs" role="tablist" aria-label="Secciones del tripulante">
        <button type="button" class="crew-panel__tab" role="tab" data-crew-tab="details" aria-selected="true">Detalles</button>
        <button type="button" class="crew-panel__tab" role="tab" data-crew-tab="journey" aria-selected="false">Viaje</button>
        <button type="button" class="crew-panel__tab" role="tab" data-crew-tab="progress" aria-selected="false">Progreso</button>
        <button type="button" class="crew-panel__tab" role="tab" data-crew-tab="baggage" aria-selected="false">Equipaje</button>
        ${isSelf ? "" : `<button type="button" class="crew-panel__tab" role="tab" data-crew-tab="settings" aria-selected="false">Ajustes</button>`}
      </div>
      <div class="crew-panel__tab-panel" data-crew-panel="details">
        ${profileBlock}
      </div>
      <div class="crew-panel__tab-panel" data-crew-panel="journey" hidden>
        ${renderJourneyMapSection(member)}
        ${journeyPlayBlock}
        ${
          isSelf
            ? ""
            : `<section class="crew-panel__block">
          <h2 class="crew-panel__block-title">Informe para el tutor</h2>
          <p class="crew-panel__helper">Genera un resumen de evaluación en el ledger del viaje.</p>
          <button type="button" class="crew-panel__btn" data-tutor-report>Generar informe</button>
          <pre class="crew-panel__helper" data-tutor-report-preview hidden style="white-space:pre-wrap;max-height:12rem;overflow:auto"></pre>
        </section>`
        }
      </div>
      <div class="crew-panel__tab-panel" data-crew-panel="progress" hidden>
        ${renderProgressSection(member, { viewer })}
        ${isSelf ? renderSubjectsReadOnly(member) : subjectsBlock}
      </div>
      <div class="crew-panel__tab-panel" data-crew-panel="baggage" hidden>
        <section class="crew-panel__block">
          <h2 class="crew-panel__block-title">Equipaje</h2>
          <div data-crew-baggage-host></div>
        </section>
      </div>
      ${
        isSelf
          ? ""
          : `<div class="crew-panel__tab-panel" data-crew-panel="settings" hidden>
        ${inviteAccessBlock(member)}
        ${permissionsBlock}
        ${dangerBlock}
      </div>`
      }
      `
      }
    `;

    if (!isTutor) {
      applyCrewMemberWorldTheme(member.world_theme);
      cleanups.push(() => applyCrewMemberWorldTheme(null));
      const defaultTab = member.placement_status === "completed" ? "journey" : "details";
      /** @type {string} */
      let activeTab = sessionStorage.getItem(crewTabStorageKey(member.id)) || defaultTab;
      const allowedTabs = isSelf
        ? ["details", "journey", "progress", "baggage"]
        : ["details", "journey", "progress", "baggage", "settings"];
      if (!allowedTabs.includes(activeTab)) activeTab = defaultTab;
      /** @type {any} */
      let baggageCache = null;
      /** @type {'inventory' | 'used'} */
      let baggageViewMode =
        sessionStorage.getItem(crewBaggageViewStorageKey(member.id)) === "used"
          ? "used"
          : "inventory";
      /**
       * @param {string} name
       */
      const setTab = (name) => {
        activeTab = name;
        sessionStorage.setItem(crewTabStorageKey(member.id), name);
        root.querySelectorAll("[data-crew-tab]").forEach((btn) => {
          if (!(btn instanceof HTMLButtonElement)) return;
          const on = btn.getAttribute("data-crew-tab") === name;
          btn.setAttribute("aria-selected", String(on));
        });
        root.querySelectorAll("[data-crew-panel]").forEach((panel) => {
          if (!(panel instanceof HTMLElement)) return;
          panel.hidden = panel.getAttribute("data-crew-panel") !== name;
        });
        if (name === "baggage") void loadBaggageTab();
      };
      /**
       * @param {any} bag
       */
      const paintBaggage = (bag) => {
        const host = root.querySelector("[data-crew-baggage-host]");
        if (!(host instanceof HTMLElement)) return;
        host.innerHTML = renderBaggageHtml(bag, {
          audience: "tutor",
          viewMode: baggageViewMode,
        });
        host.querySelectorAll("[data-icon]").forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const id = baggageGlyphId(el.getAttribute("data-icon") || "baggage");
          const size = el.classList.contains("crew-baggage__icon")
            ? 36
            : el.classList.contains("crew-baggage__section-title-icon")
              ? 20
              : 24;
          el.replaceChildren(createGlassIconSvg(/** @type {any} */ (id), { size }));
        });
        wireBaggageViewToggle(host, (mode) => {
          baggageViewMode = mode;
          sessionStorage.setItem(crewBaggageViewStorageKey(member.id), mode);
          paintBaggage(bag);
        });
        if (baggageViewMode === "inventory") {
          wireBaggageGrid(host, bag.items || [], { audience: "tutor" });
        }
      };
      async function loadBaggageTab() {
        const host = root.querySelector("[data-crew-baggage-host]");
        if (!(host instanceof HTMLElement)) return;
        if (baggageCache) {
          paintBaggage(baggageCache);
          return;
        }
        fillGlassSkeleton(host, { preset: "panel", ariaLabel: "Cargando equipaje" });
        const res = isSelf
          ? await fetchMemberBaggage(session)
          : await fetchCrewBaggage(session, member.id, member.world_theme, {
          includeUsage: true,
        });
        if (!res.ok || !res.baggage) {
          host.innerHTML = `<p class="crew-panel__helper">No se pudo cargar el equipaje.</p>
            <button type="button" class="crew-panel__btn" data-baggage-retry>Reintentar</button>`;
          host.querySelector("[data-baggage-retry]")?.addEventListener("click", () => {
            baggageCache = null;
            void loadBaggageTab();
          });
          return;
        }
        baggageCache = res.baggage;
        paintBaggage(baggageCache);
      }
      root.querySelectorAll("[data-crew-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const name = btn.getAttribute("data-crew-tab");
          if (name) setTab(name);
        });
      });
      setTab(activeTab);
    }
    paintBtn(root, "[data-save-profile]", "save", "Guardar perfil");
    paintBtn(root, "[data-save-perm]", "save", "Guardar permisos");
    paintBtn(root, "[data-save-invite]", "save", "Guardar correo");
    if (!isTutor) {
      paintBtn(root, "[data-save-subjects]", "save", "Guardar materias");
      const catalog =
        Array.isArray(member.subject_catalog) && member.subject_catalog.length
          ? member.subject_catalog
          : SUBJECT_CATALOG;
      const active = normalizeActiveSubjects(
        member.active_subjects ?? member.settings?.learning?.active_subjects,
      );
      const host = root.querySelector("[data-subjects-host]");
      if (host instanceof HTMLElement) {
        host.innerHTML = renderSubjectsChecklistHtml(catalog, active, {
          progressSubjects: Array.isArray(member.progress?.subjects)
            ? member.progress.subjects
            : [],
          subjectNotes: subjectNotesById(member.settings?.learning),
          subjectPriorities: subjectPrioritiesFromLearning(member.settings?.learning),
        });
        cleanups.push(mountSubjectNoteDisclosures(host));
      }
      const warn = root.querySelector("[data-subjects-warn]");
      const syncWarn = () => {
        const n = root.querySelectorAll("[data-subject]:checked").length;
        if (warn instanceof HTMLElement) warn.hidden = n <= 10;
        root.querySelectorAll(".crew-subject-card").forEach((card) => {
          const input = card.querySelector("[data-subject]");
          card.classList.toggle(
            "is-on",
            input instanceof HTMLInputElement && input.checked,
          );
        });
      };
      syncWarn();
      root.querySelectorAll("[data-subject]").forEach((el) => {
        el.addEventListener("change", syncWarn);
      });
    }
    if (!isTutor) {
      paintBtn(root, "[data-play]", "save", "Entrar en la aventura");
      paintBtn(root, "[data-delete]", "danger", "Eliminar de la tripulación", { dangerIcon: true });
      root.querySelector("[data-play]")?.addEventListener("click", () => {
        void gatePlayNavigation(member.id, session, p);
      });
      paintBtn(root, "[data-tutor-report]", "save", "Generar informe");
      root.querySelector("[data-tutor-report]")?.addEventListener("click", () => {
        const btn = root.querySelector("[data-tutor-report]");
        if (!(btn instanceof HTMLButtonElement)) return;
        void runGlassButtonAction(
          btn,
          async () => {
            const res = await requestTutorReport(session, member.id);
            const preview = root.querySelector("[data-tutor-report-preview]");
            if (res.ok && preview instanceof HTMLElement) {
              preview.hidden = false;
              preview.textContent = String(res.body || res.filename || "Informe listo");
            }
            return {
              ok: Boolean(res.ok),
              error: res.ok ? undefined : "No hemos podido generar el informe.",
            };
          },
          { successMessage: "Informe generado" },
        );
      });
      void loadJourneyTimeline(root, session, member.id);
    }
    const hero = root.querySelector(".crew-card--hero");
    if (hero instanceof HTMLElement) paintCrewCardIcons(hero, { hero: true });
    cleanups.push(bindGlassIconTheme(root));
    cleanups.push(mountRankLegend(root));

    /** @type {number} */
    let selectedMins = normalizeSessionMinutes(p.max_session_minutes || 10);
    /** @type {string} */
    let selectedFont = p.font_scale_play || "md";
    /** @type {string} */
    let selectedStatus = member.status === "paused" ? "paused" : "active";
    /** @type {string | null} */
    let selectedWorld = member.world_theme ?? null;
    const worldLocked = Boolean(p.lock_world_theme && member.world_theme);
    const worldHintEl = root.querySelector("[data-world-hint]");
    const worldSegment = root.querySelector("[data-world-segment]");

    if (worldHintEl instanceof HTMLElement) {
      if (!member.world_theme) {
        worldHintEl.textContent = "Elige el mundo activo o déjalo para la primera aventura.";
      } else if (worldLocked) {
        worldHintEl.textContent =
          "Mundo bloqueado. Desmarca «Bloquear cambio de mundo» en Ajustes para cambiarlo.";
      } else {
        worldHintEl.textContent = "Cambia el mundo activo; el progreso se guarda por mundo.";
      }
    }

    if (worldSegment instanceof HTMLElement) {
      worldSegment.hidden = false;
      worldSegment.querySelectorAll("[data-world]").forEach((btn) => {
        const id = btn.getAttribute("data-world");
        const pressed = id === selectedWorld;
        btn.setAttribute("aria-pressed", String(pressed));
        if (worldLocked) {
          btn.setAttribute("disabled", "true");
        } else {
          btn.removeAttribute("disabled");
        }
        btn.addEventListener("click", () => {
          if (worldLocked) return;
          selectedWorld = id;
          worldSegment.querySelectorAll("[data-world]").forEach((b) => {
            b.setAttribute("aria-pressed", String(b.getAttribute("data-world") === selectedWorld));
          });
        });
      });
    }

    const ageHost = root.querySelector("[data-age-host]");
    const genderHost = root.querySelector("[data-gender-host]");
    const statusHost = root.querySelector("[data-status-host]");
    const durationHost = root.querySelector("[data-duration-host]");

    const ageStepper =
      ageHost instanceof HTMLElement
        ? mountAgeStepper(ageHost, {
            value: member.age_years ?? null,
            min: 5,
            max: 14,
          })
        : null;
    if (ageStepper) cleanups.push(() => ageStepper.destroy());

    const genderSelect =
      genderHost instanceof HTMLElement
        ? mountGlassSelect(genderHost, {
            value: selectedGender,
            ariaLabel: "Sexo",
            options: genderSelectOptions(ageStepper?.getValue() ?? member.age_years),
            onChange(v) {
              selectedGender = v === "female" ? "female" : "male";
            },
          })
        : null;
    if (genderSelect) cleanups.push(() => genderSelect.destroy());

    const statusSelect =
      statusHost instanceof HTMLElement
        ? mountGlassSelect(statusHost, {
            value: selectedStatus,
            ariaLabel: "Estado",
            options: [
              { value: "active", label: "Activo" },
              { value: "paused", label: "En pausa" },
            ],
            onChange(v) {
              selectedStatus = v;
            },
          })
        : null;
    if (statusSelect) cleanups.push(() => statusSelect.destroy());

    const durationSlider =
      durationHost instanceof HTMLElement
        ? mountDurationSlider(durationHost, {
            value: selectedMins,
            onChange(mins) {
              selectedMins = mins;
            },
          })
        : null;
    if (durationSlider) cleanups.push(() => durationSlider.destroy());

    root.querySelectorAll("[data-font]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedFont = btn.getAttribute("data-font") || "md";
        root.querySelectorAll("[data-font]").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.getAttribute("data-font") === selectedFont));
        });
      });
    });

    const characterSummaryEl = root.querySelector('[data-profile="character_summary"]');
    if (characterSummaryEl instanceof HTMLTextAreaElement) {
      autoGrowCharacterSummary(characterSummaryEl);
      characterSummaryEl.addEventListener("input", () => autoGrowCharacterSummary(characterSummaryEl));
    }

    root.querySelector("[data-save-profile]")?.addEventListener("click", () => {
      const btn = root.querySelector("[data-save-profile]");
      if (!(btn instanceof HTMLButtonElement)) return;
      void runGlassButtonAction(
        btn,
        async () => {
          const nameInput = root.querySelector('[data-profile="display_name"]');
          const descInput = root.querySelector('[data-profile="tutor_label"]');
          const summaryInput = root.querySelector('[data-profile="character_summary"]');
          if (isSelf) {
            /** @type {Record<string, unknown>} */
            const selfPatch = {
              explorer_gender: selectedGender,
            };
            if (nameInput instanceof HTMLInputElement) {
              selfPatch.display_name = nameInput.value.trim() || null;
            }
            if (summaryInput instanceof HTMLTextAreaElement) {
              selfPatch.character_summary = summaryInput.value.trim() || null;
            }
            const speciesInput = root.querySelector('[data-traveler="species"]');
            const paletteInput = root.querySelector('[data-traveler="palette"]');
            const featuresInput = root.querySelector('[data-traveler="features"]');
            const descriptionInput = root.querySelector('[data-traveler="description_md"]');
            /** @type {Record<string, unknown>} */
            const travelerPatch = {};
            if (speciesInput instanceof HTMLInputElement) {
              travelerPatch.species = speciesInput.value.trim();
            }
            if (paletteInput instanceof HTMLInputElement) {
              travelerPatch.palette = paletteInput.value.trim();
            }
            if (featuresInput instanceof HTMLTextAreaElement) {
              travelerPatch.features = featuresInput.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);
            }
            if (descriptionInput instanceof HTMLTextAreaElement) {
              travelerPatch.description_md = descriptionInput.value.trim();
            }
            if (Object.keys(travelerPatch).length > 0) {
              selfPatch.traveler_profile = travelerPatch;
            }
            const res = await patchMember(session, selfPatch);
            if (res.ok) {
              Object.assign(member, res.member);
              if (res.member.traits) member.traits = res.member.traits;
              if (res.member.traveler_profile) member.traveler_profile = res.member.traveler_profile;
            }
            return { ok: res.ok, error: res.ok ? undefined : "No hemos podido guardar el perfil." };
          }
          /** @type {Record<string, unknown>} */
          const patch = {
            age_years: ageStepper?.getValue() ?? null,
            explorer_gender: selectedGender,
          };
          if (!isTutor) {
            patch.status = selectedStatus;
          }
          if (nameInput instanceof HTMLInputElement) {
            patch.display_name = nameInput.value.trim() || null;
          }
          if (descInput instanceof HTMLInputElement) {
            patch.tutor_label = descInput.value.trim() || null;
          }
          if (!isTutor && summaryInput instanceof HTMLTextAreaElement) {
            patch.character_summary = summaryInput.value.trim() || null;
          }
          if (!isTutor) {
            const speciesInput = root.querySelector('[data-traveler="species"]');
            const paletteInput = root.querySelector('[data-traveler="palette"]');
            const featuresInput = root.querySelector('[data-traveler="features"]');
            const descriptionInput = root.querySelector('[data-traveler="description_md"]');
            /** @type {Record<string, unknown>} */
            const travelerPatch = {};
            if (speciesInput instanceof HTMLInputElement) {
              travelerPatch.species = speciesInput.value.trim();
            }
            if (paletteInput instanceof HTMLInputElement) {
              travelerPatch.palette = paletteInput.value.trim();
            }
            if (featuresInput instanceof HTMLTextAreaElement) {
              travelerPatch.features = featuresInput.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);
            }
            if (descriptionInput instanceof HTMLTextAreaElement) {
              travelerPatch.description_md = descriptionInput.value.trim();
            }
            if (Object.keys(travelerPatch).length > 0) {
              patch.traveler_profile = travelerPatch;
            }
          }
          if (!isTutor && selectedWorld && !worldLocked) {
            patch.world_theme = selectedWorld;
          }
          const res = await patchCrewMember(session, childId, patch);
          if (res.ok) {
            // Evitar remount completo: no perder foco ni estado de tabs al guardar.
            Object.assign(member, res.member);
            if (res.member.traits) member.traits = res.member.traits;
            if (res.member.traveler_profile) member.traveler_profile = res.member.traveler_profile;
            if (res.member.world_theme) {
              applyCrewMemberWorldTheme(res.member.world_theme);
              selectedWorld = res.member.world_theme;
            }
          }
          return { ok: res.ok, error: res.ok ? undefined : "No hemos podido guardar el perfil." };
        },
        { successMessage: "Perfil guardado" },
      );
    });

    root.querySelector("[data-save-invite]")?.addEventListener("click", () => {
      const btn = root.querySelector("[data-save-invite]");
      if (!(btn instanceof HTMLButtonElement)) return;
      void runGlassButtonAction(
        btn,
        async () => {
          const input = root.querySelector("[data-invite-email]");
          const value = input instanceof HTMLInputElement ? input.value.trim() : "";
          const res = await patchCrewMember(session, childId, {
            invite_email: value || null,
          });
          if (res.ok) {
            Object.assign(member, res.member);
            return { ok: true };
          }
          const map = {
            invite_email_not_gmail: "Usa un correo Gmail (@gmail.com).",
            invite_email_same_as_tutor: "No puede ser el mismo Gmail que el tuyo.",
            invite_email_is_tutor: "Ese correo ya es una cuenta de tutor.",
            invite_email_taken: "Ese Gmail ya está asignado a otro tripulante.",
            invite_email_tutor_profile: "El perfil de tutor no admite Gmail de tripulante.",
          };
          const error = map[res.error] || res.error || "No hemos podido guardar el correo.";
          return { ok: false, error };
        },
        { successMessage: "Correo guardado" },
      );
    });

    root.querySelector("[data-save-perm]")?.addEventListener("click", () => {
      const btn = root.querySelector("[data-save-perm]");
      if (!(btn instanceof HTMLButtonElement)) return;
      void runGlassButtonAction(
        btn,
        async () => {
          /** @type {Record<string, unknown>} */
          const patch = {
            max_session_minutes: selectedMins,
            font_scale_play: selectedFont,
          };
          root.querySelectorAll("[data-perm]").forEach((input) => {
            if (!(input instanceof HTMLInputElement)) return;
            const key = input.getAttribute("data-perm");
            if (key) patch[key] = input.checked;
          });
          const pinInput = root.querySelector("[data-pin]");
          if (pinInput instanceof HTMLInputElement && pinInput.value.trim()) {
            patch.exit_pin = pinInput.value.trim();
          }
          const res = await patchCrewPermissions(session, childId, patch);
          if (res.ok) paint(res.member);
          return {
            ok: res.ok,
            error: res.ok ? undefined : (res.error || "No hemos podido guardar los permisos."),
          };
        },
        { successMessage: "Permisos guardados" },
      );
    });

    root.querySelector("[data-save-subjects]")?.addEventListener("click", () => {
      if (isTutor) return;
      const btn = root.querySelector("[data-save-subjects]");
      if (!(btn instanceof HTMLButtonElement)) return;
      /** @type {string[]} */
      const selected = [];
      root.querySelectorAll("[data-subject]").forEach((input) => {
        if (!(input instanceof HTMLInputElement)) return;
        const id = input.getAttribute("data-subject");
        if (id && input.checked) selected.push(id);
      });
      if (selected.length < 1) {
        void import("./glass-toast.js").then(({ showGlassToast }) => {
          showGlassToast("Activa al menos una materia.", { variant: "warning", durationMs: 3200 });
        });
        return;
      }
      void runGlassButtonAction(
        btn,
        async () => {
          /** @type {Array<{ subject_id: string, note: string }>} */
          const subject_notes = [];
          root.querySelectorAll("[data-subject-note]").forEach((el) => {
            if (!(el instanceof HTMLTextAreaElement)) return;
            const sid = el.getAttribute("data-subject-note");
            const note = el.value.trim();
            if (sid && note) subject_notes.push({ subject_id: sid, note });
          });
          const generalEl = root.querySelector("[data-general-note]");
          const general_note =
            generalEl instanceof HTMLTextAreaElement ? generalEl.value.trim() : "";
          /** @type {string[]} */
          const subject_priorities = [];
          root.querySelectorAll("[data-subject-priority]").forEach((el) => {
            if (!(el instanceof HTMLInputElement)) return;
            const sid = el.getAttribute("data-subject-priority");
            if (sid && el.checked) subject_priorities.push(sid);
          });
          const res = await patchCrewMember(session, childId, {
            learning: {
              active_subjects: selected,
              subject_notes,
              general_note: general_note || null,
              subject_priorities,
            },
          });
          if (res.ok) {
            Object.assign(member, res.member);
            if (res.member.settings) member.settings = res.member.settings;
            if (Array.isArray(res.member.active_subjects)) {
              member.active_subjects = res.member.active_subjects;
            }
          }
          return {
            ok: res.ok,
            error: res.ok ? undefined : "No hemos podido guardar las materias.",
          };
        },
        { successMessage: "Materias guardadas" },
      );
    });

    root.querySelector("[data-delete]")?.addEventListener("click", (ev) => {
      if (isTutor) return;
      ev.preventDefault();
      ev.stopPropagation();
      const name = memberTitle(listItem);
      void showGlassConfirm({
        title: `¿Eliminar a ${name} de la tripulación?`,
        body: `<p>Se perderá su progreso, el diario del viaje y los datos del examen de nivelación.</p>`,
        footer: "Esta acción no se puede deshacer.",
        size: "md",
        danger: true,
        confirmLabel: "Eliminar de la tripulación",
        onConfirm: async () => {
          const res = await deleteCrewMember(session, childId);
          if (!res.ok) {
            throw new Error("No hemos podido eliminar el tripulante. Inténtalo de nuevo.");
          }
          navigateShellRoute("/crew");
        },
      });
    });
  }

  void load();
  return {
    destroy() {
      destroyed = true;
      resetCleanups();
      root.remove();
    },
  };
}

/**
 * @param {HTMLElement} root
 * @param {import('@supabase/supabase-js').Session} session
 * @param {string} childId
 */
async function loadJourneyTimeline(root, session, childId) {
  const summaryEl = root.querySelector("[data-journey-summary]");
  const listEl = root.querySelector("[data-journey-timeline]");
  if (!(listEl instanceof HTMLOListElement)) return;

  if (summaryEl instanceof HTMLElement) {
    fillGlassSkeleton(summaryEl, { preset: "lines", ariaLabel: "Cargando resumen del viaje" });
  }
  listEl.innerHTML = "";
  const clearInitialSkeleton = mountTimelineSkeletonItems(listEl, { count: 3 });

  /** @type {string | null} */
  let cursor = null;
  let loading = false;
  /** @type {string} */
  let mentorLabel = "Mentor";
  /** @type {string} */
  let explorerLabel = "Explorador";

  /**
   * @param {string} kind
   */
  function eventKindLabel(kind) {
    if (kind === "mentor_utterance") return mentorLabel;
    if (kind === "explorer_reply") return explorerLabel;
    if (kind === "decision") return "Decisión";
    if (kind === "challenge") return "Reto";
    if (kind === "quest") return "Misión";
    return "Sistema";
  }

  /**
   * @param {boolean} append
   */
  async function fetchPage(append) {
    if (loading) return;
    loading = true;
    const moreBtn = root.querySelector("[data-journey-more]");
    if (moreBtn instanceof HTMLButtonElement) {
      moreBtn.disabled = true;
    }
    /** @type {(() => void) | null} */
    let clearAppendSkeleton = null;
    if (append) {
      clearAppendSkeleton = mountTimelineSkeletonItems(listEl, { count: 3 });
    }
    const res = await fetchJourneyTimeline(session, childId, { cursor: cursor ?? undefined, limit: 12 });
    clearAppendSkeleton?.();
    loading = false;
    if (moreBtn instanceof HTMLButtonElement) {
      moreBtn.disabled = false;
    }
    if (!res.ok || !res.data) {
      if (!append) {
        clearInitialSkeleton();
        if (summaryEl instanceof HTMLElement) {
          summaryEl.textContent = "Aún no hay diario del viaje, o no se ha podido cargar.";
        }
        listEl.innerHTML = "";
      }
      const { showGlassToast } = await import("./glass-toast.js");
      showGlassToast("No hemos podido cargar la cronología.", { variant: "error" });
      return;
    }
    const data = res.data;
    if (typeof data.mentor_label === "string" && data.mentor_label.trim()) {
      mentorLabel = data.mentor_label.trim();
    }
    if (typeof data.explorer_label === "string" && data.explorer_label.trim()) {
      explorerLabel = data.explorer_label.trim();
    }
    if (!append) {
      clearInitialSkeleton();
      if (summaryEl instanceof HTMLElement) {
        summaryEl.innerHTML = "";
        summaryEl.textContent = data.summary
          ? String(data.summary)
          : "Todavía no hay un resumen condensado; aparecen abajo los hitos del ledger.";
      }
      listEl.innerHTML = "";
    }
    const events = Array.isArray(data.events) ? data.events : [];
    for (const ev of events) {
      const li = document.createElement("li");
      li.className = "crew-panel__timeline-item";
      const kind = String(ev.kind || "system");
      const summary = escapeHtml(String(ev.summary || ""));
      const at = escapeHtml(formatJourneyAt(String(ev.at || "")));
      li.innerHTML = `<span class="crew-panel__timeline-kind">${escapeHtml(eventKindLabel(kind))}</span>
        <span class="crew-panel__timeline-text">${summary}</span>
        <time class="crew-panel__timeline-at" datetime="${escapeAttr(String(ev.at || ""))}">${at}</time>`;
      listEl.appendChild(li);
    }
    if (!append && events.length === 0 && summaryEl instanceof HTMLElement && !data.summary) {
      summaryEl.textContent = "Este tripulante aún no tiene hitos de viaje.";
    }
    cursor = data.next_cursor ?? null;
    if (moreBtn instanceof HTMLButtonElement) {
      moreBtn.hidden = !cursor;
      paintBtn(root, "[data-journey-more]", "chevron", "Ver más");
    }
  }

  root.addEventListener("click", (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-journey-more]")) {
      ev.preventDefault();
      void fetchPage(true);
    }
  });

  await fetchPage(false);
}

/**
 * Timestamp tutor con segundos (SPEC_APP_JOURNEY_MEMORY §1.4.4).
 * @param {string} iso
 */
function formatJourneyAt(iso) {
  const raw = String(iso || "").trim();
  if (!raw) return "";
  const normalized = raw.replace("T", " ");
  // YYYY-MM-DD HH:MM:SS (+ fracción/zona opcional)
  const m = normalized.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  if (m) return m[1];
  const mMin = normalized.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
  return mMin ? mMin[1] : normalized.slice(0, 19);
}

/** @param {string} s */
function escapeAttr(s) {
  return escapeHtml(s);
}
