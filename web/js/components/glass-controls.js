/**
 * Helpers de controles glass (DESIGN.md).
 * @module glass-controls
 */

import { getShellUiTheme, subscribeShellUiTheme } from "../lib/shell-theme.js";
import { renderShellUiIconSvgInner } from "./shell-ui-icons.js";

/** @typedef {import('./shell-ui-icons.js').UiIconId} UiIconId */

/** Iconos semánticos: el chrome del botón sigue glass; el glyph puede llevar color. */
export const GLASS_ICON_FILL = Object.freeze({
  default: "#ffffff",
  danger: "#FF6B63",
});

/**
 * @param {number} minutes
 * @returns {string}
 */
export function formatDurationMinutes(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return h === 1 ? "1 h" : `${h} h`;
  return `${h} h ${rem} min`;
}

/**
 * Clamp duración a 5–120 step 5.
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeSessionMinutes(value) {
  let n = Number(value);
  if (!Number.isFinite(n)) n = 10;
  n = Math.round(n / 5) * 5;
  return Math.min(120, Math.max(5, n));
}

/**
 * @param {UiIconId} id
 * @param {{ fill?: string; size?: number }} [opts]
 */
export function createGlassIconSvg(id, opts = {}) {
  const theme = getShellUiTheme();
  const viewSize = opts.size ?? 20;
  const fill = opts.fill ?? "#fff";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "glass-btn__icon");
  svg.setAttribute("viewBox", `0 0 ${viewSize} ${viewSize}`);
  svg.setAttribute("aria-hidden", "true");
  svg.dataset.iconId = id;
  svg.innerHTML = renderShellUiIconSvgInner({ id, theme, viewSize, fill });
  return svg;
}

/**
 * @param {HTMLButtonElement} btn
 * @param {UiIconId} iconId
 * @param {string} label
 * @param {{ fill?: string; dangerIcon?: boolean }} [opts]
 */
export function setGlassButton(btn, iconId, label, opts = {}) {
  btn.dataset.iconId = iconId;
  btn.dataset.label = label;
  const fill = opts.dangerIcon
    ? GLASS_ICON_FILL.danger
    : (opts.fill ?? GLASS_ICON_FILL.default);
  btn.dataset.iconFill = fill;
  btn.replaceChildren(createGlassIconSvg(iconId, { fill }), document.createTextNode(label));
}

/**
 * Regenera iconos de botones con data-icon-id al cambiar tema.
 * @param {ParentNode} root
 * @returns {() => void}
 */
export function bindGlassIconTheme(root) {
  const refresh = () => {
    root.querySelectorAll("button[data-icon-id]").forEach((el) => {
      if (!(el instanceof HTMLButtonElement)) return;
      const id = /** @type {UiIconId} */ (el.dataset.iconId);
      if (!id) return;
      const label = el.dataset.label || "";
      const fill = el.dataset.iconFill || GLASS_ICON_FILL.default;
      setGlassButton(el, id, label, { fill });
    });
    root.querySelectorAll("svg[data-icon-id]").forEach((el) => {
      if (!(el instanceof SVGElement)) return;
      const id = /** @type {UiIconId} */ (el.dataset.iconId);
      if (!id) return;
      const viewSize = Number(el.getAttribute("viewBox")?.split(/\s+/).pop()) || 20;
      const theme = getShellUiTheme();
      const fill = el.dataset.iconFill || GLASS_ICON_FILL.default;
      el.innerHTML = renderShellUiIconSvgInner({ id, theme, viewSize, fill });
    });
  };
  return subscribeShellUiTheme(refresh);
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   min?: number;
 *   max?: number;
 *   step?: number;
 *   value: number;
 *   ariaLabel?: string;
 *   onChange: (minutes: number) => void;
 * }} opts
 */
