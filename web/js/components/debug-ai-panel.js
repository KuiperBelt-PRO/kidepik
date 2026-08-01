/**
 * Panel modal de diagnóstico IA.
 * @module debug-ai-panel
 */

import { closeGlassModal } from "./glass-modal.js?v=2";
import {
  fetchDebugAiAttempts,
  fetchDebugAiQueues,
  fetchDebugAiResolve,
  fetchDebugAiStatus,
  postDebugAiPing,
} from "../lib/debug-ai-api.js";

/**
 * @typedef {Object} DebugAiPanelOptions
 * @property {import('@supabase/supabase-js').Session} session
 * @property {string} [childId]
 * @property {object} [composeDebug]
 * @property {string} [purpose]
 */

/**
 * @param {DebugAiPanelOptions} options
 */
export async function openDebugAiPanel(options) {
  const { session, childId, composeDebug, purpose = "placement_exam_composer" } = options;

  const statusRes = await fetchDebugAiStatus(session);
  const status = statusRes.ok ? statusRes.data : null;
  const resolveRes = await fetchDebugAiResolve(session, purpose);
  const queuesRes = await fetchDebugAiQueues(session, purpose);
  const attemptsRes = await fetchDebugAiAttempts(session, 12);

  const body = document.createElement("div");
  body.className = "debug-ai-panel";

  const statusLine = status
    ? `enabled=${status.enabled} · mock=${status.mock} · key=${status.key_present} · max=${status.max_attempts}`
    : "Estado no disponible";

  body.innerHTML = `
    <p class="debug-ai-panel__line"><strong>Estado:</strong> ${escapeHtml(statusLine)}</p>
    <p class="debug-ai-panel__line"><strong>Purpose:</strong> ${escapeHtml(purpose)}</p>
  `;

  if (composeDebug) {
    const composeEl = document.createElement("pre");
    composeEl.className = "debug-ai-panel__mono";
    composeEl.textContent = JSON.stringify(composeDebug, null, 2);
    const h = document.createElement("p");
    h.className = "debug-ai-panel__line";
    h.innerHTML = `<strong>Compose:</strong> outcome=${escapeHtml(String(composeDebug.outcome ?? "?"))}`;
    body.appendChild(h);
    body.appendChild(composeEl);
  }

  if (resolveRes.ok && resolveRes.data) {
    const resolved = resolveRes.data.resolved_models || [];
    const list = document.createElement("div");
    list.className = "debug-ai-panel__list";
    list.innerHTML = `<p class="debug-ai-panel__line"><strong>Cola resuelta (${resolved.length}, ${escapeHtml(resolveRes.data.queue_source || "")}):</strong></p>`;
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
    const count = queuesRes.data.rows.filter((r) => r.enabled).length;
    const p = document.createElement("p");
    p.className = "debug-ai-panel__line";
    p.innerHTML = `<strong>BD enabled:</strong> ${count} modelos`;
    body.appendChild(p);
  }

  if (attemptsRes.ok && Array.isArray(attemptsRes.data?.attempts)) {
    const recent = document.createElement("pre");
    recent.className = "debug-ai-panel__mono debug-ai-panel__mono--short";
    const lines = attemptsRes.data.attempts.slice(0, 8).map((a) => {
      const mark = a.ok ? "✓" : "✗";
      return `${mark} ${a.purpose} · ${a.model_id} · ${a.http_status ?? "-"} · ${a.latency_ms ?? 0}ms`;
    });
    recent.textContent = lines.join("\n") || "Sin intentos recientes";
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
    const payload = {
      status,
      purpose,
      compose: composeDebug ?? null,
      resolve: resolveRes.ok ? resolveRes.data : null,
      queues: queuesRes.ok ? queuesRes.data : null,
      attempts: attemptsRes.ok ? attemptsRes.data : null,
    };
    void navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
  });
  const pingBtn = document.createElement("button");
  pingBtn.type = "button";
  pingBtn.className = "debug-ai-panel__btn";
  pingBtn.textContent = "Ping IA";
  pingBtn.addEventListener("click", () => {
    pingBtn.disabled = true;
    void postDebugAiPing(session, childId).then((res) => {
      pingBtn.disabled = false;
      if (res.ok) {
        pingBtn.textContent = `Ping OK (${res.data?.model ?? "mock"})`;
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

/**
 * FAB pequeño «DBG» cuando debug activo en cliente.
 */
export function mountDebugAiFab(onOpen) {
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "debug-ai-fab";
  fab.textContent = "DBG";
  fab.setAttribute("aria-label", "Abrir diagnóstico IA");
  fab.addEventListener("click", () => onOpen());
  document.body.appendChild(fab);
  return () => fab.remove();
}
