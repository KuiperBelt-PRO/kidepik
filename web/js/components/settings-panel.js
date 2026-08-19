/**
 * Panel de Ajustes (tutor) — Fase A.
 * @module settings-panel
 */

import { navigateShellRoute } from "../lib/shell-navigation.js?v=184";
import {
  createSettingsDebouncer,
  fetchParentSettings,
  patchParentSettings,
} from "../lib/parent-settings.js";
import { getShellUiTheme, subscribeShellUiTheme } from "../lib/shell-theme.js";
import { renderShellUiIconSvgInner } from "./shell-ui-icons.js";
import {
  bindGlassIconTheme,
  fillGlassSkeleton,
  mountDurationSlider,
  normalizeSessionMinutes,
  setGlassButton,
} from "./glass-controls.js?v=221";
import {
  isDebugAiAllowed,
  isDebugAiClientActive,
  isDebugAiOperatorEligible,
  setDebugAiClientActive,
  syncDebugAiCapabilities,
  syncDebugAiFromParentSettings,
} from "../lib/debug-ai.js";
import { openDebugAiPanel } from "../components/debug-ai-panel.js?v=245";
import {
  hideDebugAiShellBadge,
  showDebugAiShellBadge,
} from "../lib/debug-ai-shell.js?v=1";

/**
 * @param {HTMLElement} root
 * @param {string} sel
 * @param {import('./shell-ui-icons.js').UiIconId} iconId
 * @param {string} label
 */
function paintBtn(root, sel, iconId, label) {
  const btn = root.querySelector(sel);
  if (btn instanceof HTMLButtonElement) setGlassButton(btn, iconId, label);
}

/**
 * @param {{ debugCapabilities?: object | null; accountAuthorization?: object | null } | undefined} meta
 */
function canShowDebugSection(meta) {
  if (meta?.debugCapabilities?.operator_eligible === true) return true;
  const permissions = meta?.accountAuthorization?.permissions;
  return Array.isArray(permissions) && permissions.includes("debug_ai");
}

/**
 * @param {HTMLElement} container
 * @param {{ session: import('@supabase/supabase-js').Session }} options
 */
