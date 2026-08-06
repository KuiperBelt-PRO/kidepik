/**
 * Modal PIN teclado 3×3 (SPEC_APP_PRODUCT_BACKLOG_AGO2026 B9).
 * @module pin-pad-modal
 */

import { bindGlassIconTheme, setGlassButton } from "./glass-controls.js?v=226";

/**
 * @param {{
 *   title?: string;
 *   verify: (pin: string) => Promise<{ ok: boolean; error?: string }>;
 * }} opts
 * @returns {Promise<boolean>}
 */
export function showPinPadModal(opts) {
  const title = opts.title || "Introduce el PIN";
  return new Promise((resolve) => {
    /** @type {string} */
    let digits = "";
    /** @type {boolean} */
    let busy = false;

    const root = document.createElement("div");
    root.className = "glass-modal glass-modal--open pin-pad-modal";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", title);
    root.innerHTML = `
      <div class="glass-modal__scrim" data-scrim></div>
      <div class="glass-modal__panel glass-modal__panel--sm">
        <h2 class="glass-modal__title">${title}</h2>
        <div class="pin-pad" data-pin-pad>
          <div class="pin-pad__dots" data-dots aria-live="polite">
            <span class="pin-pad__dot" data-dot="0"></span>
            <span class="pin-pad__dot" data-dot="1"></span>
            <span class="pin-pad__dot" data-dot="2"></span>
            <span class="pin-pad__dot" data-dot="3"></span>
          </div>
          <p class="pin-pad__status" data-status aria-live="assertive"></p>
          <div class="pin-pad__grid" role="group" aria-label="Teclado numérico">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
              .map(
                (n) =>
                  `<button type="button" class="pin-pad__key crew-panel__chip" data-digit="${n}">${n}</button>`,
              )
              .join("")}
            <button type="button" class="pin-pad__key pin-pad__key--ghost" data-cancel>Cancelar</button>
            <button type="button" class="pin-pad__key crew-panel__chip" data-digit="0">0</button>
            <button type="button" class="pin-pad__key pin-pad__key--ghost" data-back aria-label="Borrar">⌫</button>
          </div>
        </div>
        <div class="glass-modal__footer">
          <button type="button" class="crew-panel__btn" data-close></button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    const unsub = bindGlassIconTheme(root);
    setGlassButton(root.querySelector("[data-close]"), "close", "Cerrar");

    const statusEl = root.querySelector("[data-status]");
    const dots = root.querySelectorAll("[data-dot]");

    const paintDots = () => {
      dots.forEach((el, i) => {
        el.classList.toggle("is-filled", i < digits.length);
      });
    };

    const setStatus = (msg) => {
      if (statusEl instanceof HTMLElement) statusEl.textContent = msg || "";
    };

    const close = (ok) => {
      unsub?.();
      root.remove();
      window.removeEventListener("keydown", onKey);
      resolve(ok);
    };

    const trySubmit = async () => {
      if (busy || digits.length !== 4) return;
      busy = true;
      setStatus("Comprobando…");
      try {
        const res = await opts.verify(digits);
        if (res.ok) {
          close(true);
          return;
        }
        digits = "";
        paintDots();
        setStatus(res.error || "PIN incorrecto");
      } catch {
        digits = "";
        paintDots();
        setStatus("No se pudo verificar el PIN");
      } finally {
        busy = false;
      }
    };

    const pushDigit = (d) => {
      if (busy || digits.length >= 4) return;
      digits += d;
      paintDots();
      setStatus("");
      if (digits.length === 4) void trySubmit();
    };

    const backspace = () => {
      if (busy || !digits.length) return;
      digits = digits.slice(0, -1);
      paintDots();
      setStatus("");
    };

    /**
     * @param {KeyboardEvent} ev
     */
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        close(false);
        return;
      }
      if (/^\d$/.test(ev.key)) {
        ev.preventDefault();
        pushDigit(ev.key);
        return;
      }
      if (ev.key === "Backspace") {
        ev.preventDefault();
        backspace();
      }
    };

    root.querySelectorAll("[data-digit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.getAttribute("data-digit");
        if (d) pushDigit(d);
      });
    });
    root.querySelector("[data-back]")?.addEventListener("click", backspace);
    root.querySelector("[data-cancel]")?.addEventListener("click", () => close(false));
    root.querySelector("[data-close]")?.addEventListener("click", () => close(false));
    root.querySelector("[data-scrim]")?.addEventListener("click", () => close(false));
    window.addEventListener("keydown", onKey);
    paintDots();
  });
}
