/**
 * Escena play — diálogo con mentor dentro del marco glass + mundo animado.
 * @module scenes/play
 */

import { mountLoaderChrome } from "../components/loader-chrome.js?v=236";
import { mountSectionFrame } from "../components/section-frame.js?v=261";
import {
  bindGlassIconTheme,
  createGlassIconSvg,
  fillGlassSkeleton,
  setGlassButton,
} from "../components/glass-controls.js?v=227";
import { ensureAppShell, destroyAppShell } from "../components/app-shell.js?v=186";
import { navigate } from "../lib/router.js";
import { navigateShellRoute } from "../lib/shell-navigation.js";
import { getValidSession, signOut } from "../lib/supabase.js";
import { applySectionEnter } from "../lib/shell-section-transition.js?v=236";
import {
  openDialogueSession,
  submitDialogueTurn,
  loadDialogueHistory,
  fetchPlayBaggage,
  usePlayBaggageItem,
} from "../lib/play-api.js?v=261";
import { renderDialogueMarkdown } from "../lib/markdown.js?v=2";
import { applyPlayWorldTheme, isPlayWorldTheme } from "../lib/play-theme.js";
import { historyErrorCopy, resolveHistoryCopy } from "../lib/play-history-copy.js?v=1";
import { appLog } from "../lib/app-logger.js";
import { mapPlayApiError, showGlassToast } from "../components/glass-toast.js";
import { showGlassConfirm } from "../components/glass-modal.js";
import { isDebugAiAllowed, isDebugAiClientActive, setDebugAiServerAllowed } from "../lib/debug-ai.js?v=256";
import { fetchDebugAiStatus } from "../lib/debug-ai-api.js?v=256";
import { postDebugJourneyRewind } from "../lib/debug-journey-api.js?v=256";
import { openDebugAiPanel } from "../components/debug-ai-panel.js?v=257";
import { baggageGlyphId, renderBaggageHtml, wireBaggageGrid } from "../lib/baggage-ui.js?v=8";
import {
  renderBaggageOfferStripHtml,
  shouldShowBaggageOfferStrip,
} from "../lib/play-baggage-offer.js?v=1";
import { formatLevelLabel } from "../lib/subject-catalog.js?v=253";
import { renderShellUiIconSvgInner } from "../components/shell-ui-icons.js";
import { getShellUiTheme } from "../lib/shell-theme.js";

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
      title: "",
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
      const { showPinPadModal } = await import("../components/pin-pad-modal.js?v=3");
      const { consumeExitPinVerified } = await import("../lib/exit-pin-gate.js");
      const detail = await fetchCrewMember(session, childId);
      const perms = detail.ok ? detail.member?.permissions : null;
      const pinAlreadyOk = consumeExitPinVerified(childId);
      if (perms?.require_exit_pin && perms?.exit_pin_set && !pinAlreadyOk) {
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
      frameHeader: frameHandle.headerEl,
      setChapterTitle: (text) => frameHandle?.setTitle(text),
      setHeaderTrailing: (node) => frameHandle?.setHeaderTrailing?.(node),
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
 *   frameHeader?: HTMLElement;
 *   setChapterTitle?: (text: string) => void;
 *   setHeaderTrailing?: (node: HTMLElement | null) => void;
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
  /** @type {number | null} */
  let playAgeYears = null;
  let onboardingStep = "";
  /** @type {object | null} */
  let lastPendingTurn = null;
  let sending = false;
  let rewinding = false;
  let debugRewindEnabled = false;
  /** @type {'dialogue' | 'baggage'} */
  let playViewMode = "dialogue";
  /** @type {any} */
  let baggageCache = null;
  let baggageDirty = false;
  /** @type {any[]} */
  let lastBaggageOffers = [];
  /** @type {HTMLElement | null} */
  let progressHudEl = null;
  /** @type {HTMLButtonElement | null} */
  let baggageToggleBtn = null;
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
   * @param {{ title?: string } | null | undefined} chapter
   */
  function applyChapterTitle(chapter) {
    const title = typeof chapter?.title === "string" ? chapter.title.trim() : "";
    if (!title) return;
    ctx.setChapterTitle?.(title);
    if (ctx.frameRoot instanceof HTMLElement) {
      const titleEl = ctx.frameRoot.querySelector(".section-frame__title");
      if (titleEl instanceof HTMLElement) {
        titleEl.setAttribute("aria-live", "polite");
        titleEl.classList.add("section-frame__title--chapter");
      }
    }
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
    } else if (data.age_years == null && data.age_band == null) {
      playAgeBand = null;
    }
    if (typeof data.age_years === "number") {
      playAgeYears = data.age_years;
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
      if (effect?.type === "set_age" && effect.value && typeof effect.value.age_years === "number") {
        playAgeYears = effect.value.age_years;
      }
      if (effect?.type === "set_effective_age_band" && typeof effect.value === "string") {
        playAgeBand = effect.value;
      }
    }
    if (historyControlVisible) {
      updateHistoryButtonLabel("idle");
    }
    applyWaitingCopy(data);
    if (Array.isArray(data.baggage_offers)) {
      lastBaggageOffers = data.baggage_offers;
    }
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
    guardian: "Guardián del claro",
    cadete: "Cadete estelar",
    orbit: "Criatura orbital",
    androide: "Androide curioso",
    custom: "Escribir la mía",
    continue: "Continuar",
    male: "Chico",
    female: "Chica",
  });

  /**
   * @param {string} id
   */
  function genderChipLabel(id) {
    const adult = playAgeYears != null && playAgeYears >= 18;
    if (id === "male") return adult ? "Hombre" : "Chico";
    if (id === "female") return adult ? "Mujer" : "Chica";
    return null;
  }

  /**
   * @param {string} text
   * @param {object} [turn]
   */
  function resolveExplorerBubbleText(text, turn) {
    const reply = turn?.explorer_reply;
    if (reply && typeof reply.displayLabel === "string" && reply.displayLabel.trim()) {
      return reply.displayLabel.trim();
    }
    const key = String(text || "").trim();
    const genderLabel = genderChipLabel(key);
    if (genderLabel) return genderLabel;
    return EXPLORER_OPTION_LABELS[key] ?? key;
  }

  /**
   * @param {string} text
   */
  function formatExplorerBubbleText(text) {
    return resolveExplorerBubbleText(text);
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
    <div class="play-dialogue-view" data-play-dialogue>
      <div class="play-panel__log" data-log role="log" aria-live="polite"></div>
      <p class="crew-panel__status play-panel__status" data-status aria-live="polite"></p>
    </div>
    <div class="play-baggage-view" data-play-baggage hidden></div>
  `;

  const footer = document.createElement("div");
  footer.className = "section-frame__footer play-panel__footer";
  footer.innerHTML = `
    <p class="play-panel__footer-progress" data-exam-progress hidden aria-live="polite"></p>
    <div class="play-baggage-offer" data-baggage-offer hidden aria-label="Equipaje disponible"></div>
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

  const dialogueView = root.querySelector("[data-play-dialogue]");
  const baggageView = root.querySelector("[data-play-baggage]");
  const logEl = root.querySelector("[data-log]");
  if (logEl instanceof HTMLElement) {
    fillGlassSkeleton(logEl, { preset: "panel", ariaLabel: "Cargando aventura" });
  }

  function paintToggleIcon() {
    if (!(baggageToggleBtn instanceof HTMLButtonElement)) return;
    const id = playViewMode === "baggage" ? "chat" : "baggage";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "section-frame__nav-icon");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = renderShellUiIconSvgInner({
      id: /** @type {any} */ (id),
      theme: getShellUiTheme(),
      viewSize: 20,
      fill: "#fff",
    });
    baggageToggleBtn.replaceChildren(svg);
    baggageToggleBtn.setAttribute(
      "aria-label",
      playViewMode === "baggage" ? "Volver a la conversación" : "Ver equipaje",
    );
    baggageToggleBtn.setAttribute("aria-pressed", String(playViewMode === "baggage"));
  }

  function mountBaggageToggle() {
    if (typeof ctx.setHeaderTrailing !== "function") return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "section-frame__nav-btn--baggage-toggle";
    btn.addEventListener("click", () => {
      void setPlayViewMode(playViewMode === "dialogue" ? "baggage" : "dialogue");
    });
    baggageToggleBtn = btn;
    paintToggleIcon();
    ctx.setHeaderTrailing(btn);
  }

  /**
   * @param {any} hud
   */
  function syncProgressHud(hud) {
    if (!(ctx.frameHeader instanceof HTMLElement)) return;
    if (!(progressHudEl instanceof HTMLElement)) {
      progressHudEl = document.createElement("div");
      progressHudEl.className = "play-progress-hud";
      progressHudEl.setAttribute("data-play-progress-hud", "");
      progressHudEl.hidden = true;
      ctx.frameHeader.appendChild(progressHudEl);
    }
    if (!hud || !hud.visible || !hud.general_progress) {
      progressHudEl.hidden = true;
      progressHudEl.innerHTML = "";
      return;
    }
    const gp = hud.general_progress;
    const percent = Math.max(0, Math.min(100, Number(gp.percent_to_next) || 0));
    const esc = (value) => String(value || "").replaceAll("<", "&lt;");
    let leftLabel = hud.rank_label_child || "Explorador";
    let rightLabel = hud.rank_next_label_child || "";
    if (hud.show_levels_to_child) {
      const cur = formatLevelLabel(gp.current);
      const next = formatLevelLabel(gp.next);
      if (cur) leftLabel = cur;
      if (next) rightLabel = next;
    }
    progressHudEl.hidden = false;
    progressHudEl.innerHTML = `
      <div class="play-progress-hud__track">
        <span class="play-progress-hud__rank play-progress-hud__rank--current">${esc(leftLabel)}</span>
        <div class="play-progress-hud__bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso hacia el siguiente rango">
          <div class="play-progress-hud__fill" style="width:${percent}%"></div>
        </div>
        <span class="play-progress-hud__rank play-progress-hud__rank--next">${esc(rightLabel)}</span>
      </div>
    `;
  }

  /**
   * @param {any} bag
   */
  function paintPlayBaggage(bag) {
    if (!(baggageView instanceof HTMLElement)) return;
    baggageView.innerHTML = renderBaggageHtml(bag, { audience: "child", allowUse: Boolean(sessionId) });
    baggageView.querySelectorAll("[data-icon]").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const id = baggageGlyphId(el.getAttribute("data-icon") || "baggage");
      const size = el.classList.contains("crew-baggage__icon")
        ? 36
        : el.classList.contains("crew-baggage__section-title-icon")
          ? 20
          : 24;
      el.replaceChildren(createGlassIconSvg(/** @type {any} */ (id), { size }));
    });
    wireBaggageGrid(baggageView, bag.items || [], {
      audience: "child",
      allowUse: Boolean(sessionId),
      onUse: (item, effectId) => {
        if (!sessionId) return;
        void (async () => {
          const res = await usePlayBaggageItem(ctx.session, ctx.childId, String(item.id), {
            effect_id: effectId,
            session_id: sessionId,
          });
          if (!res.ok || !res.data) {
            showGlassToast(mapPlayApiError(res.error || "use"), { variant: "error" });
            return;
          }
          if (res.data.baggage) {
            baggageCache = res.data.baggage;
            paintPlayBaggage(baggageCache);
          } else {
            baggageDirty = true;
          }
          if (res.data.hint_text) {
            showGlassToast(String(res.data.hint_text), { variant: "success" });
          } else if (res.data.mentor_line) {
            showGlassToast(String(res.data.mentor_line), { variant: "success" });
          }
          if (res.data.challenge_reopened && Array.isArray(res.data.agent_turns)) {
            await setPlayViewMode("dialogue");
            for (const t of res.data.agent_turns) {
              appendMentorTurn(t, mentorLabel);
            }
            const pending =
              res.data.pending_agent_turn ||
              res.data.agent_turns[res.data.agent_turns.length - 1];
            if (pending) renderPending(pending);
            scrollLogToEnd();
          }
        })();
      },
    });
  }

  async function loadPlayBaggage() {
    if (!(baggageView instanceof HTMLElement)) return;
    if (baggageCache && !baggageDirty) {
      paintPlayBaggage(baggageCache);
      return;
    }
    fillGlassSkeleton(baggageView, { preset: "panel", ariaLabel: "Cargando equipaje" });
    const res = await fetchPlayBaggage(ctx.session, ctx.childId);
    if (!res.ok || !res.data) {
      baggageView.innerHTML = `<p class="crew-panel__helper">No se pudo cargar el equipaje.</p>`;
      return;
    }
    baggageCache = res.data;
    baggageDirty = false;
    paintPlayBaggage(baggageCache);
  }

  /**
   * @param {'dialogue' | 'baggage'} mode
   */
  async function setPlayViewMode(mode) {
    playViewMode = mode;
    paintToggleIcon();
    if (dialogueView instanceof HTMLElement) dialogueView.hidden = mode !== "dialogue";
    if (baggageView instanceof HTMLElement) baggageView.hidden = mode !== "baggage";
    footer.hidden = mode === "baggage";
    if (mode === "baggage") {
      formEl?.setAttribute("hidden", "");
      optionsEl?.setAttribute("hidden", "");
      baggageToggleBtn?.classList.remove("is-badge");
      await loadPlayBaggage();
    }
  }

  mountBaggageToggle();
  localCleanups.push(() => ctx.setHeaderTrailing?.(null));
  localCleanups.push(() => progressHudEl?.remove());

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
  const baggageOfferEl = footer.querySelector("[data-baggage-offer]");
  const formEl = footer.querySelector("[data-form]");
  const statusEl = root.querySelector("[data-status]");
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
  /** @type {HTMLElement | null} */
  let optimisticExplorerBubble = null;

  /** Copy de sistema (no narrativa) cuando falla el compose de aventura. */
  const ADVENTURE_COMPOSE_FAILED_COPY =
    "No he podido preparar este tramo ahora mismo. Cuando quieras, lo intentamos de nuevo.";

  /** Contrato servidor: la fase manda sobre input_mode almacenado (rewind / turnos legacy). */
  const PHASE_INPUT_MODE = Object.freeze({
    choose_world: "options_only",
    choose_name: "text_only",
    choose_age: "options_or_text",
    choose_gender: "options_only",
    choose_character_species: "options_or_text",
    choose_character: "options_or_text",
    handoff_placement: "continue",
    placement_item: "options_only",
    placement_feedback: "continue",
    choose_path: "options_only",
    path_intro: "continue",
  });

  const DEFAULT_GENDER_OPTIONS = Object.freeze([
    { id: "male", label: "Chico" },
    { id: "female", label: "Chica" },
  ]);

  const DEFAULT_AGE_OPTIONS = Object.freeze(
    [6, 7, 8, 9, 10, 12, 15, 18, 30, 50, 70].map((age) => ({
      id: String(age),
      label: String(age),
    })),
  );

  const SPECIES_OPTIONS_BY_WORLD = Object.freeze({
    fantasy: [
      { id: "spark", label: "Chispa de niebla" },
      { id: "drake", label: "Dragón pequeño" },
      { id: "guardian", label: "Guardián del claro" },
    ],
    "sci-fi": [
      { id: "cadete", label: "Cadete estelar" },
      { id: "orbit", label: "Criatura orbital" },
      { id: "androide", label: "Androide curioso" },
    ],
  });

  /**
   * @param {'fantasy' | 'sci-fi' | null | undefined} world
   */
  function speciesOptionsForWorld(world) {
    const theme = world === "sci-fi" ? "sci-fi" : "fantasy";
    return SPECIES_OPTIONS_BY_WORLD[theme];
  }

  /**
   * Etiqueta visible de una opción (soporta alias LLM: text, value, description…).
   * @param {{ id?: string, label?: string, text?: string, value?: string, answer?: string, description?: string } | null | undefined} opt
   * @param {string} [phase]
   */
  function optionChipLabel(opt, phase = "") {
    const id = String(opt?.id ?? "").trim();
    const label = String(
      opt?.label ?? opt?.text ?? opt?.value ?? opt?.answer ?? "",
    ).trim();
    const desc = String(opt?.description ?? "").trim();
    let body = label;
    if (
      body &&
      id &&
      body.length <= 2 &&
      body.toUpperCase() === id.toUpperCase() &&
      desc
    ) {
      body = desc;
    } else if (!body && desc) {
      body = desc;
    }
    if (phase === "placement_item" && body) return body;
    return body || id;
  }

  /**
   * @param {object | null | undefined} turn
   */
  function resolvePendingInputMode(turn) {
    const phase = typeof turn?.meta?.phase === "string" ? turn.meta.phase : "";
    if (phase && PHASE_INPUT_MODE[phase]) return PHASE_INPUT_MODE[phase];
    return turn?.input_mode || "continue";
  }

  /** Restaura footer y flags tras rehidratar (rewind, resync). */
  function resetPlayInteractionState() {
    hideThinking();
    sending = false;
    if (sendBtn instanceof HTMLButtonElement) sendBtn.disabled = false;
    if (inputEl instanceof HTMLTextAreaElement) {
      inputEl.disabled = false;
      inputEl.readOnly = false;
    }
    footer.classList.remove("play-panel__footer--thinking");
  }

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

  /**
   * Quita la burbuja del turno ancla y todo lo posterior (rewind en curso).
   * @param {string} turnId
   */
  function removeLogFromTurn(turnId) {
    if (!(logEl instanceof HTMLElement) || !turnId) return;
    const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(turnId) : turnId;
    const anchor =
      logEl.querySelector(`.play-bubble[data-turn-id="${safeId}"]`) ||
      logEl.querySelector(`.play-bubble__rewind[data-turn-id="${safeId}"]`)?.closest(".play-bubble");
    if (!(anchor instanceof HTMLElement)) return;

    let node = anchor;
    while (node) {
      const next = node.nextSibling;
      if (
        node instanceof HTMLElement &&
        !node.classList.contains("play-history-load-wrap")
      ) {
        node.remove();
      }
      node = next;
    }

    renderedTurnIds.delete(turnId);
    clearWorldHints();
    if (optionsEl instanceof HTMLElement) optionsEl.innerHTML = "";
    if (formEl instanceof HTMLElement) formEl.hidden = true;
    syncFooterComposeMode(false);
    syncExamProgress(null);
    lastPendingTurn = null;
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

  /** Fases de turno explorador que muestran eco de opciones descartadas. */
  const CHOICE_ECHO_PHASES = new Set([
    "placement_choice_echo",
    "path_choice_echo",
    "path_challenge_echo",
  ]);

  /**
   * @param {object} meta
   * @returns {string}
   */
  function choiceEchoAriaLabel(meta) {
    if (meta?.phase === "path_choice_echo") return "Elección de destino";
    if (
      meta?.phase === "placement_choice_echo" ||
      meta?.phase === "path_challenge_echo"
    ) {
      return "Respuesta del reto";
    }
    return "Elección de destino";
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
    panel.setAttribute("aria-label", choiceEchoAriaLabel(meta));

    if (taken && (taken.label || taken.id)) {
      const incorrect = meta.choice_correct === false;
      const chosen = document.createElement("div");
      chosen.className = incorrect
        ? "play-choice-card play-choice-card--chosen play-choice-card--incorrect"
        : "play-choice-card play-choice-card--chosen";
      const label = document.createElement("p");
      label.className = "play-choice-card__label";
      label.textContent = String(taken.label || taken.id);
      const tag = document.createElement("p");
      tag.className = "play-choice-card__tag";
      tag.textContent = incorrect ? "Incorrecto" : "Elegido";
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
   * @param {object} [turn]
   * @returns {HTMLElement}
   */
  function buildBubbleElement(role, text, who, turn) {
    const bubble = document.createElement("div");
    bubble.className = `play-bubble play-bubble--${role}`;
    if (turn?.id) {
      bubble.dataset.turnId = String(turn.id);
    }

    const displayText = role === "explorer" ? resolveExplorerBubbleText(text, turn) : text;
    const explorerWho = role === "explorer" ? explorerDisplayName : null;
    const mentorWho = role === "mentor" ? who : null;

    const iconId =
      role === "mentor"
        ? mentorIconId()
        : role === "explorer" && showExplorerIcon()
          ? "crew"
          : null;

    const whoLabel = mentorWho || explorerWho;
    const showRewind = Boolean(debugRewindEnabled && turn?.id);
    const showHead = Boolean(iconId || whoLabel || showRewind);

    if (showHead) {
      const head = document.createElement("div");
      head.className = "play-bubble__head";
      if (iconId) {
        const iconSlot = document.createElement("span");
        iconSlot.className = "play-bubble__icon";
        iconSlot.appendChild(createGlassIconSvg(iconId, { size: 16 }));
        head.appendChild(iconSlot);
      }
      if (whoLabel) {
        const name = document.createElement("div");
        name.className = "play-bubble__who";
        name.textContent = whoLabel;
        head.appendChild(name);
      }
      if (showRewind) {
        const rewindBtn = document.createElement("button");
        rewindBtn.type = "button";
        rewindBtn.className = "play-bubble__rewind";
        rewindBtn.dataset.turnId = String(turn.id);
        rewindBtn.setAttribute("aria-label", "Rebobinar viaje hasta aquí");
        rewindBtn.textContent = "↺";
        rewindBtn.disabled = sending || rewinding;
        if (rewinding) rewindBtn.setAttribute("aria-disabled", "true");
        rewindBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const phase =
            typeof turn?.meta?.phase === "string" ? turn.meta.phase : "";
          void handleRewindClick(String(turn.id), phase);
        });
        head.appendChild(rewindBtn);
      }
      bubble.appendChild(head);
      localCleanups.push(bindGlassIconTheme(bubble));
    }

    const body = document.createElement("div");
    body.className = "play-bubble__body";
    if (role === "mentor") {
      body.innerHTML = renderDialogueMarkdown(displayText);
    } else {
      const para = document.createElement("p");
      para.textContent = displayText;
      body.appendChild(para);
    }
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
    const nodes = [buildBubbleElement(role, text, role === "mentor" ? who : undefined, turn)];
    if (role === "mentor" && turn?.meta?.phase === "choice_resolved") {
      const echo = buildChoiceResolvedEcho(turn.meta);
      if (echo) nodes.push(echo);
    }
    if (
      role === "explorer" &&
      (CHOICE_ECHO_PHASES.has(turn?.meta?.phase) || turn?.meta?.choice_taken)
    ) {
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
   * @param {string} text
   */
  function appendOptimisticExplorerBubble(text) {
    optimisticExplorerBubble?.remove();
    const bubble = buildBubbleElement("explorer", text, undefined, undefined);
    bubble.dataset.optimistic = "1";
    insertLogNodes([bubble], { scrollToEnd: true });
    optimisticExplorerBubble = bubble;
  }

  function clearOptimisticExplorerBubble() {
    optimisticExplorerBubble?.remove();
    optimisticExplorerBubble = null;
  }

  /**
   * @param {string} role
   * @param {string} text
   * @param {string} [who]
   * @param {{ scrollToEnd?: boolean }} [opts]
   */
  function appendBubble(role, text, who, opts = {}) {
    if (!(logEl instanceof HTMLElement)) return;
    insertLogNodes([buildBubbleElement(role, text, who, undefined)], opts);
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

  /**
   * @param {{ id: string, label?: string, description?: string }[]} opts
   * @returns {{ id: string, label: string, description: string }[]}
   */
  function enrichPathOptions(opts) {
    return opts.map((opt) => ({
      id: opt.id,
      label: opt.label || opt.id,
      description: opt.description || "Un camino del viaje.",
    }));
  }

  /**
   * @param {object} turn
   * @returns {boolean}
   */
  function isChoosePathTurn(turn) {
    return turn?.meta?.phase === "choose_path";
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
    const index = Number(turn?.meta?.index ?? turn?.meta?.challenge_index);
    const total = Number(turn?.meta?.total);
    if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) return null;
    const n = index + 1;
    if (phase === "placement_item" || phase === "placement_feedback") {
      return playWorldTheme === "sci-fi" ? `Secuencia ${n} de ${total}` : `Reto ${n} de ${total}`;
    }
    if (phase === "path_challenge") {
      return playWorldTheme === "sci-fi" ? `Prueba ${n} de ${total}` : `Reto ${n} de ${total}`;
    }
    return null;
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
      const phase = typeof turn?.meta?.phase === "string" ? turn.meta.phase : "";
      const scope =
        phase === "path_challenge" ? "del camino" : "de la prueba";
      progressEl.setAttribute("aria-label", `Progreso ${scope}: ${label}`);
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
      const debug = composeDebug ?? lastComposeDebug;
      void openDebugAiPanel({
        session: ctx.session,
        childId: ctx.childId,
        composeDebug: debug,
        purpose:
          typeof debug?.purpose === "string"
            ? debug.purpose
            : "placement_item_writer",
      });
    });
    p.appendChild(btn);
    logEl.appendChild(p);
    scrollLogToEnd();
  }

  /**
   * @param {object} turn
   */
  function renderBaggageOfferStrip(turn) {
    if (!(baggageOfferEl instanceof HTMLElement)) return;
    const meta = turn?.meta && typeof turn.meta === "object" ? turn.meta : {};
    const show = shouldShowBaggageOfferStrip(lastBaggageOffers, {
      phase: meta.phase,
      retry: meta.retry,
    });
    if (!show) {
      baggageOfferEl.hidden = true;
      baggageOfferEl.innerHTML = "";
      return;
    }
    baggageOfferEl.innerHTML = renderBaggageOfferStripHtml(lastBaggageOffers);
    baggageOfferEl.hidden = false;
    baggageOfferEl.querySelectorAll("[data-icon]").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const id = baggageGlyphId(el.getAttribute("data-icon") || "baggage");
      el.replaceChildren(createGlassIconSvg(/** @type {any} */ (id), { size: 16 }));
    });
    baggageOfferEl.querySelectorAll("[data-baggage-offer-chip]").forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.addEventListener("click", () => {
        const rowId = btn.getAttribute("data-baggage-offer-chip");
        const effectId = btn.getAttribute("data-effect-id") || "challenge_hint";
        if (!rowId || btn.disabled) return;
        void useBaggageOffer(rowId, effectId);
      });
    });
    baggageOfferEl.querySelector("[data-baggage-offer-more]")?.addEventListener("click", () => {
      void setPlayViewMode("baggage");
    });
  }

  /**
   * @param {string} itemRowId
   * @param {string} effectId
   */
  async function useBaggageOffer(itemRowId, effectId) {
    if (!sessionId) return;
    const res = await usePlayBaggageItem(ctx.session, ctx.childId, itemRowId, {
      effect_id: effectId,
      session_id: sessionId,
    });
    if (!res.ok || !res.data) {
      showGlassToast(mapPlayApiError(res.error || "use"), { variant: "error" });
      return;
    }
    if (Array.isArray(res.data.baggage_offers)) {
      lastBaggageOffers = res.data.baggage_offers;
    } else if (res.data.baggage) {
      baggageCache = res.data.baggage;
      baggageDirty = false;
      lastBaggageOffers = (res.data.baggage.items || [])
        .filter((it) => it?.usable_now && it?.can_use)
        .slice(0, 3)
        .flatMap((it) =>
          (it.effects || [])
            .filter((fx) => fx === "challenge_hint" || fx === "challenge_retry")
            .map((fx) => ({
              item_row_id: it.id,
              label_child: it.label_child,
              icon_id: it.icon_id,
              effect_id: fx,
              can_use: it.can_use,
            })),
        );
    }
    if (res.data.baggage) {
      baggageCache = res.data.baggage;
      paintPlayBaggage(baggageCache);
    } else {
      baggageDirty = true;
    }
    if (res.data.hint_text) {
      const hintBubble = {
        id: `hint-${Date.now()}`,
        role: "mentor",
        content: String(res.data.mentor_line ? `${res.data.mentor_line} ${res.data.hint_text}` : res.data.hint_text),
        meta: { phase: "baggage_hint" },
      };
      appendMentorTurn(hintBubble, mentorLabel);
    } else if (res.data.mentor_line) {
      showGlassToast(String(res.data.mentor_line), { variant: "success" });
    }
    if (res.data.challenge_reopened && Array.isArray(res.data.agent_turns)) {
      for (const t of res.data.agent_turns) {
        appendMentorTurn(t, mentorLabel);
      }
      const pending =
        res.data.pending_agent_turn || res.data.agent_turns[res.data.agent_turns.length - 1];
      if (pending) renderPending(pending);
      scrollLogToEnd();
      return;
    }
    if (lastPendingTurn) renderBaggageOfferStrip(lastPendingTurn);
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

    const mode = resolvePendingInputMode(turn);
    /** @type {{ id: string, label?: string, description?: string, why_for_you?: string }[]} */
    let opts = Array.isArray(turn.options) ? turn.options : [];
    const phase = typeof turn?.meta?.phase === "string" ? turn.meta.phase : "";
    if (phase === "choose_age" && opts.length === 0) {
      opts = [...DEFAULT_AGE_OPTIONS];
    }
    if (phase === "choose_gender" && opts.length === 0) {
      opts = [...DEFAULT_GENDER_OPTIONS];
    }
    if (
      (phase === "choose_character_species" || phase === "choose_character") &&
      opts.length === 0
    ) {
      opts = [...speciesOptionsForWorld(playWorldTheme)];
    }
    if (mode === "text_only") {
      opts = [];
    } else {
      opts = opts.filter(
        (opt) =>
          String(opt.id || "").toLowerCase() !== "continue" &&
          String(opt.label || "").trim().toLowerCase() !== "continuar",
      );
    }
    if (mode === "continue" && opts.length === 0) {
      opts = [{ id: "continue", label: "Continuar" }];
    }

    const chooseWorld = isChooseWorldTurn(turn);
    const chooseZone = isChooseZoneTurn(turn);
    const choosePath = isChoosePathTurn(turn);
    if (chooseWorld) {
      renderWorldHints(enrichWorldOptions(opts), "Mundos disponibles");
    } else if (chooseZone) {
      renderWorldHints(enrichZoneOptions(opts), "Destinos del viaje");
    } else if (choosePath) {
      renderWorldHints(enrichPathOptions(opts), "Caminos disponibles");
    }

    if (mode === "options_only" || mode === "options_or_text" || mode === "continue") {
      optionsEl.classList.remove("play-panel__options--world");

      for (const opt of opts) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "crew-panel__chip play-panel__option";
        const chipLabel = optionChipLabel(opt, phase);
        btn.textContent = chipLabel;
        if (chooseWorld && WORLD_THEME_HINTS[opt.id]) {
          const hint = enrichWorldOptions([opt])[0];
          btn.setAttribute("aria-label", `${hint.label}. ${hint.description}`);
        } else if (chooseZone) {
          const hint = enrichZoneOptions([opt])[0];
          btn.setAttribute("aria-label", `${hint.label}. ${hint.description}`);
        } else if (choosePath) {
          const hint = enrichPathOptions([opt])[0];
          btn.setAttribute("aria-label", `${hint.label}. ${hint.description}`);
        }

        btn.addEventListener("click", () => {
          void sendReply(
            opt.id === "continue" && mode === "continue"
              ? { kind: "continue", displayLabel: opt.label || "Continuar" }
              : {
                  kind: "option",
                  option_id: opt.id,
                  displayLabel: chipLabel,
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
    if (phase === "placement_item") {
      formEl.hidden = true;
      syncFooterComposeMode(false);
    }
    syncFooterChrome();
    lastPendingTurn = turn;
    renderBaggageOfferStrip(turn);
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
   * @param {string} turnId
   * @param {string} [phase]
   */
  function resolveRewindThinkingKind(phase) {
    if (phase === "placement_item" || phase === "placement_feedback") {
      return "evaluating_answer";
    }
    if (phase === "handoff_placement" || phase === "placement_compose") {
      return "preparing_exam";
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
   * @param {string} phase
   * @returns {string}
   */
  function resolveRewindUiPhase(phase) {
    if (phase === "placement_choice_echo") return "placement_item";
    if (phase === "path_challenge_echo") return "path_challenge";
    if (phase === "path_choice_echo") return "choose_path";
    return phase;
  }

  /**
   * @param {string} turnId
   * @param {string} [phase]
   */
  async function handleRewindClick(turnId, phase = "") {
    if (rewinding || sending || !debugRewindEnabled) return;
    const sid = ctx.getSessionId();
    if (!sid) return;
    const uiPhase = resolveRewindUiPhase(phase);

    const confirmed = await showGlassConfirm({
      title: "Rebobinar viaje",
      body:
        uiPhase === "placement_item"
          ? "<p>¿Volver a mostrar esta pregunta del examen? Se mantendrá el mismo examen.</p>"
          : uiPhase === "choose_path"
            ? "<p>¿Volver a la elección de caminos tras el examen? Se borrará lo posterior.</p>"
            : uiPhase === "path_challenge"
              ? "<p>¿Volver a mostrar esta pregunta del reto? Se borrará lo posterior.</p>"
              : uiPhase === "path_intro"
                ? "<p>¿Volver al inicio de este camino? Se borrará lo posterior.</p>"
                : uiPhase === "placement_feedback"
                  ? "<p>¿Volver justo después del examen (elección de caminos)? Se borrará lo posterior.</p>"
                  : "<p>¿Rebobinar hasta este mensaje? Se borrará lo posterior y el mentor volverá a redactar esta pregunta.</p>",
      footer: "Esta acción no se puede deshacer.",
      danger: true,
      confirmLabel: "Rebobinar",
    });
    if (!confirmed) return;

    rewinding = true;
    logEl?.querySelectorAll(".play-bubble__rewind").forEach((btn) => {
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      }
    });

    removeLogFromTurn(turnId);
    const thinkingKind = resolveRewindThinkingKind(uiPhase);
    showThinking(thinkingKind);
    if (uiPhase === "placement_item" && lastPendingTurn?.id === turnId) {
      syncExamProgress(lastPendingTurn);
    }

    try {
      const session = await getValidSession();
      if (!session) {
        showGlassToast("Sesión expirada. Vuelve a iniciar sesión.", { variant: "error" });
        return;
      }
      const res = await postDebugJourneyRewind(session, ctx.childId, sid, turnId);
      if (!res.ok || !res.data) {
        const message =
          res.detail || "No se pudo rebobinar el viaje. Prueba con reset completo del viajero.";
        showGlassToast(message, { variant: "error" });
        appLog.warn("play_rewind_failed", { status: res.status, turnId });
        return;
      }
      hydrateFromSession(res.data);
      const rewind = res.data?.debug?.rewind;
      const regenerateMode =
        typeof rewind?.regenerate_mode === "string" ? rewind.regenerate_mode : "";
      showGlassToast(
        regenerateMode === "placement_reemit"
          ? "Pregunta del examen restaurada"
          : regenerateMode === "choose_path_reemit"
            ? "Elección de caminos restaurada"
            : regenerateMode === "path_challenge_reemit"
              ? "Pregunta del reto restaurada"
              : regenerateMode === "path_intro_reemit"
                ? "Inicio del camino restaurado"
                : rewind?.regenerated
                  ? "Mensaje regenerado"
                  : "Viaje rebobinado",
        { variant: "success" },
      );
    } catch (err) {
      appLog.error("play_rewind_error", { turnId, error: String(err) });
      showGlassToast("No se pudo rebobinar el viaje.", { variant: "error" });
    } finally {
      hideThinking();
      rewinding = false;
      logEl?.querySelectorAll(".play-bubble__rewind").forEach((btn) => {
        if (btn instanceof HTMLButtonElement) {
          btn.disabled = sending;
          btn.removeAttribute("aria-disabled");
        }
      });
    }
  }

  /**
   * Rehidrata el log y el pending desde openSession (resync tras fallo de transporte).
   * @param {object} data
   */
  function hydrateFromSession(data) {
    resetPlayInteractionState();
    clearOptimisticExplorerBubble();
    ctx.setSessionId(data.session_id);
    if (logEl instanceof HTMLElement) {
      logEl.innerHTML = "";
    }
    renderedTurnIds.clear();
    mountHistoryLoadControl();
    applyDialogueState(data);
    applyWaitingCopy(data);
    if (data.mentor?.display_name) {
      mentorLabel = data.mentor.display_name;
    }
    applyChapterTitle(data.chapter);
    if (data.progress_hud) syncProgressHud(data.progress_hud);
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
        insertLogNodes(buildTurnNodes(t, mentorLabel), { scrollToEnd: false });
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
  function explorerReplyShown(reply) {
    if (typeof reply.displayLabel === "string" && reply.displayLabel.trim()) {
      return reply.displayLabel.trim();
    }
    if (reply.kind === "text") return reply.text || "";
    if (reply.kind === "option") {
      return resolveExplorerBubbleText(reply.option_id || "", { explorer_reply: reply });
    }
    return "Continuar";
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

    const shown = explorerReplyShown(reply);

    appendOptimisticExplorerBubble(shown);

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

    const data = result.data;
    if (data.debug?.compose) {
      lastComposeDebug = data.debug.compose;
    }

    const synced = await openDialogueSession(ctx.session, ctx.childId, "first_run");
    if (!ctx.isCancelled() && synced.ok && synced.data) {
      hydrateFromSession(synced.data);
      if (lastComposeDebug) showComposeDebugChip(lastComposeDebug);
      scrollLogToEnd({ force: true });
      sending = false;
      if (sendBtn instanceof HTMLButtonElement) sendBtn.disabled = false;
      return;
    }

    applyDialogueState(data);
    if (data.mentor?.display_name) {
      mentorLabel = data.mentor.display_name;
    }
    applyChapterTitle(data.chapter);
    if (data.progress_hud) syncProgressHud(data.progress_hud);
    const effects = Array.isArray(data.effects) ? data.effects : [];
    if (effects.some((e) => e && (e.type === "reward_granted" || e.toast_child))) {
      baggageDirty = true;
      baggageToggleBtn?.classList.add("is-badge");
      const toast = effects.find((e) => e?.toast_child)?.toast_child;
      if (toast) showGlassToast(String(toast), { variant: "success" });
    }
    clearOptimisticExplorerBubble();

    const turns = Array.isArray(data.agent_turns) ? data.agent_turns : [];
    for (const t of turns) {
      captureWaitingHints(t);
      appendMentorTurn(t, mentorLabel);
    }
    const pending = data.pending_agent_turn || turns[turns.length - 1];
    if (pending) {
      const phase = typeof pending.meta?.phase === "string" ? pending.meta.phase : "";
      if (phase === "placement_item" || phase === "placement_feedback") {
        onboardingStep = "placement";
      } else if (phase) {
        onboardingStep = phase;
      }
      if (pending.meta?.compose_failed) {
        lastComposeDebug = pending.meta.compose_debug ?? data.debug?.compose ?? lastComposeDebug;
        showComposeDebugChip(lastComposeDebug);
      }
      renderPending(pending);
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

  if (isDebugAiClientActive()) {
    const statusRes = await fetchDebugAiStatus(ctx.session);
    if (statusRes.ok && statusRes.data?.debug_allowed) {
      setDebugAiServerAllowed(true);
      debugRewindEnabled = isDebugAiAllowed();
    }
  }

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
