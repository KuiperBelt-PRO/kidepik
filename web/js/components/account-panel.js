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
import { getShellUiTheme } from "../lib/shell-theme.js";
import { GLASS_ICON_FILL, setGlassButton } from "./glass-controls.js";
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
   * @param {import('../lib/parent-account.js').ParentAccountDto} parent
   */
  function renderForm(parent) {
    root.classList.remove("account-panel--skeleton");
    root.replaceChildren();

    const subtitle = document.createElement("p");
    subtitle.className = "account-panel__subtitle";
    subtitle.textContent = "Cuenta de padre, madre o tutor";

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
    nameInput.maxLength = 40;
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

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "account-panel__btn";
    setLabeledButton(deleteBtn, "danger", "Eliminar cuenta", { dangerIcon: true });

    root.append(
      subtitle,
      avatar,
      nameField,
      googleField,
      emailField,
      providerField,
      divider,
      dangerTitle,
      deleteBtn,
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
        saveBtn.disabled = true;
        const result = await updateParentDisplayName(session, check.value);
        saveBtn.disabled = false;
        if (!result.ok) {
          nameError.textContent = result.error
            ?? "No hemos podido guardar. Inténtalo de nuevo.";
          nameError.hidden = false;
          return;
        }
        nameInput.value = result.parent.display_name ?? "";
        nameStatus.textContent = "Guardado";
        nameStatus.hidden = false;
        window.setTimeout(() => {
          nameStatus.hidden = true;
        }, 2000);
      })();
    });

    deleteBtn.addEventListener("click", () => {
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
    const result = await fetchParentMe(session);
    if (cancelled) return;
    if (!result.ok) {
      renderError();
      return;
    }
    renderForm(result.parent);
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
