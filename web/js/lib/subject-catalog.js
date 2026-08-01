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
 * @param {SubjectMeta[]} catalog
 * @param {string[]} active
 * @returns {string}
 */
export function renderSubjectsChecklistHtml(catalog, active) {
  const activeSet = new Set(active);
  const groups = groupSubjectsByFamily(catalog);
  const order = Object.keys(SUBJECT_FAMILY_LABELS);
  let html = "";
  for (const fam of order) {
    const items = groups[fam];
    if (!items?.length) continue;
    html += `<fieldset class="crew-panel__subjects-family"><legend class="crew-panel__subjects-legend">${SUBJECT_FAMILY_LABELS[fam]}</legend>`;
    for (const s of items) {
      const checked = activeSet.has(s.id) ? "checked" : "";
      html += `<label class="crew-panel__check"><input type="checkbox" data-subject="${s.id}" ${checked}/> ${s.label}</label>`;
    }
    html += `</fieldset>`;
  }
  return html;
}
