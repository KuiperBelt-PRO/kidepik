/**
 * Panel de Ajustes reducido para tripulante.
 * @module crew-settings-panel
 */

import {
  fetchMemberSettings,
  patchMemberSettings,
} from "../lib/member-settings.js";
import { createSettingsDebouncer } from "../lib/parent-settings.js";
import { getShellUiTheme, subscribeShellUiTheme } from "../lib/shell-theme.js";
import { renderShellUiIconSvgInner } from "./shell-ui-icons.js";
import { bindGlassIconTheme, fillGlassSkeleton, setGlassButton } from "./glass-controls.js?v=221";

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
 * @param {HTMLElement} container
 * @param {{ session: import('@supabase/supabase-js').Session }} options
 */
export function mountCrewSettingsPanel(container, { session }) {
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
  let destroyed = false;

  const statusEl = () => root.querySelector("[data-save-status]");

  async function persist(patch) {
    const res = await patchMemberSettings(session, patch);
    if (destroyed) return;
    const el = statusEl();
    if (!res.ok) {
      if (el) el.textContent = "No hemos podido guardar los ajustes. Inténtalo de nuevo.";
      return;
    }
    paint(res.settings);
    if (el) {
      el.textContent = "Guardado";
      setTimeout(() => {
        if (el.textContent === "Guardado") el.textContent = "";
      }, 1600);
    }
  }

  /**
   * @param {import('../lib/member-settings.js').MemberSettings} settings
   */
  function paint(settings) {
    unsubIcons?.();
    unsubIcons = null;

    const theme = settings.ui_preferences.ui_theme;
    const motion = settings.ui_preferences.reduce_motion;

    root.className = "settings-panel";
    root.innerHTML = `
      <p class="settings-panel__subtitle">Preferencias de tu sesión de viaje</p>
      <p class="settings-panel__status" data-save-status aria-live="polite"></p>

      <section class="settings-panel__group" aria-labelledby="crew-set-appearance">
        <h2 id="crew-set-appearance" class="settings-panel__group-title">Apariencia</h2>

        <p class="settings-panel__label">Tema del menú</p>
        <p class="settings-panel__helper">Afecta menús y pantallas mientras usas la app. No cambia el mundo de tu viaje.</p>
        <div class="settings-panel__segment" role="group" aria-label="Tema del menú">
          <button type="button" class="settings-panel__chip" data-patch-theme="fantasy" aria-pressed="${theme === "fantasy"}">Fantasía</button>
          <button type="button" class="settings-panel__chip" data-patch-theme="sci-fi" aria-pressed="${theme === "sci-fi"}">Ciencia ficción</button>
        </div>
        <p class="settings-panel__now">Ahora: ${theme === "sci-fi" ? "Ciencia ficción" : "Fantasía"}</p>
        <div class="settings-panel__preview" data-theme-preview aria-hidden="true"></div>

        <p class="settings-panel__label">Texto de aventuras</p>
        <p class="settings-panel__helper">Tamaño de la historia y los retos en el viaje.</p>
        <div class="settings-panel__segment" role="group" aria-label="Texto de aventuras">
          ${fontChips(settings.font_scale_play)}
        </div>

        <p class="settings-panel__label">Animaciones</p>
        <div class="settings-panel__segment" role="group" aria-label="Animaciones">
          ${motionChips(motion)}
        </div>
      </section>
    `;

    unsubIcons = bindGlassIconTheme(root);

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

    bind(settings);
  }

  /**
   * @param {import('../lib/member-settings.js').MemberSettings} settings
   */
  function fontChips(current) {
    return ["md", "lg", "xl"]
      .map((v) => {
        const label = v === "md" ? "Normal" : v === "lg" ? "Grande" : "Muy grande";
        return `<button type="button" class="settings-panel__chip" data-font-value="${v}" aria-pressed="${current === v}">${label}</button>`;
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
   * @param {import('../lib/member-settings.js').MemberSettings} settings
   */
  function bind(settings) {
    root.querySelectorAll("[data-patch-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uiTheme = /** @type {'fantasy'|'sci-fi'} */ (btn.getAttribute("data-patch-theme"));
        debouncer?.schedule({ ui_preferences: { ui_theme: uiTheme } });
        paint({
          ...settings,
          ui_preferences: { ...settings.ui_preferences, ui_theme: uiTheme },
        });
      });
    });
    root.querySelectorAll("[data-font-value]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-font-value");
        if (value !== "md" && value !== "lg" && value !== "xl") return;
        debouncer?.schedule({ font_scale_play: value });
        paint({ ...settings, font_scale_play: value });
      });
    });
    root.querySelectorAll("[data-motion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-motion");
        if (value !== "system" && value !== "always" && value !== "never") return;
        debouncer?.schedule({ ui_preferences: { reduce_motion: value } });
        paint({
          ...settings,
          ui_preferences: { ...settings.ui_preferences, reduce_motion: value },
        });
      });
    });
  }

  debouncer = createSettingsDebouncer((patch) => persist(patch));

  void (async () => {
    const res = await fetchMemberSettings(session);
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
        void fetchMemberSettings(session).then((r) => {
          if (r.ok) paint(r.settings);
        });
      });
      return;
    }
    paint(res.settings);
  })();

  unsubTheme = subscribeShellUiTheme((shellTheme) => {
    const chip = root.querySelector(`[data-patch-theme="${shellTheme}"]`);
    if (chip) {
      debouncer?.schedule({ ui_preferences: { ui_theme: shellTheme } });
      root.querySelectorAll("[data-patch-theme]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-patch-theme") === shellTheme));
      });
      const now = root.querySelector(".settings-panel__now");
      if (now) now.textContent = `Ahora: ${shellTheme === "sci-fi" ? "Ciencia ficción" : "Fantasía"}`;
    }
  });

  return {
    destroy() {
      destroyed = true;
      debouncer?.flush();
      unsubIcons?.();
      unsubTheme?.();
      root.remove();
    },
  };
}