export function mountDurationSlider(host, opts) {
  const min = opts.min ?? 5;
  const max = opts.max ?? 120;
  const step = opts.step ?? 5;
  let value = normalizeSessionMinutes(opts.value);

  const root = document.createElement("div");
  root.className = "glass-slider";
  root.innerHTML = `
    <div class="glass-slider__row">
      <span class="glass-slider__label">Duración máxima</span>
      <span class="glass-slider__value" data-value></span>
    </div>
    <input class="glass-slider__range" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${opts.ariaLabel ?? "Duración máxima de sesión"}" />
    <div class="glass-slider__hints"><span>5 min</span><span>2 h</span></div>
  `;
  host.appendChild(root);

  const range = /** @type {HTMLInputElement} */ (root.querySelector(".glass-slider__range"));
  const valueEl = /** @type {HTMLElement} */ (root.querySelector("[data-value]"));

  function paint() {
    valueEl.textContent = formatDurationMinutes(value);
    range.value = String(value);
  }
  paint();

  range.addEventListener("input", () => {
    value = normalizeSessionMinutes(range.value);
    paint();
    opts.onChange(value);
  });

  return {
    getValue: () => value,
    setValue(next) {
      value = normalizeSessionMinutes(next);
      paint();
    },
    destroy() {
      root.remove();
    },
  };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   value: string;
 *   options: { value: string; label: string }[];
 *   ariaLabel?: string;
 *   onChange: (value: string) => void;
 * }} opts
 */
