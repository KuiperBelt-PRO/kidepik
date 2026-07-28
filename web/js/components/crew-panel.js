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
import {
  bindGlassIconTheme,
  mountAgeStepper,
  mountDurationSlider,
  mountGlassSelect,
  normalizeSessionMinutes,
  setGlassButton,
} from "./glass-controls.js";

/**
 * @param {import('../lib/crew-api.js').CrewListItem} m
 */
function memberTitle(m) {
  return m.display_name || m.tutor_label || "Nuevo tripulante";
}

/**
 * @param {import('../lib/crew-api.js').CrewListItem} m
 */
function memberMeta(m) {
  if (m.onboarding_step !== "complete") return "Pendiente de primera aventura";
  const world =
    m.world_theme === "sci-fi"
      ? "Ciencia ficción"
      : m.world_theme === "fantasy"
        ? "Fantasía"
        : "Sin mundo aún";
  const age = m.age_years != null ? `${m.age_years} años` : "";
  return [world, age].filter(Boolean).join(" · ");
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
    root.innerHTML = `<p class="crew-panel__muted">Cargando…</p>`;
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
    root.innerHTML = `
      <h1 class="crew-panel__title">Tripulación</h1>
      <p class="crew-panel__subtitle">Tripulantes a tu cargo</p>
      <div class="crew-panel__list" data-list></div>
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
        btn.type = "button";
        btn.className = "crew-panel__card";
        btn.innerHTML = `
          <span class="crew-panel__card-title">${escapeHtml(memberTitle(m))}</span>
          <span class="crew-panel__card-meta">${escapeHtml(memberMeta(m))}${m.status === "paused" ? " · En pausa" : ""}</span>
        `;
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
    root.innerHTML = `<p class="crew-panel__muted">Cargando…</p>`;
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
    const title = member.display_name || member.settings?.tutor_label || "Nuevo tripulante";
    root.innerHTML = `
      <button type="button" class="crew-panel__link" data-back></button>
      <h1 class="crew-panel__title">${escapeHtml(title)}</h1>
      <p class="crew-panel__subtitle">${
        member.onboarding_step === "complete"
          ? escapeHtml(
              [
                member.world_theme === "sci-fi"
                  ? "Ciencia ficción"
                  : member.world_theme === "fantasy"
                    ? "Fantasía"
                    : "Sin mundo",
                member.age_years != null ? `${member.age_years} años` : null,
              ]
                .filter(Boolean)
                .join(" · "),
            )
          : "Pendiente de primera aventura"
      }</p>
      <p class="crew-panel__helper">Estos datos los rellena la aventura la primera vez; puedes corregirlos aquí.</p>

      <section class="crew-panel__block">
        <h2 class="crew-panel__block-title">Perfil</h2>
        <label class="crew-panel__label">Nombre de tripulación
          <input class="crew-panel__input" data-profile="display_name" value="${escapeAttr(member.display_name || "")}" maxlength="24" />
        </label>
        <label class="crew-panel__label">Edad
          <div data-age-host></div>
        </label>
        <label class="crew-panel__label">Estado
          <div data-status-host></div>
        </label>
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

      <section class="crew-panel__block crew-panel__block--danger">
        <h2 class="crew-panel__block-title">Zona peligrosa</h2>
        <button type="button" class="crew-panel__btn crew-panel__btn--danger" data-delete></button>
      </section>
    `;

    paintBtn(root, "[data-back]", "chevron", "Tripulación");
    paintBtn(root, "[data-save-profile]", "save", "Guardar perfil");
    paintBtn(root, "[data-save-perm]", "save", "Guardar permisos");
    paintBtn(root, "[data-delete]", "danger", "Eliminar de la tripulación", { dangerIcon: true });
    cleanups.push(bindGlassIconTheme(root));

    /** @type {number} */
    let selectedMins = normalizeSessionMinutes(p.max_session_minutes || 10);
    /** @type {string} */
    let selectedFont = p.font_scale_play || "md";
    /** @type {string} */
    let selectedStatus = member.status === "paused" ? "paused" : "active";

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

    root.querySelector("[data-back]")?.addEventListener("click", () => navigateShellRoute("/crew"));

    root.querySelectorAll("[data-font]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedFont = btn.getAttribute("data-font") || "md";
        root.querySelectorAll("[data-font]").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.getAttribute("data-font") === selectedFont));
        });
      });
    });

    root.querySelector("[data-save-profile]")?.addEventListener("click", async () => {
      const nameInput = root.querySelector('[data-profile="display_name"]');
      /** @type {Record<string, unknown>} */
      const patch = {
        status: selectedStatus,
        age_years: ageStepper?.getValue() ?? null,
      };
      if (nameInput instanceof HTMLInputElement) {
        patch.display_name = nameInput.value.trim() || null;
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

    root.querySelector("[data-delete]")?.addEventListener("click", async () => {
      const name = title;
      const ok = window.confirm(
        `¿Eliminar a ${name} de la tripulación?\n\nSe perderá su progreso y no se puede deshacer.`,
      );
      if (!ok) return;
      const res = await deleteCrewMember(session, childId);
      if (res.ok) navigateShellRoute("/crew");
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

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** @param {string} s */
function escapeAttr(s) {
  return escapeHtml(s);
}
