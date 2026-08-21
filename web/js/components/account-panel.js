/**
 * Panel de contenido de la sección Cuenta.
 * @module account-panel
 */

import {
  normalizeDisplayNameInput,
  resolveAccountDisplayName,
  resolveGoogleAccountName,
} from "../lib/account-display-name.js";
import {
  deleteParentAccount,
  fetchParentMe,
  updateParentDisplayName,
} from "../lib/parent-account.js";
import { isCrewSession, bootstrapSession, getCachedSessionAccount } from "../lib/session-account.js";
import { unlinkMemberAccount, patchMember, fetchMember } from "../lib/member-api.js";
import { patchParentSettings } from "../lib/parent-settings.js";
import { fetchDebugAiStatus } from "../lib/debug-ai-api.js";
import {
  isDebugAiAllowed,
  syncDebugAiCapabilities,
  syncDebugAiFromParentSettings,
} from "../lib/debug-ai.js";
import { openDebugAiPanel } from "./debug-ai-panel.js?v=245";
import { setAppShellDebugAiBadge } from "./app-shell.js?v=280";
import { ensureDebugAiShellBadge } from "../lib/debug-ai-shell.js?v=1";
import { getShellUiTheme } from "../lib/shell-theme.js";
import { GLASS_ICON_FILL, runGlassButtonAction, setGlassButton } from "./glass-controls.js?v=225";
import { closeGlassModal, showGlassConfirm } from "./glass-modal.js?v=2";
import { renderShellUiIconSvgInner } from "./shell-ui-icons.js";

/** @typedef {import('./shell-ui-icons.js').UiIconId} UiIconId */

const DELETE_COPY_HTML = `
<p>Si continúas, se eliminará de forma permanente:</p>
<ul>
  <li>Tu cuenta de padre, madre o tutor en KidepiK</li>
  <li>El enlace con tu cuenta de Google en esta app</li>
  <li>Tu nombre para mostrar y preferencias de la cuenta</li>
  <li>Los exploradores de tu tripulación y su progreso</li>
</ul>
<p>No podrás recuperar estos datos. Tendrás que volver a registrarte con Google si quieres usar KidepiK otra vez.</p>
`;

/**
 * @param {UiIconId} id
 * @param {{ fill?: string }} [opts]
 */
function iconSvg(id, opts = {}) {
  const theme = getShellUiTheme();
  const viewSize = 20;
  const fill = opts.fill ?? "#fff";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "account-panel__btn-icon");
  svg.setAttribute("viewBox", `0 0 ${viewSize} ${viewSize}`);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = renderShellUiIconSvgInner({ id, theme, viewSize, fill });
  return svg;
}

/**
 * @param {HTMLButtonElement} btn
 * @param {UiIconId} iconId
 * @param {string} label
 * @param {{ dangerIcon?: boolean }} [opts]
 */
function setLabeledButton(btn, iconId, label, opts = {}) {
  btn.replaceChildren();
  btn.append(
    iconSvg(iconId, { fill: opts.dangerIcon ? GLASS_ICON_FILL.danger : GLASS_ICON_FILL.default }),
    document.createTextNode(label),
  );
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   session: import('@supabase/supabase-js').Session;
 *   onDeleted: () => void | Promise<void>;
 * }} options
 * @returns {{ destroy: () => void }}
 */