export function mountGlassSelect(host, opts) {
  let value = opts.value;
  const root = document.createElement("div");
  root.className = "glass-select";
  root.dataset.open = "false";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "glass-select__trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (opts.ariaLabel) trigger.setAttribute("aria-label", opts.ariaLabel);

  const labelSpan = document.createElement("span");
  const chevron = createGlassIconSvg("chevron", { size: 18 });
  chevron.classList.add("glass-select__chevron");
  chevron.dataset.iconId = "chevron";
  trigger.append(labelSpan, chevron);

  const panel = document.createElement("div");
  panel.className = "glass-select__panel";
  panel.setAttribute("hidden", "");

  const list = document.createElement("ul");
  list.className = "glass-select__list";
  list.setAttribute("role", "listbox");
  panel.appendChild(list);

  /** Popover top-layer: blur real; se cierra al scroll del marco (sin sync → sin lag). */
  const PANEL_BLUR = "blur(40px) saturate(1.55)";
  const useTopLayerGlass = typeof panel.showPopover === "function";

  if (useTopLayerGlass) {
    root.classList.add("glass-select--top-layer");
    panel.setAttribute("popover", "manual");
  }

  /** @type {HTMLElement | null} */
  let scrollParent = null;
  let suppressToggleUntil = 0;

  function currentLabel() {
    return opts.options.find((o) => o.value === value)?.label ?? value;
  }

  function paintTrigger() {
    labelSpan.textContent = currentLabel();
  }

  function syncPosition() {
    if (!useTopLayerGlass) return;
    const triggerRect = trigger.getBoundingClientRect();
    panel.style.top = `${triggerRect.bottom + 6}px`;
    panel.style.left = `${triggerRect.left}px`;
    panel.style.width = `${triggerRect.width}px`;
  }

  function onScrollInteract(/** @type {Event} */ ev) {
    if (root.dataset.open !== "true") return;
    if (ev.composedPath().includes(panel)) return;
    if (ev.type === "scroll" && ev.target !== scrollParent) return;
    close();
  }

  function unbindScrollClose() {
    if (!(scrollParent instanceof HTMLElement)) return;
    scrollParent.removeEventListener("scroll", onScrollInteract);
    scrollParent.removeEventListener("wheel", onScrollInteract);
    scrollParent = null;
  }

  function close() {
    if (root.dataset.open !== "true") return;
    root.dataset.open = "false";
    trigger.setAttribute("aria-expanded", "false");
    suppressToggleUntil = performance.now() + 400;
    unbindScrollClose();
    window.removeEventListener("resize", syncPosition);
    if (useTopLayerGlass) {
      try {
        panel.hidePopover();
      } catch {
        /* ignore */
      }
      panel.style.top = "";
      panel.style.left = "";
      panel.style.width = "";
    }
    panel.classList.remove("glass-select__panel--open");
    panel.setAttribute("hidden", "");
  }

  function bindScrollClose() {
    scrollParent = root.closest(".section-frame__scroll");
    if (!(scrollParent instanceof HTMLElement)) return;
    scrollParent.addEventListener("scroll", onScrollInteract, { passive: true });
    scrollParent.addEventListener("wheel", onScrollInteract, { passive: true });
  }

  function selectOption(/** @type {string} */ nextValue) {
    value = nextValue;
    if (root.dataset.open === "true") close();
    paintTrigger();
    renderOptions();
    opts.onChange(value);
  }

  function open() {
    root.dataset.open = "true";
    trigger.setAttribute("aria-expanded", "true");
    panel.removeAttribute("hidden");
    panel.classList.add("glass-select__panel--open");
    if (useTopLayerGlass) {
      try {
        panel.showPopover();
      } catch {
        /* ignore */
      }
      syncPosition();
      window.addEventListener("resize", syncPosition, { passive: true });
      bindScrollClose();
    }
  }

  function renderOptions() {
    list.replaceChildren();
    for (const opt of opts.options) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "glass-select__option";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(opt.value === value));
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.addEventListener("pointerup", (ev) => {
        if (ev.pointerType === "mouse" && ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        selectOption(opt.value);
      });
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  trigger.addEventListener("click", (ev) => {
    if (performance.now() < suppressToggleUntil) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (root.dataset.open === "true") close();
    else open();
  });

  const onDoc = (/** @type {MouseEvent} */ ev) => {
    const path = ev.composedPath();
    if (path.includes(root) || path.includes(panel)) return;
    close();
  };
  document.addEventListener("click", onDoc);

  const onKey = (/** @type {KeyboardEvent} */ ev) => {
    if (ev.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  paintTrigger();
  renderOptions();
  root.append(trigger, panel);
  host.appendChild(root);

  return {
    getValue: () => value,
    setValue(next) {
      value = next;
      paintTrigger();
      renderOptions();
    },
    destroy() {
      close();
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", syncPosition);
      root.remove();
    },
  };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   value: number | null;
 *   min?: number;
 *   max?: number;
 *   name?: string;
 *   onChange?: (value: number | null) => void;
 * }} opts
 */
export function mountAgeStepper(host, opts) {
  const min = opts.min ?? 5;
  const max = opts.max ?? 14;
  let value = opts.value;

  const wrap = document.createElement("div");
  wrap.className = "glass-stepper";

  const dec = document.createElement("button");
  dec.type = "button";
  dec.className = "glass-stepper__btn";
  dec.dataset.dir = "dec";
  dec.setAttribute("aria-label", "Bajar edad");
  dec.appendChild(createGlassIconSvg("chevron", { size: 18 }));

  const input = document.createElement("input");
  input.className = "glass-field";
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.inputMode = "numeric";
  if (opts.name) input.name = opts.name;
  input.value = value == null ? "" : String(value);

  const inc = document.createElement("button");
  inc.type = "button";
  inc.className = "glass-stepper__btn";
  inc.dataset.dir = "inc";
  inc.setAttribute("aria-label", "Subir edad");
  inc.appendChild(createGlassIconSvg("chevron", { size: 18 }));

  function emit() {
    opts.onChange?.(value);
  }

  function set(n) {
    if (n == null || Number.isNaN(n)) {
      value = null;
      input.value = "";
    } else {
      value = Math.min(max, Math.max(min, n));
      input.value = String(value);
    }
    emit();
  }

  dec.addEventListener("click", () => set((value ?? min) - 1));
  inc.addEventListener("click", () => set((value ?? min) + 1));
  input.addEventListener("change", () => {
    if (input.value === "") set(null);
    else set(Number(input.value));
  });

  wrap.append(dec, input, inc);
  host.appendChild(wrap);

  return {
    getValue: () => value,
    getInput: () => input,
    destroy() {
      wrap.remove();
    },
  };
}

/** @typedef {'document' | 'panel' | 'lines' | 'timeline'} GlassSkeletonPreset */

/**
 * @param {string} widthClass
 * @param {string} [extra]
 * @returns {string}
 */
function glassSkeletonLine(widthClass, extra = "") {
  const extraClass = extra ? ` ${extra}` : "";
  return `<div class="glass-skeleton__line ${widthClass}${extraClass}" aria-hidden="true"></div>`;
}

/**
 * @param {string} label
 * @returns {string}
 */
function escapeGlassSkeletonAriaLabel(label) {
  return String(label).replace(/"/g, "&quot;");
}

/**
 * HTML del skeleton de carga (barras + shimmer).
 * @param {{ preset?: GlassSkeletonPreset; ariaLabel?: string }} [opts]
 * @returns {string}
 */
export function renderGlassSkeletonHtml(opts = {}) {
  const preset = opts.preset ?? "document";
  const ariaLabel = escapeGlassSkeletonAriaLabel(opts.ariaLabel ?? "Cargando");

  if (preset === "lines") {
    return `
    <div class="glass-skeleton glass-skeleton--lines" role="status" aria-live="polite" aria-label="${ariaLabel}">
      ${glassSkeletonLine("glass-skeleton__line--full")}
      ${glassSkeletonLine("glass-skeleton__line--wide")}
    </div>`;
  }

  if (preset === "panel") {
    return `
    <div class="glass-skeleton glass-skeleton--panel" role="status" aria-live="polite" aria-label="${ariaLabel}">
      ${glassSkeletonLine("glass-skeleton__line--title")}
      ${glassSkeletonLine("glass-skeleton__line--heading")}
      <div class="glass-skeleton__block">
        ${glassSkeletonLine("glass-skeleton__line--wide")}
        ${glassSkeletonLine("glass-skeleton__line--medium")}
        ${glassSkeletonLine("glass-skeleton__line--narrow")}
      </div>
    </div>`;
  }

  if (preset === "timeline") {
    return `
    <div class="glass-skeleton glass-skeleton--timeline" role="status" aria-live="polite" aria-label="${ariaLabel}">
      ${renderTimelineSkeletonItemsHtml(3)}
    </div>`;
  }

  return `
    <div class="glass-skeleton" role="status" aria-live="polite" aria-label="${ariaLabel}">
      ${glassSkeletonLine("glass-skeleton__line--title")}
      ${glassSkeletonLine("glass-skeleton__line--heading")}
      <div class="glass-skeleton__block">
        ${glassSkeletonLine("glass-skeleton__line--full")}
        ${glassSkeletonLine("glass-skeleton__line--wide")}
        ${glassSkeletonLine("glass-skeleton__line--medium")}
        ${glassSkeletonLine("glass-skeleton__line--full")}
        ${glassSkeletonLine("glass-skeleton__line--narrow")}
      </div>
      ${glassSkeletonLine("glass-skeleton__line--heading glass-skeleton__line--short")}
      <div class="glass-skeleton__block">
        ${glassSkeletonLine("glass-skeleton__line--wide")}
        ${glassSkeletonLine("glass-skeleton__line--medium")}
        ${glassSkeletonLine("glass-skeleton__line--full")}
        ${glassSkeletonLine("glass-skeleton__line--narrow")}
      </div>
    </div>`;
}

/**
 * Sustituye el contenido del host con un skeleton.
 * @param {HTMLElement} host
 * @param {{ preset?: GlassSkeletonPreset; ariaLabel?: string }} [opts]
 */
export function fillGlassSkeleton(host, opts = {}) {
  host.innerHTML = renderGlassSkeletonHtml(opts);
}

/**
 * @param {HTMLElement} host
 * @param {{ preset?: GlassSkeletonPreset; ariaLabel?: string }} [opts]
 * @returns {{ el: Element | null; destroy: () => void }}
 */
export function mountGlassSkeleton(host, opts = {}) {
  const wrap = document.createElement("div");
  wrap.innerHTML = renderGlassSkeletonHtml(opts);
  const skeleton = wrap.firstElementChild;
  if (skeleton) host.appendChild(skeleton);
  return {
    el: skeleton,
    destroy() {
      skeleton?.remove();
    },
  };
}

/**
 * HTML de una fila skeleton tipo timeline (cronología / mensajes).
 * @param {number} [index]
 * @returns {string}
 */
export function renderTimelineSkeletonItemHtml(index = 0) {
  const delay = (index % 3) * 0.08;
  return `
    <li class="glass-skeleton-timeline-item" aria-hidden="true" style="--glass-skeleton-shimmer-delay: ${delay}s">
      ${glassSkeletonLine("glass-skeleton__line--timeline-kind")}
      ${glassSkeletonLine("glass-skeleton__line--timeline-text")}
      ${glassSkeletonLine("glass-skeleton__line--timeline-at")}
    </li>`;
}

/**
 * @param {number} count
 * @returns {string}
 */
export function renderTimelineSkeletonItemsHtml(count = 3) {
  let html = "";
  for (let i = 0; i < count; i += 1) {
    html += renderTimelineSkeletonItemHtml(i);
  }
  return html;
}

/**
 * Añade filas skeleton al final de una lista (p. ej. «Ver más» en diario).
 * @param {HTMLElement} host — normalmente `<ol>` o contenedor de lista
 * @param {{ count?: number }} [opts]
 * @returns {() => void}
 */
export function mountTimelineSkeletonItems(host, opts = {}) {
  const count = opts.count ?? 3;
  const wrap = document.createElement("div");
  wrap.innerHTML = renderTimelineSkeletonItemsHtml(count);
  /** @type {HTMLElement[]} */
  const items = [];
  while (wrap.firstElementChild) {
    const el = wrap.firstElementChild;
    if (el instanceof HTMLElement) {
      host.appendChild(el);
      items.push(el);
    }
  }
  return () => {
    items.forEach((el) => el.remove());
  };
}

/**
 * Ejecuta una acción async en botón glass: estado busy + toast de resultado.
 * @param {HTMLButtonElement} btn
 * @param {() => Promise<{ ok: boolean; error?: string }>} run
 * @param {{ successMessage?: string; errorMessage?: string; busyLabel?: string; onSuccess?: (result: { ok: boolean; error?: string }) => void }} [opts]
 * @returns {Promise<{ ok: boolean; error?: string } | undefined>}
 */
export async function runGlassButtonAction(btn, run, opts = {}) {
  if (!(btn instanceof HTMLButtonElement) || btn.disabled || btn.dataset.busy === "1") {
    return undefined;
  }

  const iconId = /** @type {import('./shell-ui-icons.js').UiIconId} */ (
    btn.dataset.iconId || "save"
  );
  const label = btn.dataset.label || "";
  const busyLabel = opts.busyLabel ?? "Guardando…";

  btn.disabled = true;
  btn.dataset.busy = "1";
  btn.setAttribute("aria-busy", "true");
  setGlassButton(btn, "pending", busyLabel);

  const { showGlassToast } = await import("./glass-toast.js");

  try {
    const result = await run();
    if (result.ok) {
      if (opts.successMessage) {
        showGlassToast(opts.successMessage, { variant: "success", durationMs: 2400 });
      }
      opts.onSuccess?.(result);
    } else {
      showGlassToast(
        result.error || opts.errorMessage || "No hemos podido completar la acción.",
        { variant: "error" },
      );
    }
    return result;
  } catch {
    showGlassToast(
      opts.errorMessage || "No hemos podido completar la acción.",
      { variant: "error" },
    );
    return { ok: false };
  } finally {
    btn.disabled = false;
    delete btn.dataset.busy;
    btn.removeAttribute("aria-busy");
    setGlassButton(btn, iconId, label);
  }
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isTextishControl(el) {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.type || "text").toLowerCase();
  return ![
    "hidden",
    "checkbox",
    "radio",
    "password",
    "file",
    "range",
    "color",
    "button",
    "submit",
    "reset",
    "image",
  ].includes(type);
}

/**
 * Desactiva corrección ortográfica en inputs y textareas (DESIGN.md).
 * @param {ParentNode | Element} [root]
 */
export function applyNoSpellcheck(root = document) {
  /** @param {Node} node */
  function scan(node) {
    if (!(node instanceof Element)) return;
    if (isTextishControl(node)) {
      node.setAttribute("spellcheck", "false");
      node.setAttribute("autocorrect", "off");
      node.setAttribute("autocapitalize", "off");
    }
  }
  scan(root instanceof Element ? root : document.documentElement);
  const scope = root instanceof Element || root instanceof Document || root instanceof DocumentFragment
    ? root
    : document;
  scope.querySelectorAll("input, textarea, [contenteditable]").forEach((el) => scan(el));
}

/**
 * Observa el árbol y aplica `applyNoSpellcheck` a campos nuevos.
 * @param {ParentNode | Element} [root]
 * @returns {() => void}
 */
export function watchNoSpellcheck(root = document.documentElement) {
  applyNoSpellcheck(root);
  const target = root instanceof Node ? root : document.documentElement;
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) applyNoSpellcheck(node);
      }
    }
  });
  observer.observe(target, { childList: true, subtree: true });
  return () => observer.disconnect();
}
