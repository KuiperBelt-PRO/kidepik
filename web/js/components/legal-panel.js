/**
 * Panel de documento legal dentro del marco glass de sección.
 * @module legal-panel
 */

import { config } from "../config.js";
import { renderMarkdown } from "../lib/markdown.js";
import { renderGlassSkeletonHtml } from "./glass-controls.js?v=221";

const SLUG_API = {
  terminos: "terminos",
  privacidad: "privacidad",
};

const DEFAULT_TITLES = {
  terminos: "Términos",
  privacidad: "Privacidad",
};

const LEGAL_FETCH_TIMEOUT_MS = 5_000;
const LEGAL_FETCH_BASE_BACKOFF_MS = 400;
const LEGAL_FETCH_MAX_BACKOFF_MS = 8_000;

/**
 * @param {string} routeSlug
 * @returns {string}
 */
export function defaultLegalTitle(routeSlug) {
  return DEFAULT_TITLES[routeSlug] ?? "Legal";
}

/**
 * @param {string} routeSlug
 * @returns {string | null}
 */
function apiSlugForRoute(routeSlug) {
  return SLUG_API[routeSlug] ?? null;
}

/**
 * @param {AbortSignal | undefined} signal
 * @param {number} attempt
 * @returns {Promise<void>}
 */
function waitLegalFetchBackoff(signal, attempt) {
  const delay = Math.min(LEGAL_FETCH_MAX_BACKOFF_MS, LEGAL_FETCH_BASE_BACKOFF_MS * (2 ** attempt));
  return new Promise((resolve) => {
    const wait = setTimeout(resolve, delay);
    signal?.addEventListener("abort", () => {
      clearTimeout(wait);
      resolve(undefined);
    }, { once: true });
  });
}

/**
 * @param {string} routeSlug
 * @param {{ signal?: AbortSignal; retries?: number }} [options]
 * @returns {Promise<{ title: string; body_markdown: string } | null>}
 */
export async function fetchLegalDoc(routeSlug, options = {}) {
  const apiSlug = apiSlugForRoute(routeSlug);
  if (!apiSlug) return null;

  const { signal, retries = 3 } = options;
  const url = `${config.apiUrl}/legal/${apiSlug}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LEGAL_FETCH_TIMEOUT_MS);
    const onParentAbort = () => controller.abort();
    signal?.addEventListener("abort", onParentAbort);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.title || !data?.body_markdown) continue;
      return data;
    } catch {
      if (signal?.aborted) return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onParentAbort);
    }

    if (attempt < retries - 1) {
      await waitLegalFetchBackoff(signal, attempt);
    }
  }

  return null;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   routeSlug: string;
 *   onLoaded?: (doc: { title: string; body_markdown: string }) => void;
 * }} options
 * @returns {{ destroy: () => void }}
 */
export function mountLegalPanel(container, { routeSlug, onLoaded }) {
  const root = document.createElement("div");
  root.className = "legal-panel";

  const article = document.createElement("article");
  article.className = "legal-body is-loading";
  article.setAttribute("aria-busy", "true");
  article.innerHTML = renderGlassSkeletonHtml({ preset: "document", ariaLabel: "Cargando documento" });

  root.appendChild(article);
  container.appendChild(root);

  let destroyed = false;
  let loadSeq = 0;
  const loadAbort = new AbortController();

  function showLoadError() {
    article.classList.remove("is-loading");
    article.removeAttribute("aria-busy");
    article.innerHTML = `
      <p class="legal-body__error">No hemos podido cargar este documento.</p>
      <p class="legal-body__error-actions">
        <button type="button" class="glass-btn legal-body__retry">Reintentar</button>
      </p>
    `;
    article.querySelector(".legal-body__retry")?.addEventListener("click", () => {
      void loadDocument();
    });
  }

  async function loadDocument() {
    const seq = ++loadSeq;
    article.classList.add("is-loading");
    article.setAttribute("aria-busy", "true");
    article.innerHTML = renderGlassSkeletonHtml({ preset: "document", ariaLabel: "Cargando documento" });
    const doc = await fetchLegalDoc(routeSlug, { signal: loadAbort.signal });
    if (destroyed || seq !== loadSeq) return;
    if (!doc) {
      article.classList.remove("is-loading");
      article.removeAttribute("aria-busy");
      showLoadError();
      return;
    }
    article.classList.remove("is-loading");
    article.removeAttribute("aria-busy");
    article.innerHTML = renderMarkdown(doc.body_markdown);
    onLoaded?.(doc);
  }

  void loadDocument();

  return {
    destroy() {
      destroyed = true;
      loadSeq += 1;
      loadAbort.abort();
      root.remove();
    },
  };
}
