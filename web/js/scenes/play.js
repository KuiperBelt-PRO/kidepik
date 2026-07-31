/**
 * Escena play — diálogo con mentor dentro del marco glass + mundo animado.
 * @module scenes/play
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=185";
import { mountSectionFrame } from "../components/section-frame.js?v=188";
import {
  bindGlassIconTheme,
  fillGlassSkeleton,
  setGlassButton,
} from "../components/glass-controls.js?v=221";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=185";
import { navigate } from "../lib/router.js";
import { navigateShellRoute } from "../lib/shell-navigation.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=185";
import { openDialogueSession, submitDialogueTurn } from "../lib/play-api.js";

/**
 * @param {{ childId: string }} params
 */
export function renderPlay(params) {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  /** @type {{ destroy: (o?: object) => void; sectionHost?: HTMLElement } | null} */
  let chromeHandle = null;
  /** @type {{ destroy: () => Promise<void>; contentEl?: HTMLElement; logoMountEl?: HTMLElement } | null} */
  let frameHandle = null;
  let cancelled = false;
  /** @type {(() => void)[]} */
  let cleanups = [];

  /** @type {string | null} */
  let sessionId = null;
  const childId = params.childId;
  /** @type {import('@supabase/supabase-js').Session | null} */
  let session = null;

  async function doSignOut() {
    destroyAppShell();
    await signOut();
    navigate("/loader");
  }

  void (async () => {
    session = await getValidSession();
    if (cancelled) return;
    if (!session) {
      destroyAppShell();
      navigate("/loader");
      return;
    }

    ensureAppShell({ onSignOut: doSignOut });
    chromeHandle = mountLoaderChrome(app, { compactSection: true });
    const sceneEl = app.querySelector(".scene-loader");
    const host = chromeHandle.sectionHost;
    if (!(host instanceof HTMLElement) || !(sceneEl instanceof HTMLElement)) return;

    frameHandle = mountSectionFrame(host, {
      ariaLabel: "Aventura",
      navigation: { forward: false },
    });

    const root = document.createElement("div");
    root.className = "play-panel crew-panel";
    frameHandle.contentEl?.appendChild(root);
    fillGlassSkeleton(root, { preset: "panel", ariaLabel: "Cargando aventura" });

    await applySectionEnter({ scene: sceneEl, logoMount: frameHandle.logoMountEl });
    if (cancelled) return;

    await mountPlayPanel(root, {
      session,
      childId,
      onReady(handle) {
        cleanups.push(() => handle.destroy());
      },
      getSessionId: () => sessionId,
      setSessionId: (id) => {
        sessionId = id;
      },
      isCancelled: () => cancelled,
    });
  })();

  return {
    destroy(options = {}) {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      cleanups = [];
      void frameHandle?.destroy();
      frameHandle = null;
      chromeHandle?.destroy(options);
      chromeHandle = null;
    },
  };
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   session: import('@supabase/supabase-js').Session;
 *   childId: string;
 *   onReady: (h: { destroy: () => void }) => void;
 *   getSessionId: () => string | null;
 *   setSessionId: (id: string) => void;
 *   isCancelled: () => boolean;
 * }} ctx
 */