export function mountSettingsPanel(container, { session }) {
  const root = document.createElement("div");
  root.className = "settings-panel";
  fillGlassSkeleton(root, { preset: "lines", ariaLabel: "Cargando ajustes" });
  container.appendChild(root);

  /** @type {ReturnType<typeof createSettingsDebouncer> | null} */
  let debouncer = null;
  /** @type {(() => void) | null} */
  let unsubTheme = null;
  /** @type {(() => void) | null} */
  let unsubIcons = null;
  /** @type {(() => void) | null} */
  let destroySlider = null;
  let memberCount = 0;
  let destroyed = false;
  /** @type {{ debugCapabilities?: object | null; accountAuthorization?: object | null } | null} */
  let settingsMeta = null;

  const statusEl = () => root.querySelector("[data-save-status]");

  async function persist(patch) {
    const res = await patchParentSettings(session, patch);
    if (destroyed) return;
    const el = statusEl();
    if (!res.ok) {
      if (el) el.textContent = "No hemos podido guardar los ajustes. Inténtalo de nuevo.";
      return;
    }
    memberCount = res.member_count;
    settingsMeta = {
      debugCapabilities: res.debug_capabilities ?? null,
      accountAuthorization: res.account_authorization ?? null,
    };
    paint(res.settings, settingsMeta);
    if (el) {
      el.textContent = "Guardado";
      setTimeout(() => {
        if (el.textContent === "Guardado") el.textContent = "";
      }, 1600);
    }
  }

  /**
   * @param {import('../lib/parent-settings.js').ParentSettings} settings
   * @param {{ debugCapabilities?: object | null; accountAuthorization?: object | null } | null} [meta]
   */
  function paint(settings, meta = settingsMeta) {
    destroySlider?.();
    destroySlider = null;
    unsubIcons?.();
    unsubIcons = null;

    if (meta?.debugCapabilities) syncDebugAiCapabilities(meta.debugCapabilities);
    syncDebugAiFromParentSettings(settings, meta?.debugCapabilities ?? null);
    const debugModeOn = settings.diagnostics?.debug_ai_enabled === true;

    const theme = settings.ui_theme;
    root.className = "settings-panel";
    root.innerHTML = `
      <p class="settings-panel__subtitle">Preferencias de la cuenta de gestión</p>
      <p class="settings-panel__status" data-save-status aria-live="polite"></p>

      <section class="settings-panel__group" aria-labelledby="set-appearance">
        <h2 id="set-appearance" class="settings-panel__group-title">Apariencia</h2>

        <p class="settings-panel__label">Tema de interfaz</p>
        <p class="settings-panel__helper">Afecta menús y pantallas de gestión. No cambia el mundo de juego de cada miembro.</p>
        <div class="settings-panel__segment" role="group" aria-label="Tema de interfaz">
          <button type="button" class="settings-panel__chip" data-patch-theme="fantasy" aria-pressed="${theme === "fantasy"}">Fantasía</button>
          <button type="button" class="settings-panel__chip" data-patch-theme="sci-fi" aria-pressed="${theme === "sci-fi"}">Ciencia ficción</button>
        </div>
        <p class="settings-panel__now">Ahora: ${theme === "sci-fi" ? "Ciencia ficción" : "Fantasía"}</p>
        <div class="settings-panel__preview" data-theme-preview aria-hidden="true"></div>

        <p class="settings-panel__label">Texto de gestión</p>
        <div class="settings-panel__segment" role="group" aria-label="Texto de gestión">
          ${fontChips("font_scale_ui", settings.font_scale_ui)}
        </div>

        <p class="settings-panel__label">Texto de aventuras</p>
        <p class="settings-panel__helper">Tamaño de la historia y los retos. Puedes cambiarlo por miembro en Tripulación.</p>
        <div class="settings-panel__segment" role="group" aria-label="Texto de aventuras">
          ${fontChips("font_scale_play", settings.font_scale_play)}
        </div>

        <p class="settings-panel__label">Animaciones</p>
        <div class="settings-panel__segment" role="group" aria-label="Animaciones">
          ${motionChips(settings.reduce_motion)}
        </div>

        <p class="settings-panel__label">Intensidad del mundo</p>
        <div class="settings-panel__segment" role="group" aria-label="Intensidad del mundo">
          <button type="button" class="settings-panel__chip" data-world="calm" aria-pressed="${settings.world_intensity === "calm"}">Tranquilo</button>
          <button type="button" class="settings-panel__chip" data-world="lively" aria-pressed="${settings.world_intensity === "lively"}">Vivo</button>
        </div>
      </section>

      <section class="settings-panel__group" aria-labelledby="set-crew">
        <h2 id="set-crew" class="settings-panel__group-title">Tripulación</h2>
        <p class="settings-panel__helper">${memberCount === 0 ? "Aún no hay miembros." : `${memberCount} miembros`}</p>
        <button type="button" class="settings-panel__btn" data-go-crew></button>

        <p class="settings-panel__label">Valores por defecto al crear un miembro</p>
        <label class="settings-panel__check">
          <input type="checkbox" data-cd="allow_solo_start" ${settings.crew_defaults.allow_solo_start ? "checked" : ""} />
          Puede empezar solo
        </label>
        <label class="settings-panel__check">
          <input type="checkbox" data-cd="require_exit_pin" ${settings.crew_defaults.require_exit_pin ? "checked" : ""} />
          Pedir PIN antes de continuar con la aventura
        </label>
        <label class="settings-panel__check">
          <input type="checkbox" data-cd="lock_world_theme" ${settings.crew_defaults.lock_world_theme ? "checked" : ""} />
          Bloquear cambio de mundo
        </label>
        <div data-duration-host></div>
        <p class="settings-panel__label">Sesiones al día</p>
        <div class="settings-panel__segment" role="group" aria-label="Sesiones al día">
          ${[1, 2, 3, 4]
            .map(
              (n) =>
                `<button type="button" class="settings-panel__chip" data-cd-sessions="${n}" aria-pressed="${settings.crew_defaults.session_limit_per_day === n}">${n}</button>`,
            )
            .join("")}
          <button type="button" class="settings-panel__chip" data-cd-sessions="null" aria-pressed="${settings.crew_defaults.session_limit_per_day == null}">Sin límite</button>
        </div>
      </section>

      <section class="settings-panel__group" data-debug-section hidden aria-labelledby="set-debug">
        <h2 id="set-debug" class="settings-panel__group-title">Modo debug</h2>
        <p class="settings-panel__helper">
          Solo cuentas con permiso de desarrollador. Actívalo para ver trazas IA, el panel de diagnóstico y rebobinar viajes en play.
        </p>
        <label class="settings-panel__check">
          <input type="checkbox" data-debug-toggle ${debugModeOn ? "checked" : ""} />
          Activar modo debug
        </label>
        <button type="button" class="settings-panel__btn" data-open-debug></button>
      </section>
    `;

    paintBtn(root, "[data-go-crew]", "crew", "Ver tripulación");
    paintBtn(root, "[data-open-debug]", "settings", "Abrir panel de diagnóstico");
    unsubIcons = bindGlassIconTheme(root);

    const durationHost = root.querySelector("[data-duration-host]");
    if (durationHost instanceof HTMLElement) {
      const slider = mountDurationSlider(durationHost, {
        value: normalizeSessionMinutes(settings.crew_defaults.max_session_minutes),
        onChange(mins) {
          const crew_defaults = { ...settings.crew_defaults, max_session_minutes: mins };
          debouncer?.schedule({ crew_defaults });
          // Keep local settings in sync without full repaint (evita reset del slider)
          settings.crew_defaults = crew_defaults;
        },
      });
      destroySlider = () => slider.destroy();
    }

    const preview = root.querySelector("[data-theme-preview]");
    if (preview instanceof HTMLElement) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 40 40");
      svg.setAttribute("data-icon-id", "settings");
      svg.innerHTML = renderShellUiIconSvgInner({
        id: "settings",
        theme: getShellUiTheme(),
        viewSize: 40,
        fill: "#fff",
      });
      preview.replaceChildren(svg);
    }

    bind(settings, meta);
  }

  /**
   * @param {string} field
   * @param {string} current
   */
  function fontChips(field, current) {
    return ["md", "lg", "xl"]
      .map((v) => {
        const label = v === "md" ? "Normal" : v === "lg" ? "Grande" : "Muy grande";
        return `<button type="button" class="settings-panel__chip" data-font-field="${field}" data-font-value="${v}" aria-pressed="${current === v}">${label}</button>`;
      })
      .join("");
  }

  /** @param {string} current */
  function motionChips(current) {
    const opts = [
      ["system", "Como el sistema"],
      ["always", "Reducir siempre"],
      ["never", "Completas"],
    ];
    return opts
      .map(
        ([v, label]) =>
          `<button type="button" class="settings-panel__chip" data-motion="${v}" aria-pressed="${current === v}">${label}</button>`,
      )
      .join("");
  }

  /**
   * @param {import('../lib/parent-settings.js').ParentSettings} settings
   * @param {{ debugCapabilities?: object | null; accountAuthorization?: object | null } | null} [meta]
   */
  function bind(settings, meta = settingsMeta) {
    root.querySelectorAll("[data-patch-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = /** @type {'fantasy'|'sci-fi'} */ (btn.getAttribute("data-patch-theme"));
        debouncer?.schedule({ ui_theme: theme });
        paint({ ...settings, ui_theme: theme });
      });
    });
    root.querySelectorAll("[data-font-field]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const field = btn.getAttribute("data-font-field");
        const value = btn.getAttribute("data-font-value");
        if (!field || !value) return;
        debouncer?.schedule({ [field]: value });
        paint({ ...settings, [field]: value });
      });
    });
    root.querySelectorAll("[data-motion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-motion");
        debouncer?.schedule({ reduce_motion: value });
        paint({ ...settings, reduce_motion: value });
      });
    });
    root.querySelectorAll("[data-world]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-world");
        debouncer?.schedule({ world_intensity: value });
        paint({ ...settings, world_intensity: value });
      });
    });
    root.querySelectorAll("[data-cd]").forEach((input) => {
      input.addEventListener("change", () => {
        if (!(input instanceof HTMLInputElement)) return;
        const key = input.getAttribute("data-cd");
        if (!key) return;
        const crew_defaults = { ...settings.crew_defaults, [key]: input.checked };
        debouncer?.schedule({ crew_defaults });
        paint({ ...settings, crew_defaults });
      });
    });
    root.querySelectorAll("[data-cd-sessions]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-cd-sessions");
        const session_limit_per_day = raw === "null" ? null : Number(raw);
        const crew_defaults = { ...settings.crew_defaults, session_limit_per_day };
        debouncer?.schedule({ crew_defaults });
        paint({ ...settings, crew_defaults });
      });
    });
    root.querySelector("[data-go-crew]")?.addEventListener("click", () => {
      debouncer?.flush();
      navigateShellRoute("/crew");
    });
    root.querySelector("[data-debug-toggle]")?.addEventListener("change", (ev) => {
      const input = ev.target;
      if (!(input instanceof HTMLInputElement)) return;
      const checked = input.checked;
      setDebugAiClientActive(checked);
      debouncer?.schedule({ diagnostics: { debug_ai_enabled: checked } });
      if (checked && isDebugAiAllowed()) {
        showDebugAiShellBadge(session);
      } else {
        hideDebugAiShellBadge();
      }
    });
    root.querySelector("[data-open-debug]")?.addEventListener("click", () => {
      if (!isDebugAiAllowed()) {
        if (!isDebugAiOperatorEligible()) return;
        setDebugAiClientActive(true);
        debouncer?.schedule({ diagnostics: { debug_ai_enabled: true } });
        showDebugAiShellBadge(session);
        void openDebugAiPanel({ session });
        return;
      }
      void openDebugAiPanel({ session });
    });
    if (canShowDebugSection(meta) || isDebugAiOperatorEligible()) {
      if (meta?.debugCapabilities) syncDebugAiCapabilities(meta.debugCapabilities);
      syncDebugAiFromParentSettings(settings, meta?.debugCapabilities ?? null);
      const section = root.querySelector("[data-debug-section]");
      if (section instanceof HTMLElement) section.hidden = false;
      if (isDebugAiAllowed()) showDebugAiShellBadge(session);
    }
  }

  debouncer = createSettingsDebouncer((patch) => persist(patch));

  void (async () => {
    const res = await fetchParentSettings(session);
    if (destroyed) return;
    if (!res.ok) {
      root.className = "settings-panel";
      root.innerHTML = `
        <p class="settings-panel__error">No hemos podido cargar los ajustes.</p>
        <button type="button" class="settings-panel__btn" data-retry></button>
      `;
      paintBtn(root, "[data-retry]", "home", "Reintentar");
      unsubIcons = bindGlassIconTheme(root);
      root.querySelector("[data-retry]")?.addEventListener("click", () => {
        fillGlassSkeleton(root, { preset: "lines", ariaLabel: "Cargando ajustes" });
        void fetchParentSettings(session).then((r) => {
          if (r.ok) {
            memberCount = r.member_count;
            settingsMeta = {
              debugCapabilities: r.debug_capabilities ?? null,
              accountAuthorization: r.account_authorization ?? null,
            };
            paint(r.settings, settingsMeta);
          }
        });
      });
      return;
    }
    memberCount = res.member_count;
    settingsMeta = {
      debugCapabilities: res.debug_capabilities ?? null,
      accountAuthorization: res.account_authorization ?? null,
    };
    paint(res.settings, settingsMeta);
  })();

  unsubTheme = subscribeShellUiTheme((theme) => {
    const chip = root.querySelector(`[data-patch-theme="${theme}"]`);
    if (chip) {
      // FAB cambió tema: sincronizar servidor
      debouncer?.schedule({ ui_theme: theme });
      root.querySelectorAll("[data-patch-theme]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-patch-theme") === theme));
      });
      const now = root.querySelector(".settings-panel__now");
      if (now) now.textContent = `Ahora: ${theme === "sci-fi" ? "Ciencia ficción" : "Fantasía"}`;
    }
  });

  return {
    destroy() {
      destroyed = true;
      debouncer?.flush();
      destroySlider?.();
      unsubIcons?.();
      unsubTheme?.();
      root.remove();
    },
  };
}
