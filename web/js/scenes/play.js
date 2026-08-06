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
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=186";
import { navigate } from "../lib/router.js";
import { navigateShellRoute } from "../lib/shell-navigation.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=236";
import { openDialogueSession, submitDialogueTurn, loadDialogueHistory } from "../lib/play-api.js?v=244";
import { applyPlayWorldTheme, isPlayWorldTheme } from "../lib/play-theme.js";
import { historyErrorCopy, resolveHistoryCopy } from "../lib/play-history-copy.js?v=1";
import { appLog } from "../lib/app-logger.js";
import { mapPlayApiError, showGlassToast } from "../components/glass-toast.js";
import { isDebugAiClientActive } from "../lib/debug-ai.js?v=244";
import { openDebugAiPanel } from "../components/debug-ai-panel.js?v=244";

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

    // PIN gate (B9): verificar antes de abrir sesión de diálogo
    try {
      const { fetchCrewMember, verifyCrewExitPin } = await import("../lib/crew-api.js");
      const { showPinPadModal } = await import("../components/pin-pad-modal.js?v=1");
      const detail = await fetchCrewMember(session, childId);
      const perms = detail.ok ? detail.member?.permissions : null;
      if (perms?.require_exit_pin && perms?.exit_pin_set) {
        const ok = await showPinPadModal({
          title: "Introduce el PIN",
          verify: async (pin) => {
            const res = await verifyCrewExitPin(session, childId, pin);
            return { ok: Boolean(res.ok), error: res.error || "PIN incorrecto" };
          },
        });
        if (!ok || cancelled) {
          navigateShellRoute(`/crew/${childId}`);
          return;
        }
      }
    } catch {
      /* si falla el gate, seguimos (permisos no bloquean por error de red) */
    }

    const sessionOpenPromise = openDialogueSession(session, childId, "first_run");

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
      sessionOpenPromise,
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
 *   sessionOpenPromise?: ReturnType<typeof openDialogueSession>;
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
  /** @type {string | null} */
  let playAgeBand = null;
  let onboardingStep = "";
  /** @type {object | null} */
  let lastPendingTurn = null;
  let sending = false;
  /** @type {{ has_older: boolean, oldest_turn_id: string | null, page_size: number }} */
  let historyMeta = { has_older: false, oldest_turn_id: null, page_size: 24 };
  /** @type {Set<string>} */
  const renderedTurnIds = new Set();
  let historyLoading = false;
  let historyControlVisible = false;
  /** @type {HTMLElement | null} */
  let historyLoadWrap = null;
  /** @type {HTMLButtonElement | null} */
  let historyLoadBtn = null;
  /** @type {(() => void) | null} */
  let clearHistorySkeleton = null;

  const SCROLL_NEAR_BOTTOM_PX = 80;
  const SCROLL_NEAR_TOP_PX = 72;

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

  function isNearScrollBottom() {
    const sc = scrollContainer();
    if (!(sc instanceof HTMLElement)) return true;
    return sc.scrollHeight - sc.scrollTop - sc.clientHeight <= SCROLL_NEAR_BOTTOM_PX;
  }

  /**
   * @param {{ force?: boolean }} [opts]
   */
  function scrollLogToEnd(opts = {}) {
    const sc = scrollContainer();
    if (!(sc instanceof HTMLElement)) return;
    if (!opts.force && !isNearScrollBottom()) return;
    requestAnimationFrame(() => {
      sc.scrollTop = sc.scrollHeight;
    });
  }

  function updateHistoryButtonLabel(kind = "idle") {
    if (!(historyLoadBtn instanceof HTMLButtonElement)) return;
    const label = resolveHistoryCopy(playWorldTheme, playAgeBand, kind);
    historyLoadBtn.textContent = label;
    historyLoadBtn.setAttribute(
      "aria-label",
      `${label}. Cargar mensajes anteriores de la aventura`,
    );
  }

  function setHistoryControlVisible(visible) {
    if (!(historyLoadWrap instanceof HTMLElement)) return;
    const shouldShow = visible && historyMeta.has_older && !thinkingBubbleEl;
    if (shouldShow && !historyControlVisible) {
      updateHistoryButtonLabel("idle");
    }
    historyControlVisible = shouldShow;
    historyLoadWrap.classList.toggle("play-history-load--hidden", !shouldShow);
  }

  function syncHistoryControlFromScroll() {
    const sc = scrollContainer();
    if (!(sc instanceof HTMLElement) || !historyMeta.has_older || historyLoading) {
      setHistoryControlVisible(false);
      return;
    }
    setHistoryControlVisible(sc.scrollTop <= SCROLL_NEAR_TOP_PX);
  }

  function hideHistoryLoadingSkeleton() {
    clearHistorySkeleton?.();
    clearHistorySkeleton = null;
  }

  /** Skeleton glass en el log mientras llegan mensajes anteriores (DESIGN.md §11). */
  function showHistoryLoadingSkeleton() {
    hideHistoryLoadingSkeleton();
    if (!(logEl instanceof HTMLElement)) return;

    const group = document.createElement("div");
    group.className = "play-history-skeleton-group";
    group.setAttribute("role", "status");
    group.setAttribute("aria-live", "polite");
    group.setAttribute("aria-label", "Cargando mensajes anteriores");

    const anchor = historyLoadWrap?.nextSibling ?? null;
    logEl.insertBefore(group, anchor);

    for (let i = 0; i < 2; i += 1) {
      const host = document.createElement("div");
      host.className = `play-history-skeleton play-history-skeleton--${i % 2 === 0 ? "mentor" : "explorer"}`;
      host.setAttribute("aria-hidden", "true");
      fillGlassSkeleton(host, { preset: "lines", ariaLabel: "Cargando mensajes anteriores" });
      host.querySelector(".glass-skeleton")?.removeAttribute("role");
      group.appendChild(host);
    }

    clearHistorySkeleton = () => {
      group.remove();
      clearHistorySkeleton = null;
    };
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
    if (typeof data.age_band === "string" && data.age_band.trim()) {
      playAgeBand = data.age_band.trim();
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
      if (effect?.type === "set_age" && effect.value && typeof effect.value.age_band === "string") {
        playAgeBand = effect.value.age_band;
      }
      if (effect?.type === "set_effective_age_band" && typeof effect.value === "string") {
        playAgeBand = effect.value;
      }
    }
    if (historyControlVisible) {
      updateHistoryButtonLabel("idle");
    }
    applyWaitingCopy(data);
  }

  /**
   * Agrupa bandas para tono de espera del mentor (reservado; copy de espera viene del API).
   * @returns {'early' | 'child' | 'teen' | 'adult'}
   */
  function waitingToneBand() {
    switch (playAgeBand) {
      case "band_early":
        return "early";
      case "band_tween":
      case "band_teen":
        return "teen";
      case "band_adult":
      case "band_senior":
        return "adult";
      case "band_child":
      default:
        return "child";
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
  if (logEl instanceof HTMLElement) {
    fillGlassSkeleton(logEl, { preset: "panel", ariaLabel: "Cargando aventura" });
  }

  /**
   * Monta el control de historial en el log (tras quitar el skeleton).
   */
  function mountHistoryLoadControl() {
    if (!(logEl instanceof HTMLElement)) return;
    historyLoadWrap = document.createElement("div");
    historyLoadWrap.className = "play-history-load play-history-load--hidden";
    historyLoadBtn = document.createElement("button");
    historyLoadBtn.type = "button";
    historyLoadBtn.className = "play-history-load__btn";
    historyLoadBtn.addEventListener("click", () => {
      void loadOlderHistory();
    });
    historyLoadWrap.appendChild(historyLoadBtn);
    logEl.appendChild(historyLoadWrap);
    updateHistoryButtonLabel("idle");
  }
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

  /** Copy de sistema (no narrativa) cuando falla el compose de aventura. */
  const ADVENTURE_COMPOSE_FAILED_COPY =
    "No he podido preparar este tramo ahora mismo. Cuando quieras, lo intentamos de nuevo.";

  /** @type {Record<string, string[]>} */
  let waitingCopy = {
    preparing_exam: [],
    evaluating_answer: [],
    adventure_compose: [],
    general: [],
  };

  /**
   * @param {object | undefined} data
   */
  function applyWaitingCopy(data) {
    if (!data || typeof data !== "object") return;
    const bundle = data.waiting_copy;
    if (!bundle || typeof bundle !== "object") return;
    for (const key of ["preparing_exam", "evaluating_answer", "adventure_compose", "general"]) {
      const lines = bundle[key];
      if (Array.isArray(lines)) {
        waitingCopy[key] = lines.filter((l) => typeof l === "string" && l.trim());
      }
    }
  }

  /** @type {string[]} */
  let sessionWaitingHints = [];

  /**
   * Prefer waiting_hints from last turn meta (JSONL waiting phrases) when present.
   * @param {object | undefined} turn
   */
  function captureWaitingHints(turn) {
    const hints = turn?.meta?.waiting_hints;
    if (Array.isArray(hints) && hints.length > 0) {
      sessionWaitingHints = hints.filter((l) => typeof l === "string" && l.trim());
    }
  }

  /**
   * @param {{ kind: string, option_id?: string }} reply
   * @returns {'preparing_exam' | 'evaluating_answer' | 'adventure_compose' | 'general'}
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
    if (
      phase === "choose_zone" ||
      phase === "admission_map" ||
      phase === "zone_arrive" ||
      phase === "zone_between" ||
      phase === "adventure_challenge" ||
      phase === "compose_failed"
    ) {
      return "adventure_compose";
    }
    return "general";
  }

  /**
   * @param {'preparing_exam' | 'evaluating_answer' | 'adventure_compose' | 'general'} kind
   * @returns {string[]}
   */
  function thinkingLines(kind) {
    if (
      (kind === "preparing_exam" || kind === "adventure_compose") &&
      sessionWaitingHints.length > 0
    ) {
      return sessionWaitingHints;
    }
    const fromApi = waitingCopy[kind];
    if (Array.isArray(fromApi) && fromApi.length > 0) {
      return fromApi;
    }
    return [`${mentorLabel} está pensando…`];
  }

  /**
   * @param {'preparing_exam' | 'evaluating_answer' | 'adventure_compose' | 'general'} [kind]
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
      }, 8000);
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
  const scrollEl = scrollContainer();
  if (scrollEl instanceof HTMLElement) {
    const onScroll = () => syncHistoryControlFromScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    localCleanups.push(() => scrollEl.removeEventListener("scroll", onScroll));
  }

  /**
   * @param {object} meta
   * @returns {HTMLElement | null}
   */
  function buildChoiceResolvedEcho(meta) {
    if (!meta) return null;
    const taken = meta.choice_taken;
    const discarded = Array.isArray(meta.choices_discarded) ? meta.choices_discarded : [];
    if (!taken && discarded.length === 0) return null;

    const panel = document.createElement("div");
    panel.className = "play-choice-echo";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Elección de destino");

    if (taken && (taken.label || taken.id)) {
      const chosen = document.createElement("div");
      chosen.className = "play-choice-card play-choice-card--chosen";
      const label = document.createElement("p");
      label.className = "play-choice-card__label";
      label.textContent = String(taken.label || taken.id);
      const tag = document.createElement("p");
      tag.className = "play-choice-card__tag";
      tag.textContent = "Elegido";
      chosen.append(label, tag);
      panel.appendChild(chosen);
    }

    for (const opt of discarded) {
      const ghost = document.createElement("div");
      ghost.className = "play-choice-card play-choice-card--discarded";
      const label = document.createElement("p");
      label.className = "play-choice-card__label";
      label.textContent = String(opt.label || opt.id);
      const tag = document.createElement("p");
      tag.className = "play-choice-card__tag";
      tag.textContent = "Descartado";
      ghost.append(label, tag);
      panel.appendChild(ghost);
    }

    return panel;
  }

  /**
   * @param {string} role
   * @param {string} text
   * @param {string} [who]
   * @returns {HTMLElement}
   */
  function buildBubbleElement(role, text, who) {
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
    return bubble;
  }

  /**
   * @param {HTMLElement[]} nodes
   * @param {{ prepend?: boolean, scrollToEnd?: boolean }} [opts]
   */
  function insertLogNodes(nodes, opts = {}) {
    if (!(logEl instanceof HTMLElement) || nodes.length === 0) return;
    const sc = scrollContainer();
    const prepend = Boolean(opts.prepend);
    const prevScrollHeight = sc instanceof HTMLElement ? sc.scrollHeight : 0;
    const prevScrollTop = sc instanceof HTMLElement ? sc.scrollTop : 0;

    if (prepend) {
      const anchor = historyLoadWrap?.nextSibling ?? null;
      for (const node of nodes) {
        logEl.insertBefore(node, anchor);
      }
      if (sc instanceof HTMLElement) {
        sc.scrollTop = prevScrollTop + (sc.scrollHeight - prevScrollHeight);
      }
      return;
    }

    for (const node of nodes) {
      logEl.appendChild(node);
    }
    if (opts.scrollToEnd === true) {
      scrollLogToEnd({ force: true });
    } else if (opts.scrollToEnd !== false) {
      scrollLogToEnd();
    }
  }

  /**
   * @param {object} turn
   * @param {string} [who]
   * @returns {HTMLElement[]}
   */
  function buildTurnNodes(turn, who) {
    if (turn?.id) renderedTurnIds.add(String(turn.id));
    const role =
      turn.role === "explorer" || turn.role === "child"
        ? "explorer"
        : turn.role === "system"
          ? "mentor"
          : "mentor";
    let text = turn.text || "";
    if (!String(text).trim() && turn?.meta?.compose_failed) {
      text = ADVENTURE_COMPOSE_FAILED_COPY;
    }
    const nodes = [buildBubbleElement(role, text, role === "mentor" ? who : undefined)];
    if (role === "mentor" && turn?.meta?.phase === "choice_resolved") {
      const echo = buildChoiceResolvedEcho(turn.meta);
      if (echo) nodes.push(echo);
    }
    return nodes;
  }

  /**
   * @param {object} turn
   * @param {string} [who]
   * @param {{ prepend?: boolean, scrollToEnd?: boolean }} [opts]
   */
  function renderTurn(turn, who, opts = {}) {
    if (turn?.id && renderedTurnIds.has(String(turn.id))) return;
    insertLogNodes(buildTurnNodes(turn, who), opts);
  }

  /**
   * @param {string} role
   * @param {string} text
   * @param {string} [who]
   * @param {{ scrollToEnd?: boolean }} [opts]
   */
  function appendBubble(role, text, who, opts = {}) {
    if (!(logEl instanceof HTMLElement)) return;
    insertLogNodes([buildBubbleElement(role, text, who)], opts);
  }

  /**
   * @param {object} turn
   * @param {string} [who]
   * @param {{ prepend?: boolean, scrollToEnd?: boolean }} [opts]
   */
  function appendMentorTurn(turn, who, opts = {}) {
    renderTurn(turn, who, opts);
  }

  /**
   * @param {object} meta
   */
  function renderChoiceResolvedEcho(meta) {
    const echo = buildChoiceResolvedEcho(meta);
    if (!echo) return;
    insertLogNodes([echo]);
  }

  async function loadOlderHistory() {
    const sid = ctx.getSessionId();
    if (
      !sid ||
      historyLoading ||
      !historyMeta.has_older ||
      historyMeta.oldest_turn_id == null ||
      ctx.isCancelled()
    ) {
      return;
    }

    historyLoading = true;
    setHistoryControlVisible(false);
    if (historyLoadBtn instanceof HTMLButtonElement) {
      historyLoadBtn.disabled = true;
      historyLoadBtn.setAttribute("aria-busy", "true");
    }
    showHistoryLoadingSkeleton();

    const beforeTurnId = historyMeta.oldest_turn_id;

    try {
      const result = await loadDialogueHistory(ctx.session, ctx.childId, sid, beforeTurnId);
      if (ctx.isCancelled()) return;

      if (!result.ok || !result.data) {
        showGlassToast(historyErrorCopy(playWorldTheme), { variant: "error" });
        appLog("warn", "play_history_load", {
          child_id: ctx.childId,
          before_turn_id: beforeTurnId,
          ok: false,
        });
        return;
      }

      const turns = Array.isArray(result.data.turns) ? result.data.turns : [];
      const nodes = [];
      for (const turn of turns) {
        if (turn?.id && renderedTurnIds.has(String(turn.id))) continue;
        nodes.push(...buildTurnNodes(turn, mentorLabel));
      }
      insertLogNodes(nodes, { prepend: true });

      if (result.data.history && typeof result.data.history === "object") {
        historyMeta = {
          has_older: Boolean(result.data.history.has_older),
          oldest_turn_id:
            typeof result.data.history.oldest_turn_id === "string"
              ? result.data.history.oldest_turn_id
              : null,
          page_size:
            typeof result.data.history.page_size === "number"
              ? result.data.history.page_size
              : historyMeta.page_size,
        };
      }

      appLog("info", "play_history_load", {
        child_id: ctx.childId,
        before_turn_id: beforeTurnId,
        count: turns.length,
        ok: true,
      });
    } finally {
      hideHistoryLoadingSkeleton();
      historyLoading = false;
      if (historyLoadBtn instanceof HTMLButtonElement) {
        historyLoadBtn.disabled = false;
        historyLoadBtn.removeAttribute("aria-busy");
        updateHistoryButtonLabel("idle");
      }
      syncHistoryControlFromScroll();
    }
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
   * @param {object} turn
   * @returns {boolean}
   */
  function isChooseZoneTurn(turn) {
    if (turn?.meta?.phase === "choose_zone") return true;
    const opts = Array.isArray(turn?.options) ? turn.options : [];
    if (opts.length < 2) return false;
    return opts.every((o) => String(o.id || "").startsWith("zone_"));
  }

  /**
   * @param {{ id: string, label?: string, description?: string, why_for_you?: string }[]} opts
   * @returns {{ id: string, label: string, description: string }[]}
   */
  function enrichZoneOptions(opts) {
    return opts.map((opt) => {
      const desc = [opt.description, opt.why_for_you].filter(Boolean).join(" ");
      return {
        id: opt.id,
        label: opt.label || opt.id,
        description: desc || "Un destino del viaje.",
      };
    });
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
   * @param {string} [ariaLabel]
   */
  function renderWorldHints(hints, ariaLabel = "Mundos disponibles") {
    if (!(logEl instanceof HTMLElement) || hints.length === 0) return;
    clearWorldHints();

    const panel = document.createElement("div");
    panel.className = "play-world-hints";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", ariaLabel);

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

  /** @type {object | null} */
  let lastComposeDebug = null;

  /**
   * @param {object | null | undefined} composeDebug
   */
  function showComposeDebugChip(composeDebug) {
    if (!isDebugAiClientActive() || !(logEl instanceof HTMLElement)) return;
    logEl.querySelector("[data-compose-debug-chip]")?.remove();
    const p = document.createElement("p");
    p.className = "play-panel__debug-chip";
    p.setAttribute("data-compose-debug-chip", "");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Ver diagnóstico de la prueba";
    btn.addEventListener("click", () => {
      void openDebugAiPanel({
        session: ctx.session,
        childId: ctx.childId,
        composeDebug: composeDebug ?? lastComposeDebug,
      });
    });
    p.appendChild(btn);
    logEl.appendChild(p);
    scrollLogToEnd();
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
    /** @type {{ id: string, label?: string, description?: string, why_for_you?: string }[]} */
    let opts = Array.isArray(turn.options) ? turn.options : [];
    if (mode === "continue" && opts.length === 0) {
      opts = [{ id: "continue", label: "Continuar" }];
    }

    const chooseWorld = isChooseWorldTurn(turn);
    const chooseZone = isChooseZoneTurn(turn);
    if (chooseWorld) {
      renderWorldHints(enrichWorldOptions(opts), "Mundos disponibles");
    } else if (chooseZone) {
      renderWorldHints(enrichZoneOptions(opts), "Destinos del viaje");
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
        } else if (chooseZone) {
          const hint = enrichZoneOptions([opt])[0];
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
    captureWaitingHints(turn);
    if (turn?.meta?.compose_failed) {
      lastComposeDebug = turn.meta.compose_debug ?? lastComposeDebug;
      showComposeDebugChip(lastComposeDebug);
    } else {
      logEl?.querySelector("[data-compose-debug-chip]")?.remove();
    }
    scrollLogToEnd();
  }

  /**
   * Rehidrata el log y el pending desde openSession (resync tras fallo de transporte).
   * @param {object} data
   */
  function hydrateFromSession(data) {
    ctx.setSessionId(data.session_id);
    if (logEl instanceof HTMLElement) {
      logEl.innerHTML = "";
    }
    renderedTurnIds.clear();
    mountHistoryLoadControl();
    applyDialogueState(data);
    applyWaitingCopy(data);
    if (data.mentor?.display_name && mentorNameEl instanceof HTMLElement) {
      mentorLabel = data.mentor.display_name;
      mentorNameEl.textContent = mentorLabel;
    }
    if (data.history && typeof data.history === "object") {
      historyMeta = {
        has_older: Boolean(data.history.has_older),
        oldest_turn_id:
          typeof data.history.oldest_turn_id === "string" ? data.history.oldest_turn_id : null,
        page_size: typeof data.history.page_size === "number" ? data.history.page_size : 24,
      };
    }
    const turns = Array.isArray(data.turns) ? data.turns : [];
    for (const t of turns) {
      const role = t.role === "explorer" || t.role === "child" ? "explorer" : "mentor";
      if (role === "mentor") {
        captureWaitingHints(t);
        renderTurn(t, mentorLabel, { scrollToEnd: false });
      } else {
        if (t?.id) renderedTurnIds.add(String(t.id));
        insertLogNodes([buildBubbleElement(role, t.text || "", undefined)], { scrollToEnd: false });
      }
    }
    scrollLogToEnd({ force: true });
    syncHistoryControlFromScroll();
    const pending =
      data.pending_agent_turn ||
      turns.filter((t) => t.role === "mentor" || t.role === "agent").at(-1);
    if (pending) renderPending(pending);
    if (statusEl instanceof HTMLElement) statusEl.textContent = "";
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

    const prevPhase =
      typeof lastPendingTurn?.meta?.phase === "string" ? lastPendingTurn.meta.phase : "";
    const result = await submitDialogueTurn(ctx.session, ctx.childId, sid, reply);
    if (ctx.isCancelled()) return;
    if (!result.ok || !result.data) {
      // El servidor puede haber avanzado aunque el fetch falle (JSON corrupto / transporte).
      if (result.transport || result.error === "invalid_json" || result.status === 0) {
        const synced = await openDialogueSession(ctx.session, ctx.childId, "first_run");
        if (!ctx.isCancelled() && synced.ok && synced.data) {
          const pending = synced.data.pending_agent_turn;
          const nextPhase =
            typeof pending?.meta?.phase === "string" ? pending.meta.phase : "";
          if (nextPhase && nextPhase !== prevPhase) {
            hideThinking();
            hydrateFromSession(synced.data);
            sending = false;
            if (sendBtn instanceof HTMLButtonElement) sendBtn.disabled = false;
            return;
          }
        }
      }
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
    if (data.debug?.compose) {
      lastComposeDebug = data.debug.compose;
    }
    applyDialogueState(data);
    if (data.mentor?.display_name && mentorNameEl instanceof HTMLElement) {
      mentorLabel = data.mentor.display_name;
      mentorNameEl.textContent = mentorLabel;
    }

    const turns = Array.isArray(data.agent_turns) ? data.agent_turns : [];
    for (const t of turns) {
      captureWaitingHints(t);
      appendMentorTurn(t, mentorLabel);
    }
    const last = turns[turns.length - 1];
    if (last) {
      const phase = typeof last.meta?.phase === "string" ? last.meta.phase : "";
      if (phase === "placement_item" || phase === "placement_feedback") {
        onboardingStep = "placement";
      } else if (phase) {
        onboardingStep = phase;
      }
      if (last.meta?.compose_failed) {
        lastComposeDebug = last.meta.compose_debug ?? data.debug?.compose ?? lastComposeDebug;
        showComposeDebugChip(lastComposeDebug);
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

  const opened = await (ctx.sessionOpenPromise ?? openDialogueSession(ctx.session, ctx.childId, "first_run"));
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
  hydrateFromSession(data);

  ctx.onReady({
    destroy() {
      hideThinking();
      hideHistoryLoadingSkeleton();
      applyPlayWorldTheme(null);
      footer.remove();
      localCleanups.forEach((fn) => fn());
    },
  });
}
