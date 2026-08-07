/**
 * Renderizado Markdown seguro (subconjunto para textos legales y diálogo).
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
 * Limpia markdown de diálogo (asteriscos escapados por el LLM, envoltorios duplicados).
 * @param {string} text
 * @returns {string}
 */
export function normalizeDialogueMarkdownInput(text) {
  let out = String(text || "").replace(/\\\*/g, "*");
  // ****palabra**** o **\*\*palabra\*\*** → **palabra**
  out = out.replace(/(\*{2,})([^*]+?)\1/g, "**$2**");
  return out;
}

/**
 * @param {string} inline
 * @returns {string}
 */
function renderInline(inline) {
  let out = escapeHtml(inline);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const isExternal = /^https?:\/\//i.test(href);
    const safeHref = isExternal || /^(\/|#)/.test(href) ? href : "#";
    const target = isExternal ? ' target="_blank"' : "";
    return `<a href="${escapeHtml(safeHref)}" rel="noopener noreferrer"${target}>${escapeHtml(label)}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isHorizontalRule(line) {
  return /^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.includes("|");
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function parseTableCells(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

/**
 * @param {string[]} cells
 * @returns {boolean}
 */
function isTableSeparatorRow(cells) {
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/**
 * @param {string[]} lines
 * @param {number} start
 * @returns {{ html: string; nextIndex: number } | null}
 */
function tryRenderTable(lines, start) {
  if (!isTableRow(lines[start])) return null;

  /** @type {string[][]} */
  const rows = [];
  let index = start;
  while (index < lines.length && isTableRow(lines[index])) {
    rows.push(parseTableCells(lines[index]));
    index += 1;
  }

  if (rows.length < 2 || !isTableSeparatorRow(rows[1])) {
    return null;
  }

  const header = rows[0];
  const bodyRows = rows.slice(2);
  const colCount = header.length;

  const normalizeRow = (cells) => {
    const padded = cells.slice(0, colCount);
    while (padded.length < colCount) padded.push("");
    return padded;
  };

  const thead = `<thead><tr>${normalizeRow(header)
    .map((cell) => `<th>${renderInline(cell)}</th>`)
    .join("")}</tr></thead>`;
  const tbody = bodyRows.length
    ? `<tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${normalizeRow(row)
              .map((cell) => `<td>${renderInline(cell)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`
    : "";

  return {
    html: `<table class="legal-md-table">${thead}${tbody}</table>`,
    nextIndex: index,
  };
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

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      continue;
    }

    if (isHorizontalRule(trimmed)) {
      flushList();
      html.push("<hr>");
      continue;
    }

    const table = tryRenderTable(lines, i);
    if (table) {
      flushList();
      html.push(table.html);
      i = table.nextIndex - 1;
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

/**
 * Markdown seguro para burbujas de diálogo (mentor / IA).
 * @param {string} text
 * @returns {string}
 */
export function renderDialogueMarkdown(text) {
  return renderMarkdown(normalizeDialogueMarkdownInput(text));
}
