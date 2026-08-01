/**
 * Escena play — diálogo con mentor dentro del marco glass + mundo animado.
 * @module scenes/play
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=236";
import { mountSectionFrame } from "../components/section-frame.js?v=236";
import {
  bindGlassIconTheme,
  createGlassIconSvg,
  fillGlassSkeleton,
  setGlassButton,
} from "../components/glass-controls.js?v=221";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=185";
import { navigate } from "../lib/router.js";
import { navigateShellRoute } from "../lib/shell-navigation.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=236";
import { openDialogueSession, submitDialogueTurn } from "../lib/play-api.js";
import { applyPlayWorldTheme, isPlayWorldTheme } from "../lib/play-theme.js";
import { mapPlayApiError, showGlassToast } from "../components/glass-toast.js";

/** Copy canónico de elección de mundo (fallback si el turno no trae description). */
const WORLD_THEME_HINTS = Object.freeze({
  "sci-fi": {
    label: "Ciencia ficción",
    description:
      "Naves, planetas y galaxias: serás cadete explorador en una misión por las estrellas.",
  },
  fantasy: {
    label: "Fantasía",
    description:
      "Magia, reinos y artefactos: tu camino pasa por bosques, montañas y castillos.",
  },
});

/**
 * @param {{ childId: string }} params
 */
