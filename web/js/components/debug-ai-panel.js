/**
 * Panel modal de diagnóstico IA (Gemini / FastAPI).
 * @module debug-ai-panel
 */

import { closeGlassModal } from "./glass-modal.js?v=2";
import {
  fetchDebugAiAttempts,
  fetchDebugAiQueues,
  fetchDebugAiResolve,
  fetchDebugAiStatus,
  postDebugAiPing,
} from "../lib/debug-ai-api.js?v=244";

/**
 * @typedef {Object} DebugAiPanelOptions
 * @property {import('@supabase/supabase-js').Session} session
 * @property {string} [childId]
 * @property {object} [composeDebug]
 * @property {string} [purpose]
 */

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

/**
 * @param {DebugAiPanelOptions} options
 */
export async function openDebugAiPanel(options) {
  const { session, childId, composeDebug, purpose = "mentor_guide" } = options;
  const resolvedPurposeFromCompose =
    typeof composeDebug?.purpose === "string" ? composeDebug.purpose : null;
  const panelPurpose = resolvedPurposeFromCompose || purpose;

  const statusRes = await fetchDebugAiStatus(session);
  const status = statusRes.ok ? statusRes.data : null;
  const resolveRes = await fetchDebugAiResolve(session, panelPurpose);
  const queuesRes = await fetchDebugAiQueues(session, panelPurpose);
  const attemptsRes = await fetchDebugAiAttempts(session, 12);

  const body = document.createElement("div");
  body.className = "debug-ai-panel";

  const provider = status?.provider || resolveRes.data?.provider || "gemini";
  const statusLine = status
    ? `provider=${provider} · enabled=${status.enabled} · key=${status.key_present} · max=${status.max_attempts}`
    : "Estado no disponible";

  const resolvedPurpose =
    (resolveRes.ok && resolveRes.data?.purpose) || panelPurpose;

  body.innerHTML = `
    <p class="debug-ai-panel__line"><strong>Estado:</strong> ${escapeHtml(statusLine)}</p>
    <p class="debug-ai-panel__line"><strong>Purpose:</strong> ${escapeHtml(String(resolvedPurpose))}</p>
  `;

  if (composeDebug) {
    const composeEl = document.createElement("pre");
    composeEl.className = "debug-ai-panel__mono";
    composeEl.textContent = JSON.stringify(composeDebug, null, 2);
    const h = document.createElement("p");
    h.className = "debug-ai-panel__line";
    const issue =
      composeDebug.quality_issue != null
        ? ` · issue=${escapeHtml(String(composeDebug.quality_issue))}`
        : "";
    h.innerHTML = `<strong>Compose:</strong> outcome=${escapeHtml(String(composeDebug.outcome ?? "?"))}${issue}`;
    body.appendChild(h);
    body.appendChild(composeEl);
  }

  const payload = {
    status,
    purpose: resolvedPurpose,
    compose: composeDebug ?? null,
    resolve: resolveRes.ok ? resolveRes.data : null,
    queues: queuesRes.ok ? queuesRes.data : null,
    attempts: attemptsRes.ok ? attemptsRes.data : null,
  };
  const payloadText = JSON.stringify(payload, null, 2);

  const exportPre = document.createElement("pre");
  exportPre.className = "debug-ai-panel__mono debug-ai-panel__mono--short";
  exportPre.textContent = payloadText;
  exportPre.setAttribute("tabindex", "0");
  exportPre.setAttribute("aria-label", "JSON de diagnóstico (seleccionable)");
  const exportLabel = document.createElement("p");
  exportLabel.className = "debug-ai-panel__line";
  exportLabel.innerHTML =
    "<strong>JSON completo:</strong> (también puedes seleccionar y copiar manualmente)";
  body.appendChild(exportLabel);
  body.appendChild(exportPre);

  if (resolveRes.ok && resolveRes.data) {
    const resolved =
      resolveRes.data.resolved_models || resolveRes.data.models || [];
    const source = resolveRes.data.queue_source || provider;
    const tier = resolveRes.data.tier ? ` · tier=${resolveRes.data.tier}` : "";
    const list = document.createElement("div");
    list.className = "debug-ai-panel__list";
    list.innerHTML = `<p class="debug-ai-panel__line"><strong>Cola Gemini (${resolved.length}, ${escapeHtml(String(source))}${escapeHtml(tier)}):</strong></p>`;
    const ul = document.createElement("ol");
    ul.className = "debug-ai-panel__mono";
    resolved.forEach((id, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${id}`;
      ul.appendChild(li);
    });
    list.appendChild(ul);
    body.appendChild(list);
  }

  if (queuesRes.ok && Array.isArray(queuesRes.data?.rows)) {
    const count = queuesRes.data.rows.filter((r) => r.enabled !== false).length;
    const p = document.createElement("p");
    p.className = "debug-ai-panel__line";
    p.innerHTML = `<strong>Modelos en cola:</strong> ${count} (env Gemini, no BD OpenRouter)`;
    body.appendChild(p);
  }

  if (attemptsRes.ok && Array.isArray(attemptsRes.data?.attempts)) {
    const recent = document.createElement("pre");
    recent.className = "debug-ai-panel__mono debug-ai-panel__mono--short";
    const lines = attemptsRes.data.attempts.slice(0, 8).map((a) => {
      const mark = a.ok ? "✓" : "✗";
      const prov = a.provider ? ` · ${a.provider}` : "";
      return `${mark} ${a.purpose} · ${a.model_id}${prov} · ${a.http_status ?? "-"} · ${a.latency_ms ?? 0}ms`;
    });
    recent.textContent = lines.join("\n") || "Sin intentos recientes (logs Gemini vacíos)";
    const h = document.createElement("p");
    h.className = "debug-ai-panel__line";
    h.innerHTML = "<strong>Últimos intentos:</strong>";
    body.appendChild(h);
    body.appendChild(recent);
  }

  const actions = document.createElement("div");
  actions.className = "debug-ai-panel__actions";
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "debug-ai-panel__btn";
  copyBtn.textContent = "Copiar JSON";
  copyBtn.addEventListener("click", () => {
    void copyTextToClipboard(payloadText).then((ok) => {
      copyBtn.textContent = ok ? "¡Copiado!" : "Selecciona el JSON de arriba";
      window.setTimeout(() => {
        copyBtn.textContent = "Copiar JSON";
      }, 2200);
    });
  });
  const pingBtn = document.createElement("button");
  pingBtn.type = "button";
  pingBtn.className = "debug-ai-panel__btn";
  pingBtn.textContent = "Ping IA";
  pingBtn.addEventListener("click", () => {
    pingBtn.disabled = true;
    void postDebugAiPing(session, childId).then((res) => {
      pingBtn.disabled = false;
      if (res.ok && res.data?.ok) {
        pingBtn.textContent = `Ping OK (${res.data?.model ?? "gemini"})`;
      } else {
        pingBtn.textContent = "Ping falló";
      }
    });
  });
  actions.append(copyBtn, pingBtn);
  body.appendChild(actions);

  const root = document.createElement("div");
  root.className = "glass-modal";
  const scrim = document.createElement("div");
  scrim.className = "glass-modal__scrim";
  const dialog = document.createElement("div");
  dialog.className = "glass-modal__dialog glass-modal__dialog--lg";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  const title = document.createElement("h2");
  title.className = "glass-modal__title";
  title.textContent = "Diagnóstico IA";
  const modalBody = document.createElement("div");
  modalBody.className = "glass-modal__body";
  modalBody.appendChild(body);
  const footer = document.createElement("div");
  footer.className = "glass-modal__actions";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "debug-ai-panel__btn";
  closeBtn.textContent = "Cerrar";
  closeBtn.addEventListener("click", () => {
    root.remove();
    closeGlassModal();
  });
  footer.appendChild(closeBtn);
  dialog.append(title, modalBody, footer);
  root.append(scrim, dialog);
  scrim.addEventListener("click", () => {
    root.remove();
    closeGlassModal();
  });
  document.body.appendChild(root);
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const DEBUG_BADGE_CLASS = "debug-ai-account-badge";

/**
 * Badge «<>» superpuesto al FAB de cuenta (solo tutor / debug activo).
 * @param {HTMLElement} hostEl — `.shell-fab-wrap--account`
 * @param {() => void} onOpen
 * @returns {() => void}
 */
export function mountDebugAiAccountBadge(hostEl, onOpen) {
  if (!(hostEl instanceof HTMLElement)) return () => {};
  unmountDebugAiAccountBadge(hostEl);

  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = DEBUG_BADGE_CLASS;
  badge.innerHTML =
    '<span class="debug-ai-account-badge__glyph" aria-hidden="true">&lt;&gt;</span>';
  badge.setAttribute("aria-label", "Abrir diagnóstico IA");
  badge.addEventListener("click", (ev) => {
    ev.stopPropagation();
    onOpen();
  });
  hostEl.appendChild(badge);
  return () => unmountDebugAiAccountBadge(hostEl);
}

/**
 * @param {HTMLElement | null | undefined} hostEl
 */
export function unmountDebugAiAccountBadge(hostEl) {
  if (!(hostEl instanceof HTMLElement)) return;
  hostEl.querySelector(`.${DEBUG_BADGE_CLASS}`)?.remove();
}
