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

  const list = document.createElement("ul");
  list.className = "glass-select__list";
  list.setAttribute("role", "listbox");

  function currentLabel() {
    return opts.options.find((o) => o.value === value)?.label ?? value;
  }

  function paintTrigger() {
    labelSpan.textContent = currentLabel();
  }

  /** @type {HTMLElement | null} */
  let scrollParent = null;

  function positionList() {
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
    list.style.top = `${rect.bottom + gap}px`;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    list.style.maxHeight = `${Math.min(220, Math.max(96, spaceBelow))}px`;
  }

  function close() {
    if (root.dataset.open !== "true") return;
    root.dataset.open = "false";
    trigger.setAttribute("aria-expanded", "false");
    list.classList.remove("glass-select__list--open");
    list.style.top = "";
    list.style.left = "";
    list.style.width = "";
    list.style.maxHeight = "";
    if (scrollParent) {
      scrollParent.removeEventListener("scroll", positionList);
      scrollParent = null;
    }
    window.removeEventListener("resize", positionList);
    root.appendChild(list);
  }

  function open() {
    root.dataset.open = "true";
    trigger.setAttribute("aria-expanded", "true");
    list.classList.add("glass-select__list--open");
    document.body.appendChild(list);
    positionList();
    scrollParent = root.closest(".section-frame__scroll");
    if (scrollParent instanceof HTMLElement) {
      scrollParent.addEventListener("scroll", positionList, { passive: true });
    }
    window.addEventListener("resize", positionList, { passive: true });
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
      btn.addEventListener("click", () => {
        value = opt.value;
        paintTrigger();
        renderOptions();
        opts.onChange(value);
        close();
      });
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  trigger.addEventListener("click", () => {
    if (root.dataset.open === "true") close();
    else open();
  });

  const onDoc = (/** @type {MouseEvent} */ ev) => {
    const t = ev.target;
    if (!(t instanceof Node)) return;
    if (!root.contains(t) && !list.contains(t)) close();
  };
  document.addEventListener("click", onDoc);

  const onKey = (/** @type {KeyboardEvent} */ ev) => {
    if (ev.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  paintTrigger();
  renderOptions();
  root.append(trigger, list);
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
      window.removeEventListener("resize", positionList);
      list.remove();
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
