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
} from "../lib/crew-api.js";
import { fetchJourneyTimeline } from "../lib/play-api.js";
import { applyCrewMemberWorldTheme } from "../lib/play-theme.js";
import {
  bindGlassIconTheme,
  createGlassIconSvg,
  fillGlassSkeleton,
  mountAgeStepper,
  mountDurationSlider,
  mountGlassSelect,
  normalizeSessionMinutes,
  setGlassButton,
} from "./glass-controls.js?v=224";
import { showGlassConfirm } from "./glass-modal.js?v=2";
import {
  buildCrewMemberCardInner,
  escapeHtml,
  memberCardAriaLabel,
  memberCardTone,
  memberTitle,
  memberWorldModifier,
} from "../lib/crew-member-card.js";

/** Altura mínima ~2 líneas; máxima ~4 líneas; scroll nativo sin fade. */
const CHARACTER_SUMMARY_MIN_HEIGHT_PX = 72;
const CHARACTER_SUMMARY_MAX_HEIGHT_PX = 104;

/**
 * @param {HTMLTextAreaElement} el
 */
function autoGrowCharacterSummary(el) {
  el.style.overflowY = "hidden";
  el.style.height = "0";
  const sh = Math.max(CHARACTER_SUMMARY_MIN_HEIGHT_PX, el.scrollHeight);
  if (sh <= CHARACTER_SUMMARY_MAX_HEIGHT_PX) {
    el.style.height = `${sh}px`;
    el.style.overflowY = "hidden";
  } else {
    el.style.height = `${CHARACTER_SUMMARY_MAX_HEIGHT_PX}px`;
    el.style.overflowY = "auto";
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
    const countLabel =
      res.members.length === 0
        ? "Sin tripulantes aún"
        : res.has_tutor_profile && res.member_count > 0
          ? `${res.member_count} de ${res.member_limit} tripulantes (+ tú)`
          : res.has_tutor_profile
            ? "Solo tu perfil de tutor por ahora"
            : `${res.member_count} de ${res.member_limit} tripulantes`;
    root.innerHTML = `
      <h1 class="crew-panel__title">Tripulación</h1>
      <p class="crew-panel__subtitle">Tripulantes a tu cargo</p>
      <p class="crew-panel__count" aria-live="polite">${escapeHtml(countLabel)}</p>
      <div class="crew-panel__grid" data-list></div>
      <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-add ${atLimit ? "disabled" : ""}></button>
      ${atLimit ? `<p class="crew-panel__helper">Has alcanzado el máximo de ${res.member_limit} tripulantes.</p>` : ""}
    `;
    paintBtn(root, "[data-add]", "add", "Añadir tripulante");
    unsubIcons = bindGlassIconTheme(root);

    const list = root.querySelector("[data-list]");
    if (res.members.length === 0) {
      list.innerHTML = `<p class="crew-panel__empty">Tu tripulación espera al primer miembro.</p>`;
    } else {
      for (const m of res.members) {
        const btn = document.createElement("button");
        const tone = memberCardTone(m);
        btn.type = "button";
        btn.className = `crew-card crew-card--${tone} ${memberWorldModifier(m)}`;
        btn.setAttribute("aria-label", memberCardAriaLabel(m));
        btn.innerHTML = buildCrewMemberCardInner(m);
        paintCrewCardIcons(btn);
        btn.addEventListener("click", () => navigateShellRoute(`/crew/${m.id}`));
        list.appendChild(btn);
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
    <h1 class="crew-panel__title">Nuevo tripulante</h1>
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
 * @param {{ session: import('@supabase/supabase-js').Session; childId: string }} options
 */
export function mountCrewDetailPanel(container, { session, childId }) {
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
    const res = await fetchCrewMember(session, childId);
    if (destroyed) return;
    if (!res.ok) {
      root.innerHTML = `
        <p class="crew-panel__error">No hemos podido cargar este tripulante.</p>
        <button type="button" class="crew-panel__btn" data-back></button>`;
      paintBtn(root, "[data-back]", "chevron", "Volver");
      cleanups.push(bindGlassIconTheme(root));
      root.querySelector("[data-back]")?.addEventListener("click", () => navigateShellRoute("/crew"));
      return;
    }
    paint(res.member);
  }

  /** @param {any} member */
  function paint(member) {
    resetCleanups();
    const p = member.permissions || {};
    const isTutor = Boolean(member.is_tutor_profile);
    const tutorLabel = member.settings?.tutor_label ?? member.tutor_label ?? "";
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
    };
    const heroTone = memberCardTone(listItem);
    root.innerHTML = `
      <div class="crew-panel__hero-wrap">
        <article
          class="crew-card crew-card--hero crew-card--${heroTone} ${memberWorldModifier(listItem)}"
          aria-label="${escapeAttr(memberCardAriaLabel(listItem))}"
        >${buildCrewMemberCardInner(listItem)}</article>
      </div>
      <p class="crew-panel__helper">${
        isTutor
          ? "Siempre formas parte de la tripulación. Puedes editar tu nombre y nota, pero no eliminarte."
          : "Estos datos los rellena la aventura la primera vez; puedes corregirlos aquí."
      }</p>

      <section class="crew-panel__block">
        <h2 class="crew-panel__block-title">Perfil</h2>
        <label class="crew-panel__label">${isTutor ? "Tu nombre en la tripulación" : "Nombre de tripulación"}
          <input class="crew-panel__input" data-profile="display_name" value="${escapeAttr(member.display_name || "")}" maxlength="24" />
        </label>
        <label class="crew-panel__label">Descripción (solo para ti)
          <input class="crew-panel__input" data-profile="tutor_label" value="${escapeAttr(String(tutorLabel))}" maxlength="40" placeholder="${isTutor ? "p. ej. Tu perfil de tutor" : "p. ej. El de Marta"}" />
        </label>
        <p class="crew-panel__helper">${
          isTutor
            ? "Esta nota solo la ves tú en el listado."
            : "Esta nota solo la ves tú; ayuda a identificar al tripulante en el listado."
        }</p>
        ${
          !isTutor
            ? `<label class="crew-panel__label">Descripción del personaje
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
        <p class="crew-panel__helper">Evoluciona con la aventura; puedes corregirla aquí.</p>`
            : ""
        }
        ${
          isTutor
            ? ""
            : `<label class="crew-panel__label">Mundo de juego
          <div class="crew-panel__segment" data-world-segment hidden>
            <button type="button" class="crew-panel__chip" data-world="fantasy" aria-pressed="false">Fantasía</button>
            <button type="button" class="crew-panel__chip" data-world="sci-fi" aria-pressed="false">Ciencia ficción</button>
          </div>
          <p class="crew-panel__helper" data-world-hint></p>
        </label>`
        }
        ${
          isTutor
            ? ""
            : `<label class="crew-panel__label">Edad
          <div data-age-host></div>
        </label>
        <label class="crew-panel__label">Estado
          <div data-status-host></div>
        </label>`
        }
        <p class="crew-panel__status" data-profile-status aria-live="polite"></p>
        <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-save-profile></button>
      </section>

      <section class="crew-panel__block">
        <h2 class="crew-panel__block-title">Permisos y límites</h2>
        <label class="crew-panel__check"><input type="checkbox" data-perm="allow_solo_start" ${p.allow_solo_start ? "checked" : ""}/> Puede empezar la aventura sin mí</label>
        <label class="crew-panel__check"><input type="checkbox" data-perm="require_exit_pin" ${p.require_exit_pin ? "checked" : ""}/> Pedir PIN al salir de la aventura</label>
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
      </section>

      ${
        isTutor
          ? ""
          : `<section class="crew-panel__block">
        <h2 class="crew-panel__block-title">Aventura</h2>
        <button type="button" class="crew-panel__btn crew-panel__btn--primary" data-play>Entrar en la aventura</button>
      </section>
      <section class="crew-panel__block" data-journey-block>
        <h2 class="crew-panel__block-title">Diario del viaje</h2>
        <p class="crew-panel__helper" data-journey-summary>Cargando resumen…</p>
        <ol class="crew-panel__timeline glass-scroll-fade" data-journey-timeline aria-label="Cronología del viaje"></ol>
        <button type="button" class="crew-panel__btn" data-journey-more hidden>Ver más</button>
        <p class="crew-panel__status" data-journey-status aria-live="polite"></p>
      </section>
      <section class="crew-panel__block crew-panel__block--danger">
        <h2 class="crew-panel__block-title">Zona peligrosa</h2>
        <button type="button" class="crew-panel__btn crew-panel__btn--danger" data-delete></button>
      </section>`
      }
    `;

    if (!isTutor) {
      applyCrewMemberWorldTheme(member.world_theme);
      cleanups.push(() => applyCrewMemberWorldTheme(null));
    }
    paintBtn(root, "[data-save-profile]", "save", "Guardar perfil");
    paintBtn(root, "[data-save-perm]", "save", "Guardar permisos");
    if (!isTutor) {
      paintBtn(root, "[data-play]", "save", "Entrar en la aventura");
      paintBtn(root, "[data-delete]", "danger", "Eliminar de la tripulación", { dangerIcon: true });
      root.querySelector("[data-play]")?.addEventListener("click", () => {
        void navigateShellRoute(`/play/${member.id}`);
      });
      void loadJourneyTimeline(root, session, member.id);
    }
    const hero = root.querySelector(".crew-card--hero");
    if (hero instanceof HTMLElement) paintCrewCardIcons(hero, { hero: true });
    cleanups.push(bindGlassIconTheme(root));

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
        worldHintEl.textContent = "Lo elegirá en su primera aventura.";
      } else if (worldLocked) {
        worldHintEl.textContent =
          "Mundo elegido en la aventura. Desbloquea «Bloquear cambio de mundo» en permisos para cambiarlo.";
      } else {
        worldHintEl.textContent = "Puedes corregir el mundo si aún no ha empezado la aventura.";
      }
    }

    if (worldSegment instanceof HTMLElement && member.world_theme) {
      worldSegment.hidden = false;
      worldSegment.querySelectorAll("[data-world]").forEach((btn) => {
        const id = btn.getAttribute("data-world");
        const pressed = id === selectedWorld;
        btn.setAttribute("aria-pressed", String(pressed));
        if (worldLocked) {
          btn.setAttribute("disabled", "true");
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

    root.querySelector("[data-save-profile]")?.addEventListener("click", async () => {
      const nameInput = root.querySelector('[data-profile="display_name"]');
      const descInput = root.querySelector('[data-profile="tutor_label"]');
      const summaryInput = root.querySelector('[data-profile="character_summary"]');
      /** @type {Record<string, unknown>} */
      const patch = {
        age_years: ageStepper?.getValue() ?? null,
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
      if (!isTutor && selectedWorld && !worldLocked) {
        patch.world_theme = selectedWorld;
      }
      const status = root.querySelector("[data-profile-status]");
      const res = await patchCrewMember(session, childId, patch);
      if (status instanceof HTMLElement) {
        status.textContent = res.ok ? "Guardado" : "No hemos podido guardar.";
      }
      if (res.ok) paint(res.member);
    });

    root.querySelector("[data-save-perm]")?.addEventListener("click", async () => {
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
      const status = root.querySelector("[data-perm-status]");
      const res = await patchCrewPermissions(session, childId, patch);
      if (status instanceof HTMLElement) {
        status.textContent = res.ok ? "Guardado" : res.error || "No hemos podido guardar.";
      }
      if (res.ok) paint(res.member);
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
  const statusEl = root.querySelector("[data-journey-status]");
  if (!(listEl instanceof HTMLOListElement)) return;

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
    if (statusEl instanceof HTMLElement) {
      statusEl.textContent = append ? "Cargando más…" : "";
    }
    const res = await fetchJourneyTimeline(session, childId, { cursor: cursor ?? undefined, limit: 12 });
    loading = false;
    if (!res.ok || !res.data) {
      if (summaryEl instanceof HTMLElement) {
        summaryEl.textContent = "Aún no hay diario del viaje, o no se ha podido cargar.";
      }
      if (statusEl instanceof HTMLElement) statusEl.textContent = "No hemos podido cargar la cronología.";
      return;
    }
    const data = res.data;
    if (typeof data.mentor_label === "string" && data.mentor_label.trim()) {
      mentorLabel = data.mentor_label.trim();
    }
    if (typeof data.explorer_label === "string" && data.explorer_label.trim()) {
      explorerLabel = data.explorer_label.trim();
    }
    if (!append && summaryEl instanceof HTMLElement) {
      summaryEl.textContent = data.summary
        ? String(data.summary)
        : "Todavía no hay un resumen condensado; aparecen abajo los hitos del ledger.";
    }
    const events = Array.isArray(data.events) ? data.events : [];
    if (!append) listEl.innerHTML = "";
    for (const ev of events) {
      const li = document.createElement("li");
      li.className = "crew-panel__timeline-item";
      const kind = String(ev.kind || "system");
      const summary = escapeHtml(String(ev.summary || ""));
      const at = escapeHtml(String(ev.at || "").replace("T", " ").slice(0, 16));
      li.innerHTML = `<span class="crew-panel__timeline-kind">${escapeHtml(eventKindLabel(kind))}</span>
        <span class="crew-panel__timeline-text">${summary}</span>
        <time class="crew-panel__timeline-at" datetime="${escapeAttr(String(ev.at || ""))}">${at}</time>`;
      listEl.appendChild(li);
    }
    if (!append && events.length === 0 && summaryEl instanceof HTMLElement && !data.summary) {
      summaryEl.textContent = "Este tripulante aún no tiene hitos de viaje.";
    }
    cursor = data.next_cursor ?? null;
    const moreBtn = root.querySelector("[data-journey-more]");
    if (moreBtn instanceof HTMLButtonElement) {
      moreBtn.hidden = !cursor;
      paintBtn(root, "[data-journey-more]", "chevron", "Ver más");
    }
    if (statusEl instanceof HTMLElement) statusEl.textContent = "";
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

/** @param {string} s */
function escapeAttr(s) {
  return escapeHtml(s);
}
