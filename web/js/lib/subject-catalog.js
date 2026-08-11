/**
 * Catálogo de materias (SPEC_APP_SUBJECT_CATALOG) — espejo UI del SubjectCatalog PHP.
 * @module subject-catalog
 */

/** @typedef {{ id: string, label: string, family: string }} SubjectMeta */

/** @type {SubjectMeta[]} */
export const SUBJECT_CATALOG = [
  { id: "math", label: "Matemáticas", family: "fundamentals" },
  { id: "language", label: "Lengua y gramática", family: "fundamentals" },
  { id: "reading", label: "Comprensión lectora", family: "fundamentals" },
  { id: "logic", label: "Lógica y razonamiento", family: "fundamentals" },
  { id: "science", label: "Ciencias naturales", family: "sciences" },
  { id: "culture", label: "Cultura general", family: "humanities" },
  { id: "geography", label: "Geografía", family: "humanities" },
  { id: "history", label: "Historia", family: "humanities" },
  { id: "mythology", label: "Mitología", family: "humanities" },
  { id: "ethics", label: "Ética y moral", family: "society" },
  { id: "communication", label: "Comunicación", family: "society" },
  { id: "politics", label: "Política y ciudadanía", family: "society" },
  { id: "arts", label: "Arte (plástica, música, cine…)", family: "expression" },
  { id: "sports", label: "Deporte y salud", family: "expression" },
  { id: "finance", label: "Finanzas y economía cotidiana", family: "life" },
];

/** @type {Record<string, string>} */
export const SUBJECT_FAMILY_LABELS = {
  fundamentals: "Fundamentales",
  sciences: "Ciencias",
  humanities: "Humanidades",
  society: "Sociedad",
  expression: "Expresión",
  life: "Vida práctica",
};

/** Materias base band_child (default hogar). */
export const DEFAULT_ACTIVE_SUBJECTS = [
  "math",
  "language",
  "reading",
  "logic",
  "science",
  "arts",
  "communication",
  "sports",
];

/**
 * @param {unknown} level
 * @returns {string}
 */
export function formatLevelLabel(level) {
  if (level == null || level === "") return "";
  const raw = String(level);
  const m = raw.match(/^L(\d+)$/i);
  return m ? `Nivel ${m[1]}` : raw;
}

/**
 * @param {SubjectMeta[]} [catalog]
 * @returns {Record<string, SubjectMeta[]>}
 */
export function groupSubjectsByFamily(catalog = SUBJECT_CATALOG) {
  /** @type {Record<string, SubjectMeta[]>} */
  const out = {};
  for (const s of catalog) {
    if (!out[s.family]) out[s.family] = [];
    out[s.family].push(s);
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeActiveSubjects(raw) {
  const ids = new Set(SUBJECT_CATALOG.map((s) => s.id));
  if (!Array.isArray(raw)) return [...DEFAULT_ACTIVE_SUBJECTS];
  /** @type {string[]} */
  const out = [];
  for (const id of raw) {
    if (typeof id === "string" && ids.has(id) && !out.includes(id)) out.push(id);
  }
  return out.length ? out : [...DEFAULT_ACTIVE_SUBJECTS];
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * @param {SubjectMeta[]} catalog
 * @param {string[]} active
 * @param {{ progressSubjects?: Array<{ id?: string, subject_id?: string, label?: string, rank_label?: string, rank_next_label?: string, level_progress?: { current?: string, next?: string, percent_to_next?: number } }> }} [opts]
 * @returns {string}
 */
export function renderSubjectsChecklistHtml(catalog, active, opts = {}) {
  const activeSet = new Set(active);
  /** @type {Map<string, { current?: string, next?: string, percent?: number, rank?: string, rankNext?: string }>} */
  const progressById = new Map();
  for (const row of opts.progressSubjects || []) {
    const id = String(row.id || row.subject_id || "");
    if (!id) continue;
    const lp = row.level_progress || {};
    progressById.set(id, {
      current: lp.current,
      next: lp.next,
      percent: Number(lp.percent_to_next) || 0,
      rank: row.rank_label,
      rankNext: row.rank_next_label,
    });
  }
  const groups = groupSubjectsByFamily(catalog);
  const order = Object.keys(SUBJECT_FAMILY_LABELS);
  let html = "";
  for (const fam of order) {
    const items = groups[fam];
    if (!items?.length) continue;
    html += `<fieldset class="crew-panel__subjects-family"><legend class="crew-panel__subjects-legend">${SUBJECT_FAMILY_LABELS[fam]}</legend>`;
    html += `<div class="crew-panel__subjects-grid">`;
    for (const s of items) {
      const on = activeSet.has(s.id);
      const prog = progressById.get(s.id);
      const percent = Math.max(0, Math.min(100, prog?.percent ?? 0));
      const curRank = prog?.rank || formatLevelLabel(prog?.current);
      const nextRank = prog?.rankNext || formatLevelLabel(prog?.next);
      let levelLine = "Sin nivel aún";
      if (curRank && nextRank) levelLine = `${curRank} → ${nextRank}`;
      else if (curRank) levelLine = curRank;
      html += `<div class="crew-subject-card${on ? " is-on" : ""}">
        <div class="crew-subject-card__head">
          <span class="crew-subject-card__label">${escapeHtml(s.label)}</span>
          <label class="glass-switch">
            <input type="checkbox" role="switch" data-subject="${escapeHtml(s.id)}" ${on ? "checked" : ""} aria-label="Activar ${escapeHtml(s.label)}" />
            <span class="glass-switch__track" aria-hidden="true"><span class="glass-switch__knob"></span></span>
          </label>
        </div>
        <p class="crew-subject-card__level">${escapeHtml(levelLine)}</p>
        <div class="crew-progress__bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="crew-progress__bar-fill" style="width:${percent}%"></div>
        </div>
      </div>`;
    }
    html += `</div></fieldset>`;
  }
  return html;
}
