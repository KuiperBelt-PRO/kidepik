/**
 * Renderizado Markdown seguro (subconjunto para textos legales).
 * @module markdown
 */

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} inline
 * @returns {string}
 */
function renderInline(inline) {
  let out = escapeHtml(inline);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safeHref = /^https?:\/\//i.test(href) ? href : "#";
    return `<a href="${escapeHtml(safeHref)}" rel="noopener noreferrer" target="_blank">${escapeHtml(label)}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

/**
 * @param {string} markdown
 * @returns {string}
 */
export function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  /** @type {string[]} */
  const html = [];
  /** @type {string[]} */
  let listItems = [];
  let inList = false;

  const flushList = () => {
    if (!inList || listItems.length === 0) return;
    html.push(`<ul>${listItems.map((li) => `<li>${renderInline(li)}</li>`).join("")}</ul>`);
    listItems = [];
    inList = false;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      inList = true;
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    flushList();
    html.push(`<p>${renderInline(trimmed)}</p>`);
  }

  flushList();
  return html.join("\n");
}