export function renderPlay(params) {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  /** @type {{ destroy: (o?: object) => void; sectionHost?: HTMLElement } | null} */
  let chromeHandle = null;
  /** @type {{
   *   destroy: () => Promise<void>;
   *   contentEl?: HTMLElement;
   *   logoMountEl?: HTMLElement;
   *   root?: HTMLElement;
   *   syncLogoSkeleton?: (logoWrap?: HTMLElement | null) => void;
   * } | null} */
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
      title: "Aventura",
      ariaLabel: "Aventura",
      navigation: { forward: false },
    });

    const root = document.createElement("div");
    root.className = "play-panel crew-panel";
    frameHandle.contentEl?.appendChild(root);
    fillGlassSkeleton(root, { preset: "panel", ariaLabel: "Cargando aventura" });

    await applySectionEnter({
      scene: sceneEl,
      logoMount: frameHandle.logoMountEl,
      onLogoSettled: (logoWrap) => frameHandle?.syncLogoSkeleton?.(logoWrap),
    });
    frameHandle.syncLogoSkeleton?.();
    if (cancelled) return;

    await mountPlayPanel(root, {
      session,
      childId,
      frameRoot: frameHandle.root,
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
 *   frameRoot?: HTMLElement;
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
  /** @type {string | null} */
  let explorerDisplayName = null;
  /** @type {'fantasy' | 'sci-fi' | null} */
  let playWorldTheme = null;
  let onboardingStep = "";
  /** @type {object | null} */
  let lastPendingTurn = null;
  let sending = false;

  /**
   * @returns {HTMLElement | null}
   */
  function scrollContainer() {
    if (ctx.frameRoot instanceof HTMLElement) {
      const scoped = ctx.frameRoot.querySelector(".section-frame__scroll");
      if (scoped instanceof HTMLElement) return scoped;
    }
    if (logEl instanceof HTMLElement) {
      const closest = logEl.closest(".section-frame__scroll");
      if (closest instanceof HTMLElement) return closest;
    }
    return null;
  }

  function scrollLogToEnd() {
    const sc = scrollContainer();
    if (!(sc instanceof HTMLElement)) return;
    requestAnimationFrame(() => {
      sc.scrollTop = sc.scrollHeight;
    });
  }

  /**
   * @param {object} data
   */
  function applyDialogueState(data) {
    if (typeof data.display_name === "string" && data.display_name.trim()) {
      explorerDisplayName = data.display_name.trim();
    }
    if (isPlayWorldTheme(data.world_theme)) {
      playWorldTheme = data.world_theme;
      applyPlayWorldTheme(data.world_theme);
    }
    if (typeof data.onboarding_step === "string") {
      onboardingStep = data.onboarding_step;
    }
    const effects = Array.isArray(data.effects) ? data.effects : [];
    for (const effect of effects) {
      if (effect?.type === "set_world_theme" && isPlayWorldTheme(effect.value)) {
        playWorldTheme = effect.value;
        applyPlayWorldTheme(effect.value);
      }
      if (effect?.type === "advance_onboarding" && typeof effect.to === "string") {
        onboardingStep = effect.to;
      }
      if (effect?.type === "set_display_name" && typeof effect.value === "string") {
        explorerDisplayName = effect.value.trim();
      }
    }
  }

  /** Labels en castellano para ids de opción guardados en historial. */
  const EXPLORER_OPTION_LABELS = Object.freeze({
    fantasy: WORLD_THEME_HINTS.fantasy.label,
    "sci-fi": WORLD_THEME_HINTS["sci-fi"].label,
    spark: "Chispa de niebla",
    drake: "Dragón pequeño",
    spot: "Explorador spot",
    orbit: "Criatura orbital",
    custom: "Escribir la mía",
    continue: "Continuar",
  });

  /**
   * @param {string} text
   */
  function formatExplorerBubbleText(text) {
    const key = text.trim();
    return EXPLORER_OPTION_LABELS[key] ?? key;
  }

  function mentorIconId() {
    if (playWorldTheme === "sci-fi") return "theme-to-scifi";
    if (playWorldTheme === "fantasy") return "theme-to-fantasy";
    return "account";
  }

  function showExplorerIcon() {
    return ["choose_character", "placement", "complete"].includes(onboardingStep);
  }

  root.innerHTML = `
    <p class="crew-panel__subtitle play-panel__mentor" data-mentor-name>Aventura</p>
    <div class="play-panel__log" data-log role="log" aria-live="polite"></div>
    <p class="crew-panel__status play-panel__status" data-status aria-live="polite"></p>
  `;

  const footer = document.createElement("div");
  footer.className = "section-frame__footer play-panel__footer";
  footer.innerHTML = `
    <p class="play-panel__footer-progress" data-exam-progress hidden aria-live="polite"></p>
    <div class="play-panel__options" data-options role="group" aria-label="Opciones"></div>
    <form class="play-compose" data-form hidden>
      <textarea
        id="play-reply"
        class="play-compose__input"
        name="reply"
        rows="1"
        maxlength="280"
        autocomplete="off"
        spellcheck="false"
        autocorrect="off"
        autocapitalize="sentences"
        placeholder="Escribe tu respuesta…"
        aria-label="Tu respuesta"
      ></textarea>
      <button type="submit" class="play-compose__send" data-send aria-label="Enviar"></button>
    </form>
  `;
  if (ctx.frameRoot instanceof HTMLElement) {
    ctx.frameRoot.appendChild(footer);
  } else {
    root.appendChild(footer);
  }

  const logEl = root.querySelector("[data-log]");
  const optionsEl = footer.querySelector("[data-options]");
  const formEl = footer.querySelector("[data-form]");
  const statusEl = root.querySelector("[data-status]");
  const mentorNameEl = root.querySelector("[data-mentor-name]");
  const progressEl = footer.querySelector("[data-exam-progress]");
  const inputEl = footer.querySelector("#play-reply");
  const sendBtn = footer.querySelector("[data-send]");

  if (sendBtn instanceof HTMLButtonElement) {
    sendBtn.replaceChildren(createGlassIconSvg("chevron", { size: 18 }));
  }

  /** Altura máxima ~3 líneas antes de scroll interno. */
  const COMPOSE_MAX_HEIGHT_PX = 68;

  /**
   * @param {HTMLTextAreaElement} el
   */
  function autoGrowTextarea(el) {
    el.style.overflowY = "hidden";
    el.style.height = "0";
    const sh = el.scrollHeight;
    if (sh <= COMPOSE_MAX_HEIGHT_PX) {
      el.style.height = `${sh}px`;
      el.style.overflowY = "hidden";
    } else {
      el.style.height = `${COMPOSE_MAX_HEIGHT_PX}px`;
      el.style.overflowY = "auto";
    }
  }

  /**
   * @param {boolean} composeVisible
   */
  function syncFooterComposeMode(composeVisible) {
    footer.classList.toggle("play-panel__footer--compose", composeVisible);
    syncFooterChrome();
  }

  /** Oculta borde/fondo del footer cuando no hay opciones ni campo de texto. */
  function syncFooterChrome() {
    const optionsEmpty = !(optionsEl instanceof HTMLElement) || optionsEl.childElementCount === 0;
    const composeHidden = !(formEl instanceof HTMLElement) || formEl.hidden;
    const progressVisible = progressEl instanceof HTMLElement && !progressEl.hidden;
    footer.classList.toggle(
      "play-panel__footer--idle",
      optionsEmpty && composeHidden && !progressVisible,
    );
  }

  /** @type {HTMLElement | null} */
  let thinkingBubbleEl = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  let thinkingRotateTimer = null;
  /** @type {HTMLElement | null} */
  let thinkingTextEl = null;

  /**
   * @param {{ kind: string, option_id?: string }} reply
   * @returns {'preparing_exam' | 'evaluating_answer' | 'adventure' | 'general'}
   */
  function resolveThinkingKind(reply) {
    const phase =
      typeof lastPendingTurn?.meta?.phase === "string" ? lastPendingTurn.meta.phase : "";
    if (
      phase === "handoff_placement" ||
      reply.option_id === "start_placement" ||
      (reply.kind === "continue" && onboardingStep === "placement" && phase !== "placement_item")
    ) {
      return "preparing_exam";
    }
    if (phase === "placement_item" || phase === "placement_feedback") {
      return "evaluating_answer";
    }
    if (phase === "choose_zone" || phase === "adventure_challenge") {
      return "adventure";
    }
    return "general";
  }

  /**
   * @param {'preparing_exam' | 'evaluating_answer' | 'adventure' | 'general'} kind
   * @returns {string[]}
   */
  function thinkingLines(kind) {
    const name = mentorLabel;
    const fantasy = playWorldTheme !== "sci-fi";
    if (kind === "preparing_exam") {
      return fantasy
        ? [
            `${name} prepara tu prueba de ingreso: busca las mejores preguntas en la biblioteca de la Escuela…`,
            `${name} recorre los anaqueles del saber para elegir retos a tu medida…`,
            `${name} consulta pergaminos antiguos y arma un examen único para ti…`,
            `${name} sopesa materias y dificultades antes de abrir el umbral…`,
            `${name} enciende los faroles de la biblioteca: cada reto se escribe ahora mismo…`,
          ]
        : [
            `${name} compila tu prueba de acceso: consulta los archivos de la Academia…`,
            `${name} rastrea la biblioteca estelar en busca de retos a tu nivel…`,
            `${name} sincroniza módulos de saber y diseña un examen nuevo para ti…`,
            `${name} calcula dificultad y materias antes de abrir el protocolo de ingreso…`,
            `${name} descarga nodos de conocimiento: cada desafío se genera ahora…`,
          ];
    }
    if (kind === "evaluating_answer") {
      return fantasy
        ? [
            `${name} compara tu respuesta con las runas del umbral…`,
            `${name} anota el resultado y prepara el siguiente tramo…`,
            `${name} escucha el eco de tu respuesta en las bóvedas…`,
          ]
        : [
            `${name} coteja tu respuesta con el protocolo de la Academia…`,
            `${name} registra el resultado y carga el siguiente nodo…`,
            `${name} verifica la telemetría de tu respuesta…`,
          ];
    }
    if (kind === "adventure") {
      return fantasy
        ? [
            `${name} contempla el mapa del reino antes de responder…`,
            `${name} consulta el camino y las señales del territorio…`,
          ]
        : [
            `${name} traza la ruta en el mapa estelar…`,
            `${name} consulta sensores y bitácora de la misión…`,
          ];
    }
    return fantasy
      ? [
          `${name} medita un instante antes de hablar…`,
          `${name} busca las palabras justas…`,
          `${name} escucha el viento del umbral…`,
        ]
      : [
          `${name} procesa el enlace un momento…`,
          `${name} ajusta la frecuencia de la respuesta…`,
          `${name} consulta la bitácora breve…`,
        ];
  }

  /**
   * @param {'preparing_exam' | 'evaluating_answer' | 'adventure' | 'general'} [kind]
   */
  function showThinking(kind = "general") {
    if (!(logEl instanceof HTMLElement)) return;
    hideThinking();
    footer.classList.add("play-panel__footer--thinking");
    syncFooterChrome();

    const lines = thinkingLines(kind);
    let lineIndex = Math.floor(Math.random() * lines.length);
    const firstLine = lines[lineIndex] || `${mentorLabel} está pensando…`;

    if (kind === "preparing_exam") {
      syncExamProgress(null);
    }

    const bubble = document.createElement("div");
    bubble.className = "play-bubble play-bubble--mentor play-bubble--thinking";
    bubble.setAttribute("role", "status");
    bubble.setAttribute("aria-live", "polite");
    bubble.setAttribute("aria-label", firstLine);

    const head = document.createElement("div");
    head.className = "play-bubble__head";
    const iconSlot = document.createElement("span");
    iconSlot.className = "play-bubble__icon";
    iconSlot.appendChild(createGlassIconSvg(mentorIconId(), { size: 16 }));
    head.appendChild(iconSlot);
    const name = document.createElement("div");
    name.className = "play-bubble__who";
    name.textContent = mentorLabel;
    head.appendChild(name);
    bubble.appendChild(head);
    localCleanups.push(bindGlassIconTheme(bubble));

    const body = document.createElement("p");
    body.className = "play-thinking";
    const textSpan = document.createElement("span");
    textSpan.className = "play-thinking__text";
    textSpan.textContent = firstLine;
    body.appendChild(textSpan);
    const dots = document.createElement("span");
    dots.className = "play-thinking__dots";
    dots.setAttribute("aria-hidden", "true");
    dots.innerHTML = "<span></span><span></span><span></span>";
    body.appendChild(dots);
    bubble.appendChild(body);

    logEl.appendChild(bubble);
    thinkingBubbleEl = bubble;
    thinkingTextEl = textSpan;
    scrollLogToEnd();

    if (lines.length > 1) {
      thinkingRotateTimer = setInterval(() => {
        if (!(thinkingTextEl instanceof HTMLElement)) return;
        lineIndex = (lineIndex + 1) % lines.length;
        const next = lines[lineIndex];
        thinkingTextEl.textContent = next;
        bubble.setAttribute("aria-label", next);
        scrollLogToEnd();
      }, kind === "preparing_exam" ? 3200 : 4500);
    }
  }

  function hideThinking() {
    if (thinkingRotateTimer != null) {
      clearInterval(thinkingRotateTimer);
      thinkingRotateTimer = null;
    }
    footer.classList.remove("play-panel__footer--thinking");
    thinkingBubbleEl?.remove();
    thinkingBubbleEl = null;
    thinkingTextEl = null;
    syncFooterChrome();
  }

  if (inputEl instanceof HTMLTextAreaElement) {
    inputEl.addEventListener("input", () => autoGrowTextarea(inputEl));
    inputEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        formEl?.requestSubmit();
      }
    });
  }

  localCleanups.push(bindGlassIconTheme(root));
  localCleanups.push(bindGlassIconTheme(footer));

  /**
   * @param {string} role
   * @param {string} text
   * @param {string} [who]
   */
  function appendBubble(role, text, who) {
    if (!(logEl instanceof HTMLElement)) return;
    const bubble = document.createElement("div");
    bubble.className = `play-bubble play-bubble--${role}`;

    const displayText = role === "explorer" ? formatExplorerBubbleText(text) : text;
    const explorerWho = role === "explorer" ? explorerDisplayName : null;
    const mentorWho = role === "mentor" ? who : null;

    const iconId =
      role === "mentor"
        ? mentorIconId()
        : role === "explorer" && showExplorerIcon()
          ? "crew"
          : null;

    const showHead =
      iconId || (role === "mentor" && mentorWho) || (role === "explorer" && explorerWho);

    if (showHead) {
      const head = document.createElement("div");
      head.className = "play-bubble__head";
      if (iconId) {
        const iconSlot = document.createElement("span");
        iconSlot.className = "play-bubble__icon";
        iconSlot.appendChild(createGlassIconSvg(iconId, { size: 16 }));
        head.appendChild(iconSlot);
      }
      const whoLabel = mentorWho || explorerWho;
      if (whoLabel) {
        const name = document.createElement("div");
        name.className = "play-bubble__who";
        name.textContent = whoLabel;
        head.appendChild(name);
      }
      bubble.appendChild(head);
      localCleanups.push(bindGlassIconTheme(bubble));
    }

    const body = document.createElement("p");
    body.textContent = displayText;
    bubble.appendChild(body);
    logEl.appendChild(bubble);
    scrollLogToEnd();
  }

  /**
   * @param {object} turn
   * @returns {boolean}
   */
  function isChooseWorldTurn(turn) {
    if (turn?.meta?.phase === "choose_world") return true;
    const opts = Array.isArray(turn?.options) ? turn.options : [];
    if (opts.length < 2) return false;
    const ids = new Set(opts.map((o) => o.id));
    return ids.has("sci-fi") && ids.has("fantasy");
  }

  /**
   * @param {{ id: string, label?: string, description?: string }[]} opts
   * @returns {{ id: string, label: string, description: string }[]}
   */
  function enrichWorldOptions(opts) {
    return opts
      .filter((opt) => WORLD_THEME_HINTS[opt.id])
      .map((opt) => {
        const canon = WORLD_THEME_HINTS[opt.id];
        return {
          id: opt.id,
          label: opt.label || canon.label,
          description: opt.description || canon.description,
        };
      });
  }

  function clearWorldHints() {
    if (!(logEl instanceof HTMLElement)) return;
    logEl.querySelector(".play-world-hints")?.remove();
  }

  /**
   * @param {{ id: string, label: string, description: string }[]} hints
   */
  function renderWorldHints(hints) {
    if (!(logEl instanceof HTMLElement) || hints.length === 0) return;
    clearWorldHints();

    const panel = document.createElement("div");
    panel.className = "play-world-hints";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Mundos disponibles");

    for (const hint of hints) {
      const item = document.createElement("div");
      item.className = "play-world-hint";

      const label = document.createElement("p");
      label.className = "play-world-hint__label";
      label.textContent = hint.label;

      const desc = document.createElement("p");
      desc.className = "play-world-hint__desc";
      desc.textContent = hint.description;

      item.append(label, desc);
      panel.appendChild(item);
    }

    logEl.appendChild(panel);
    scrollLogToEnd();
  }

  /**
   * @param {object | null | undefined} turn
   * @returns {string | null}
   */
  function examProgressLabel(turn) {
    const phase = typeof turn?.meta?.phase === "string" ? turn.meta.phase : "";
    if (phase !== "placement_item" && phase !== "placement_feedback") return null;
    const index = Number(turn?.meta?.index);
    const total = Number(turn?.meta?.total);
    if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) return null;
    const n = index + 1;
    return playWorldTheme === "sci-fi" ? `Secuencia ${n} de ${total}` : `Reto ${n} de ${total}`;
  }

  /**
   * @param {object | null | undefined} turn
   */
  function syncExamProgress(turn) {
    if (!(progressEl instanceof HTMLElement)) return;
    const label = examProgressLabel(turn);
    if (label) {
      progressEl.hidden = false;
      progressEl.textContent = label;
      progressEl.setAttribute("aria-label", `Progreso de la prueba: ${label}`);
      syncFooterChrome();
      return;
    }
    progressEl.hidden = true;
    progressEl.textContent = "";
    progressEl.removeAttribute("aria-label");
    syncFooterChrome();
  }

  /**
   * @param {object} turn
   */
  function renderPending(turn) {
    if (!(optionsEl instanceof HTMLElement) || !(formEl instanceof HTMLElement)) return;
    optionsEl.innerHTML = "";
    formEl.hidden = true;
    syncFooterComposeMode(false);
    clearWorldHints();
    syncExamProgress(turn);

    const mode = turn.input_mode || "continue";
    /** @type {{ id: string, label?: string, description?: string }[]} */
    let opts = Array.isArray(turn.options) ? turn.options : [];
    if (mode === "continue" && opts.length === 0) {
      opts = [{ id: "continue", label: "Continuar" }];
    }

    const chooseWorld = isChooseWorldTurn(turn);
    if (chooseWorld) {
      renderWorldHints(enrichWorldOptions(opts));
    }

    if (mode === "options_only" || mode === "options_or_text" || mode === "continue") {
      optionsEl.classList.remove("play-panel__options--world");

      for (const opt of opts) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "crew-panel__chip play-panel__option";
        btn.textContent = opt.label || opt.id;
        if (chooseWorld && WORLD_THEME_HINTS[opt.id]) {
          const hint = enrichWorldOptions([opt])[0];
          btn.setAttribute("aria-label", `${hint.label}. ${hint.description}`);
        }

        btn.addEventListener("click", () => {
          void sendReply(
            opt.id === "continue" && mode === "continue"
              ? { kind: "continue", displayLabel: opt.label || "Continuar" }
              : {
                  kind: "option",
                  option_id: opt.id,
                  displayLabel: opt.label || opt.id,
                },
          );
        });
        optionsEl.appendChild(btn);
      }
    }
    if (mode === "text_only" || mode === "options_or_text") {
      formEl.hidden = false;
      syncFooterComposeMode(true);
      if (inputEl instanceof HTMLTextAreaElement) {
        inputEl.value = "";
        autoGrowTextarea(inputEl);
        inputEl.focus();
      }
    } else {
      syncFooterComposeMode(false);
    }
    syncFooterChrome();
    lastPendingTurn = turn;
    scrollLogToEnd();
  }

  /**
   * @param {{ kind: string, option_id?: string, text?: string, displayLabel?: string }} reply
   */
  async function sendReply(reply) {
    const sid = ctx.getSessionId();
    if (!sid || ctx.isCancelled() || sending) return;
    sending = true;
    if (sendBtn instanceof HTMLButtonElement) sendBtn.disabled = true;

    if (reply.kind === "text" && inputEl instanceof HTMLTextAreaElement) {
      inputEl.value = "";
      autoGrowTextarea(inputEl);
    }

    if (statusEl instanceof HTMLElement) statusEl.textContent = "";
    const thinkingKind = resolveThinkingKind(reply);
    showThinking(thinkingKind);
    if (thinkingKind === "evaluating_answer") {
      syncExamProgress(lastPendingTurn);
    } else if (thinkingKind !== "preparing_exam") {
      syncExamProgress(null);
    }
    clearWorldHints();
    if (optionsEl instanceof HTMLElement) optionsEl.innerHTML = "";
    if (formEl instanceof HTMLElement) formEl.hidden = true;
    syncFooterComposeMode(false);

    const shown =
      reply.displayLabel ||
      (reply.kind === "text"
        ? reply.text || ""
        : reply.kind === "option"
          ? reply.option_id || ""
          : "Continuar");

    const result = await submitDialogueTurn(ctx.session, ctx.childId, sid, reply);
    if (ctx.isCancelled()) return;
    if (!result.ok || !result.data) {
      showGlassToast(mapPlayApiError(result.error || "turn"), {
        variant: "error",
        persist: true,
      });
      if (lastPendingTurn) renderPending(lastPendingTurn);
      if (reply.kind === "text" && inputEl instanceof HTMLTextAreaElement) {
        inputEl.value = reply.text || "";
        autoGrowTextarea(inputEl);
      }
      hideThinking();
      sending = false;
      if (sendBtn instanceof HTMLButtonElement) sendBtn.disabled = false;
      return;
    }

    hideThinking();
    appendBubble("explorer", shown);

    const data = result.data;
    applyDialogueState(data);
    if (data.mentor?.display_name && mentorNameEl instanceof HTMLElement) {
      mentorLabel = data.mentor.display_name;
      mentorNameEl.textContent = mentorLabel;
    }

    const turns = Array.isArray(data.agent_turns) ? data.agent_turns : [];
    for (const t of turns) {
      appendBubble("mentor", t.text || "", mentorLabel);
    }
    const last = turns[turns.length - 1];
    if (last) {
      const phase = typeof last.meta?.phase === "string" ? last.meta.phase : "";
      if (phase === "placement_item" || phase === "placement_feedback") {
        onboardingStep = "placement";
      } else if (phase) {
        onboardingStep = phase;
      }
      renderPending(last);
    }
    scrollLogToEnd();
    sending = false;
    if (sendBtn instanceof HTMLButtonElement) sendBtn.disabled = false;
  }

  formEl?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!(inputEl instanceof HTMLTextAreaElement) || sending) return;
    const text = inputEl.value.trim();
    if (!text) return;
    void sendReply({ kind: "text", text });
  });

  if (statusEl instanceof HTMLElement) statusEl.textContent = "Abriendo diálogo…";
  const opened = await openDialogueSession(ctx.session, ctx.childId, "first_run");
  if (ctx.isCancelled()) return;
  if (!opened.ok || !opened.data) {
    footer.remove();
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
  applyDialogueState(data);
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
      hideThinking();
      applyPlayWorldTheme(null);
      footer.remove();
      localCleanups.forEach((fn) => fn());
    },
  });
}