export function mountAccountPanel(container, { session, onDeleted }) {
  const root = document.createElement("div");
  root.className = "account-panel account-panel--skeleton";
  root.innerHTML = `
    <p class="account-panel__skel" style="width:70%;margin:0 auto"></p>
    <div class="account-panel__skel" style="width:64px;height:64px;border-radius:999px;margin:0 auto"></div>
    <p class="account-panel__skel"></p>
    <p class="account-panel__skel" style="width:85%"></p>
  `;
  container.appendChild(root);

  let cancelled = false;

  /**
   * @param {{ operator_eligible?: boolean; debug_enabled?: boolean } | null | undefined} debugCaps
   * @returns {HTMLElement[]}
   */
  function buildDebugSectionNodes(debugCaps) {
    if (!debugCaps?.operator_eligible) return [];

    syncDebugAiCapabilities(debugCaps);
    syncDebugAiFromParentSettings(
      { diagnostics: { debug_ai_enabled: debugCaps.debug_enabled === true } },
      debugCaps,
    );

    const debugDivider = document.createElement("hr");
    debugDivider.className = "account-panel__divider";
    const debugTitle = document.createElement("p");
    debugTitle.className = "account-panel__label";
    debugTitle.textContent = "Modo debug";
    const debugHelper = document.createElement("p");
    debugHelper.className = "account-panel__helper";
    debugHelper.textContent =
      "Solo desarrolladores. Actívalo para ver trazas IA, el panel de diagnóstico y rebobinar viajes en play.";
    const debugCheck = document.createElement("label");
    debugCheck.className = "account-panel__helper";
    const debugToggle = document.createElement("input");
    debugToggle.type = "checkbox";
    debugToggle.checked = debugCaps.debug_enabled === true;
    debugCheck.append(debugToggle, document.createTextNode(" Activar modo debug"));
    const openDebugBtn = document.createElement("button");
    openDebugBtn.type = "button";
    openDebugBtn.className = "account-panel__btn";
    setLabeledButton(openDebugBtn, "settings", "Abrir panel de diagnóstico");

    debugToggle.addEventListener("change", () => {
      void (async () => {
        const enabled = debugToggle.checked;
        const result = isCrewSession()
          ? await patchMember(session, { diagnostics: { debug_ai_enabled: enabled } })
          : await patchParentSettings(session, { diagnostics: { debug_ai_enabled: enabled } });
        if (!result.ok) {
          debugToggle.checked = !enabled;
          return;
        }
        const caps = isCrewSession()
          ? result.member?.debug_capabilities
          : result.debug_capabilities;
        if (caps) syncDebugAiCapabilities(caps);
        syncDebugAiFromParentSettings({ diagnostics: { debug_ai_enabled: enabled } }, caps ?? null);
        if (isDebugAiAllowed()) {
          void ensureDebugAiShellBadge();
        } else {
          setAppShellDebugAiBadge(null);
        }
      })();
    });

    openDebugBtn.addEventListener("click", () => {
      if (!isDebugAiAllowed()) return;
      void openDebugAiPanel({ session });
    });

    return [debugDivider, debugTitle, debugHelper, debugCheck, openDebugBtn];
  }

  /**
   * @param {import('../lib/parent-account.js').ParentAccountDto} parent
   * @param {{ operator_eligible?: boolean; debug_enabled?: boolean } | null} [debugCaps]
   */
  function renderForm(parent, debugCaps = null) {
    root.classList.remove("account-panel--skeleton");
    root.replaceChildren();

    const subtitle = document.createElement("p");
    subtitle.className = "account-panel__subtitle";
    subtitle.textContent = isCrewSession()
      ? "Cuenta de tripulante"
      : "Cuenta de padre, madre o tutor";

    const avatar = document.createElement("div");
    avatar.className = "account-panel__avatar";
    avatar.setAttribute("aria-hidden", "true");
    const shownName = resolveAccountDisplayName(parent, session);
    if (parent.avatar_url) {
      const img = document.createElement("img");
      img.src = parent.avatar_url;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.addEventListener(
        "error",
        () => {
          img.remove();
          avatar.textContent = shownName.slice(0, 1).toUpperCase();
        },
        { once: true },
      );
      avatar.appendChild(img);
    } else {
      avatar.textContent = shownName.slice(0, 1).toUpperCase();
    }

    const nameField = document.createElement("div");
    nameField.className = "account-panel__field";
    const nameLabel = document.createElement("label");
    nameLabel.className = "account-panel__label";
    nameLabel.htmlFor = "account-display-name";
    nameLabel.textContent = "Nombre para mostrar";
    const nameHelper = document.createElement("p");
    nameHelper.className = "account-panel__helper";
    nameHelper.textContent = "Así te saludaremos en la app. Puedes usar un alias.";
    const nameRow = document.createElement("div");
    nameRow.className = "account-panel__name-row";
    const nameInput = document.createElement("input");
    nameInput.id = "account-display-name";
    nameInput.className = "account-panel__input";
    nameInput.type = "text";
    nameInput.maxLength = isCrewSession() ? 24 : 40;
    nameInput.autocomplete = "nickname";
    nameInput.value = parent.display_name ?? "";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "account-panel__btn";
    setLabeledButton(saveBtn, "save", "Guardar");
    nameRow.append(nameInput, saveBtn);
    const nameError = document.createElement("p");
    nameError.className = "account-panel__error";
    nameError.hidden = true;
    const nameStatus = document.createElement("p");
    nameStatus.className = "account-panel__status";
    nameStatus.hidden = true;
    nameField.append(nameLabel, nameHelper, nameRow, nameError, nameStatus);

    const googleField = document.createElement("div");
    googleField.className = "account-panel__field";
    const googleLabel = document.createElement("span");
    googleLabel.className = "account-panel__label";
    googleLabel.textContent = "Nombre en Google";
    const googleValue = document.createElement("p");
    googleValue.className = "account-panel__value";
    googleValue.textContent = resolveGoogleAccountName(session);
    googleField.append(googleLabel, googleValue);

    const emailField = document.createElement("div");
    emailField.className = "account-panel__field";
    const emailLabel = document.createElement("span");
    emailLabel.className = "account-panel__label";
    emailLabel.textContent = "Correo";
    const emailValue = document.createElement("p");
    emailValue.className = "account-panel__value";
    emailValue.textContent = parent.email || session.user?.email || "—";
    emailField.append(emailLabel, emailValue);

    const providerField = document.createElement("div");
    providerField.className = "account-panel__field";
    const providerLabel = document.createElement("span");
    providerLabel.className = "account-panel__label";
    providerLabel.textContent = "Inicio de sesión";
    const providerValue = document.createElement("p");
    providerValue.className = "account-panel__value";
    providerValue.textContent = "Google";
    providerField.append(providerLabel, providerValue);

    const divider = document.createElement("hr");
    divider.className = "account-panel__divider";

    const dangerTitle = document.createElement("p");
    dangerTitle.className = "account-panel__danger-title";
    dangerTitle.textContent = "Zona peligrosa";

    const dangerBtn = document.createElement("button");
    dangerBtn.type = "button";
    dangerBtn.className = "account-panel__btn";
    const crew = isCrewSession();
    if (crew) {
      setLabeledButton(dangerBtn, "danger", "Desvincular Gmail", { dangerIcon: true });
    } else {
      setLabeledButton(dangerBtn, "danger", "Eliminar cuenta", { dangerIcon: true });
    }

    root.append(
      subtitle,
      avatar,
      nameField,
      googleField,
      emailField,
      providerField,
      ...buildDebugSectionNodes(debugCaps),
      divider,
      dangerTitle,
      dangerBtn,
    );

    saveBtn.addEventListener("click", () => {
      void (async () => {
        nameError.hidden = true;
        nameStatus.hidden = true;
        const check = normalizeDisplayNameInput(nameInput.value);
        if (!check.ok) {
          nameError.textContent = check.error;
          nameError.hidden = false;
          return;
        }
        await runGlassButtonAction(
          saveBtn,
          async () => {
            const result = crew
              ? await patchMember(session, { display_name: check.value })
              : await updateParentDisplayName(session, check.value);
            if (!result.ok) {
              const err =
                typeof result.error === "string" && result.error !== "save"
                  ? result.error
                  : "No hemos podido guardar. Inténtalo de nuevo.";
              nameError.textContent = err;
              nameError.hidden = false;
              return { ok: false, error: err };
            }
            if (crew) {
              nameInput.value = result.member?.display_name ?? "";
            } else {
              nameInput.value = result.parent.display_name ?? "";
            }
            return { ok: true };
          },
          { successMessage: "Nombre guardado" },
        );
      })();
    });

    if (crew) {
      dangerBtn.addEventListener("click", () => {
        void showGlassConfirm({
          title: "¿Desvincular este Gmail?",
          body: "<p>Saldrás de esta sesión. Seguirás en la tripulación y podrás volver a entrar con el mismo correo. Esta acción no elimina tu viaje.</p>",
          footer: "Podrás volver cuando quieras.",
          size: "md",
          danger: true,
          confirmLabel: "Desvincular",
          onConfirm: async () => {
            const result = await unlinkMemberAccount(session);
            if (!result.ok) {
              throw new Error("No hemos podido desvincular. Inténtalo de nuevo.");
            }
            await onDeleted();
          },
        });
      });
      return;
    }

    dangerBtn.addEventListener("click", () => {
      void showGlassConfirm({
        title: "¿Eliminar tu cuenta?",
        body: DELETE_COPY_HTML,
        footer: "Esta acción no se puede deshacer.",
        size: "lg",
        danger: true,
        confirmLabel: "Eliminar definitivamente",
        onConfirm: async () => {
          const result = await deleteParentAccount(session);
          if (!result.ok) {
            throw new Error("No hemos podido eliminar la cuenta. Inténtalo de nuevo.");
          }
          await onDeleted();
        },
      });
    });
  }

  function renderError() {
    root.classList.remove("account-panel--skeleton");
    root.replaceChildren();
    const msg = document.createElement("p");
    msg.className = "account-panel__error";
    msg.textContent = "No hemos podido cargar tu cuenta. Inténtalo de nuevo.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "account-panel__btn";
    retry.textContent = "Reintentar";
    retry.addEventListener("click", () => {
      void load();
    });
    root.append(msg, retry);
  }

  async function load() {
    root.classList.add("account-panel--skeleton");
    const boot = await bootstrapSession(session);
    if (cancelled) return;

    /** @type {{ operator_eligible?: boolean; debug_enabled?: boolean } | null} */
    let debugCaps = boot.account?.debug_capabilities ?? getCachedSessionAccount()?.debug_capabilities ?? null;

    if (!debugCaps?.operator_eligible && isCrewSession()) {
      const memberRes = await fetchMember(session);
      if (memberRes.ok && memberRes.member?.debug_capabilities) {
        debugCaps = memberRes.member.debug_capabilities;
      }
    }

    if (!debugCaps?.operator_eligible) {
      const debugRes = await fetchDebugAiStatus(session);
      if (debugRes.ok && debugRes.data) {
        debugCaps = debugRes.data;
      }
    }

    const crew = isCrewSession();
    if (crew) {
      const memberRes = await fetchMember(session);
      if (cancelled) return;
      if (!memberRes.ok) {
        renderError();
        return;
      }
      if (!debugCaps?.operator_eligible && memberRes.member?.debug_capabilities) {
        debugCaps = memberRes.member.debug_capabilities;
      }
      renderForm(
        {
          parent_id: "",
          auth_user_id: session.user?.id || "",
          email: session.user?.email || "",
          display_name: memberRes.member?.display_name ?? "",
          avatar_url: session.user?.user_metadata?.avatar_url || null,
          provider: "google",
        },
        debugCaps,
      );
      return;
    }

    const result = await fetchParentMe(session);
    if (cancelled) return;
    if (!result.ok) {
      renderError();
      return;
    }
    renderForm(result.parent, debugCaps);
  }

  void load();

  return {
    destroy() {
      cancelled = true;
      closeGlassModal();
      root.remove();
    },
  };
}