async function mountPlayPanel(root, ctx) {
  /** @type {(() => void)[]} */
  const localCleanups = [];
  let mentorLabel = "Mentor";

  root.innerHTML = `
    <p class="crew-panel__subtitle play-panel__mentor" data-mentor-name>Aventura</p>
    <div class="play-panel__log" data-log role="log" aria-live="polite"></div>
    <div class="play-panel__compose">
      <div class="play-panel__options" data-options role="group" aria-label="Opciones"></div>
      <form class="play-panel__form" data-form hidden>
        <label class="crew-panel__label" for="play-reply">Tu respuesta
          <input id="play-reply" class="glass-field crew-panel__input" name="reply" maxlength="280" autocomplete="off" />
        </label>
        <button type="submit" class="crew-panel__btn crew-panel__btn--primary" data-send></button>
      </form>
    </div>
    <p class="crew-panel__status" data-status aria-live="polite"></p>
  `;

  const logEl = root.querySelector("[data-log]");
  const optionsEl = root.querySelector("[data-options]");
  const formEl = root.querySelector("[data-form]");
  const statusEl = root.querySelector("[data-status]");
  const mentorNameEl = root.querySelector("[data-mentor-name]");
  const inputEl = root.querySelector("#play-reply");
  const sendBtn = root.querySelector("[data-send]");

  if (sendBtn instanceof HTMLButtonElement) {
    setGlassButton(sendBtn, "save", "Enviar");
  }
  localCleanups.push(bindGlassIconTheme(root));

  /**
   * @param {string} role
   * @param {string} text
   * @param {string} [who]
   */
  function appendBubble(role, text, who) {
    if (!(logEl instanceof HTMLElement)) return;
    const bubble = document.createElement("div");
    bubble.className = `play-bubble play-bubble--${role}`;
    if (who && role === "mentor") {
      const name = document.createElement("div");
      name.className = "play-bubble__who";
      name.textContent = who;
      bubble.appendChild(name);
    }
    const body = document.createElement("p");
    body.textContent = text;
    bubble.appendChild(body);
    logEl.appendChild(bubble);
    logEl.scrollTop = logEl.scrollHeight;
  }

  /**
   * @param {object} turn
   */
  function renderPending(turn) {
    if (!(optionsEl instanceof HTMLElement) || !(formEl instanceof HTMLElement)) return;
    optionsEl.innerHTML = "";
    formEl.hidden = true;

    const mode = turn.input_mode || "continue";
    /** @type {{ id: string, label?: string }[]} */
    let opts = Array.isArray(turn.options) ? turn.options : [];
    if (mode === "continue" && opts.length === 0) {
      opts = [{ id: "continue", label: "Continuar" }];
    }

    if (mode === "options_only" || mode === "options_or_text" || mode === "continue") {
      for (const opt of opts) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "crew-panel__chip play-panel__option";
        btn.textContent = opt.label || opt.id;
        btn.addEventListener("click", () => {
          void sendReply(
            opt.id === "continue" && mode === "continue"
              ? { kind: "continue" }
              : { kind: "option", option_id: opt.id },
          );
        });
        optionsEl.appendChild(btn);
      }
    }
    if (mode === "text_only" || mode === "options_or_text") {
      formEl.hidden = false;
      if (inputEl instanceof HTMLInputElement) {
        inputEl.value = "";
        inputEl.focus();
      }
    }
  }

  /**
   * @param {{ kind: string, option_id?: string, text?: string }} reply
   */
  async function sendReply(reply) {
    const sid = ctx.getSessionId();
    if (!sid || ctx.isCancelled()) return;
    if (statusEl instanceof HTMLElement) statusEl.textContent = "…";
    if (optionsEl instanceof HTMLElement) optionsEl.innerHTML = "";
    if (formEl instanceof HTMLElement) formEl.hidden = true;

    const shown =
      reply.kind === "text"
        ? reply.text || ""
        : reply.kind === "option"
          ? reply.option_id || ""
          : "Continuar";
    appendBubble("explorer", shown);

    const result = await submitDialogueTurn(ctx.session, ctx.childId, sid, reply);
    if (ctx.isCancelled()) return;
    if (!result.ok || !result.data) {
      if (statusEl instanceof HTMLElement) {
        statusEl.textContent = result.error || "No se pudo continuar. Reintenta.";
      }
      return;
    }

    const data = result.data;
    if (data.mentor?.display_name && mentorNameEl instanceof HTMLElement) {
      mentorLabel = data.mentor.display_name;
      mentorNameEl.textContent = mentorLabel;
    }

    const turns = Array.isArray(data.agent_turns) ? data.agent_turns : [];
    for (const t of turns) {
      appendBubble("mentor", t.text || "", mentorLabel);
    }
    const last = turns[turns.length - 1];
    if (last) renderPending(last);
    if (statusEl instanceof HTMLElement) {
      statusEl.textContent = "";
    }
  }

  formEl?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!(inputEl instanceof HTMLInputElement)) return;
    const text = inputEl.value.trim();
    if (!text) return;
    void sendReply({ kind: "text", text });
  });

  if (statusEl instanceof HTMLElement) statusEl.textContent = "Abriendo diálogo…";
  const opened = await openDialogueSession(ctx.session, ctx.childId, "first_run");
  if (ctx.isCancelled()) return;
  if (!opened.ok || !opened.data) {
    root.innerHTML = `
      <p class="crew-panel__error">No se pudo abrir la sesión de aventura.</p>
      <button type="button" class="crew-panel__btn" data-back-crew></button>`;
    const back = root.querySelector("[data-back-crew]");
    if (back instanceof HTMLButtonElement) {
      setGlassButton(back, "chevron", "Volver al tripulante");
      back.addEventListener("click", () => {
        void navigateShellRoute(`/crew/${ctx.childId}`);
      });
    }
    localCleanups.push(bindGlassIconTheme(root));
    return;
  }

  const data = opened.data;
  ctx.setSessionId(data.session_id);
  if (data.mentor?.display_name && mentorNameEl instanceof HTMLElement) {
    mentorLabel = data.mentor.display_name;
    mentorNameEl.textContent = mentorLabel;
  }
  const turns = Array.isArray(data.turns) ? data.turns : [];
  for (const t of turns) {
    const role = t.role === "explorer" || t.role === "child" ? "explorer" : "mentor";
    appendBubble(role, t.text || "", role === "mentor" ? mentorLabel : undefined);
  }
  const pending =
    data.pending_agent_turn ||
    turns.filter((t) => t.role === "mentor" || t.role === "agent").at(-1);
  if (pending) renderPending(pending);
  if (statusEl instanceof HTMLElement) statusEl.textContent = "";

  ctx.onReady({
    destroy() {
      localCleanups.forEach((fn) => fn());
    },
  });
}
