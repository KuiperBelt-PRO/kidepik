/**
 * Catálogo de materias (SPEC_APP_SUBJECT_CATALOG) — espejo UI del SubjectCatalog PHP.
 * @module subject-catalog
 */

/** Máximo de caracteres en notas por materia (`learning.subject_notes`). */
export const SUBJECT_NOTE_MAX_LEN = 600;

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

/** Placeholders de notas tutor por materia (información adicional neutral). */
export const SUBJECT_NOTE_PLACEHOLDERS = {
  math: "p. ej. Domina tablas de multiplicar; retos más exigentes",
  language: "p. ej. Ortografía con errores frecuentes; conjugación irregular",
  reading: "p. ej. Lee con fluidez; prefiere textos más largos",
  logic: "p. ej. Buen nivel en acertijos; secuencias complejas",
  science: "p. ej. Curiosidad con experimentos; ya conoce el ciclo del agua",
  culture: "p. ej. Vocabulario amplio; interés en datos curiosos",
  geography: "p. ej. Sabe capitales; mapas y coordenadas",
  history: "p. ej. Interés en Roma; cronologías sencillas",
  mythology: "p. ej. Interés en mitos griegos; nombres de dioses",
  ethics: "p. ej. Reflexión sobre dilemas del día a día",
  communication: "p. ej. Oralidad clara; debates cortos",
  politics: "p. ej. Preguntas sobre elecciones; ciudadanía básica",
  arts: "p. ej. Dibuja a menudo; interés en música",
  sports: "p. ej. Practica natación; hábitos de salud",
  finance: "p. ej. Entiende monedas; trueque y presupuesto",
};

export const GENERAL_NOTE_PLACEHOLDER =
  "p. ej. 8 años pero muy adelantado en general; prefiere retos con historia";

/**
 * @param {string} subjectId
 * @returns {string}
 */
export function subjectNotePlaceholder(subjectId) {
  const id = String(subjectId || "").trim();
  return SUBJECT_NOTE_PLACEHOLDERS[id] || "Nota para el tutor sobre esta materia";
}

/**
 * @param {unknown} learning
 * @returns {string}
 */
export function generalNoteFromLearning(learning) {
  if (!learning || typeof learning !== "object") return "";
  const raw = /** @type {Record<string, unknown>} */ (learning);
  if (typeof raw.general_note === "string" && raw.general_note.trim()) {
    return raw.general_note.trim();
  }
  const legacy = raw.weak_spots;
  if (!Array.isArray(legacy)) return "";
  const parts = [];
  for (const item of legacy) {
    if (typeof item === "string" && item.trim()) {
      parts.push(item.trim());
    } else if (item && typeof item === "object" && !item.subject_id && item.note) {
      parts.push(String(item.note).trim());
    }
  }
  return parts.join("; ");
}

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
 * @param {Array<{ id?: string, subject_id?: string, label?: string, rank_label?: string, rank_next_label?: string, level_progress?: { current?: string, next?: string, percent_to_next?: number } }>} [progressSubjects]
 */
function progressSubjectsById(progressSubjects) {
  /** @type {Map<string, { percent: number, rank?: string, rankNext?: string }>} */
  const map = new Map();
  for (const row of progressSubjects || []) {
    const id = String(row.id || row.subject_id || "");
    if (!id) continue;
    const lp = row.level_progress || {};
    map.set(id, {
      percent: Number(lp.percent_to_next) || 0,
      rank: row.rank_label,
      rankNext: row.rank_next_label,
    });
  }
  return map;
}

/**
 * @param {boolean} on
 * @param {{ percent?: number, rank?: string, rankNext?: string } | undefined} prog
 */
function computeSubjectProgressUi(on, prog) {
  const percent = Math.max(0, Math.min(100, prog?.percent ?? 0));
  const curRank = prog?.rank || "";
  const nextRank = prog?.rankNext || "";
  const baseLabel = formatLevelLabel("L1");
  let levelLine = on ? baseLabel : "No activada";
  if (!on && curRank) {
    levelLine = `Pausada · ${curRank}${nextRank ? ` → ${nextRank}` : ""}`;
  } else if (on && curRank && nextRank) levelLine = `${curRank} → ${nextRank}`;
  else if (curRank) levelLine = curRank;
  return {
    percent,
    curRank,
    nextRank,
    levelLine,
    preserved: Boolean(!on && curRank),
  };
}

/**
 * Barras de progreso por materia (sección «Tu explorador en el viaje»): catálogo completo.
 * @param {SubjectMeta[]} catalog
 * @param {string[]} active
 * @param {Array<{ id?: string, subject_id?: string, rank_label?: string, rank_next_label?: string, level_progress?: { percent_to_next?: number } }>} [progressSubjects]
 * @param {{ baseProgress?: { rank?: string, rankNext?: string, percent?: number }, placementCompleted?: boolean }} [opts]
 * @returns {string}
 */
export function renderSubjectProgressBarsHtml(catalog, active, progressSubjects, opts = {}) {
  const activeSet = new Set(active);
  const progressById = progressSubjectsById(progressSubjects);
  const baseProgress = opts.baseProgress;
  const placementCompleted = Boolean(opts.placementCompleted);
  const groups = groupSubjectsByFamily(catalog);
  const order = Object.keys(SUBJECT_FAMILY_LABELS);
  let html = "";
  for (const fam of order) {
    const items = groups[fam];
    if (!items?.length) continue;
    html += `<div class="crew-progress__subject-family"><p class="crew-progress__subject-family-label">${escapeHtml(SUBJECT_FAMILY_LABELS[fam])}</p>`;
    for (const s of items) {
      const on = activeSet.has(s.id);
      let prog = progressById.get(s.id);
      if (!prog && placementCompleted && baseProgress) {
        prog = baseProgress;
      }
      const { percent, curRank, nextRank, preserved } = computeSubjectProgressUi(on, prog);
      const baseLabel = formatLevelLabel("L1");
      let leftRank;
      if (on) leftRank = curRank || baseLabel;
      else if (curRank) leftRank = `Pausada · ${curRank}`;
      else leftRank = "No activa";
      const rowClass = [
        "crew-progress__row",
        "crew-progress__row--subject",
        !on && "crew-progress__row--off",
        preserved && "has-preserved-progress",
      ]
        .filter(Boolean)
        .join(" ");
      const right = nextRank
        ? `<span class="crew-progress__rank-next">${escapeHtml(nextRank)}</span>`
        : `<span class="crew-progress__rank-next" aria-hidden="true"></span>`;
      html += `<div class="${rowClass}">
        <div class="crew-progress__subject-label">${escapeHtml(s.label)}</div>
        <div class="crew-progress__track">
          <span class="crew-progress__rank-current">${escapeHtml(leftRank)}</span>
          <div class="crew-progress__bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(s.label)}: ${escapeHtml(leftRank)}${nextRank ? ` hacia ${escapeHtml(nextRank)}` : ""}">
            <div class="crew-progress__bar-fill" style="width:${percent}%"></div>
          </div>
          ${right}
        </div>
      </div>`;
    }
    html += `</div>`;
  }
  return html;
}

/**
 * @param {unknown} learning
 * @returns {Map<string, string>}
 */
export function subjectNotesById(learning) {
  /** @type {Map<string, string>} */
  const out = new Map();
  if (!learning || typeof learning !== "object") return out;
  const raw = /** @type {Record<string, unknown>} */ (learning);
  const notes = raw.subject_notes;
  if (Array.isArray(notes)) {
    for (const item of notes) {
      if (!item || typeof item !== "object") continue;
      const sid = String(item.subject_id || "").trim();
      const note = String(item.note || "").trim();
      if (sid && note) out.set(sid, note);
    }
  }
  const legacy = raw.weak_spots;
  if (Array.isArray(legacy)) {
    for (const item of legacy) {
      if (!item || typeof item !== "object") continue;
      const sid = String(item.subject_id || "").trim();
      const note = String(item.note || "").trim();
      if (sid && note && !out.has(sid)) out.set(sid, note);
    }
  }
  return out;
}

/**
 * @param {unknown} learning
 * @returns {Set<string>}
 */
export function subjectPrioritiesFromLearning(learning) {
  /** @type {Set<string>} */
  const out = new Set();
  if (!learning || typeof learning !== "object") return out;
  const raw = /** @type {Record<string, unknown>} */ (learning).subject_priorities;
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    const sid = String(item || "").trim();
    if (sid) out.add(sid);
  }
  return out;
}

/**
 * @param {SubjectMeta[]} catalog
 * @param {string[]} active
 * @param {{ progressSubjects?: Array<{ id?: string, subject_id?: string, label?: string, rank_label?: string, rank_next_label?: string, level_progress?: { current?: string, next?: string, percent_to_next?: number } }>, subjectNotes?: Map<string, string>, subjectPriorities?: Set<string> }} [opts]
 * @returns {string}
 */
export function renderSubjectsChecklistHtml(catalog, active, opts = {}) {
  const activeSet = new Set(active);
  const notesById = opts.subjectNotes || new Map();
  const priorities = opts.subjectPriorities || new Set();
  const progressById = progressSubjectsById(opts.progressSubjects);
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
      const { percent, levelLine, preserved } = computeSubjectProgressUi(on, prog);
      const noteText = notesById.get(s.id) || "";
      const hasNote = Boolean(noteText);
      const prioritized = priorities.has(s.id);
      const panelId = `crew-subject-note-${escapeHtml(s.id)}`;
      const notePlaceholder = subjectNotePlaceholder(s.id);
      html += `<div class="crew-subject-card${on ? " is-on" : " is-off"}${hasNote ? " has-note" : ""}${prioritized ? " is-priority" : ""}${preserved ? " has-preserved-progress" : ""}" data-subject-card="${escapeHtml(s.id)}">
        <div class="crew-subject-card__head">
          <span class="crew-subject-card__label">${escapeHtml(s.label)}</span>
          <div class="crew-subject-card__actions">
            <button
              type="button"
              class="crew-subject-card__notes-toggle"
              data-subject-notes-toggle="${escapeHtml(s.id)}"
              aria-expanded="false"
              aria-controls="${panelId}"
              aria-label="Información adicional de ${escapeHtml(s.label)}"
            >
              <span class="crew-subject-card__notes-chevron" aria-hidden="true"></span>
            </button>
            <label class="glass-switch">
              <input type="checkbox" role="switch" data-subject="${escapeHtml(s.id)}" ${on ? "checked" : ""} aria-label="Activar ${escapeHtml(s.label)}" />
              <span class="glass-switch__track" aria-hidden="true"><span class="glass-switch__knob"></span></span>
            </label>
          </div>
        </div>
        <p class="crew-subject-card__level">${escapeHtml(levelLine)}</p>
        <div class="crew-progress__bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="crew-progress__bar-fill" style="width:${percent}%"></div>
        </div>
        <div class="crew-subject-card__notes-panel" id="${panelId}" data-subject-notes-panel="${escapeHtml(s.id)}" hidden>
          <textarea
            class="crew-panel__input crew-subject-card__notes-input"
            data-subject-note="${escapeHtml(s.id)}"
            rows="3"
            maxlength="${SUBJECT_NOTE_MAX_LEN}"
            placeholder="${escapeHtml(notePlaceholder)}"
            aria-label="Información adicional de ${escapeHtml(s.label)}"
          >${escapeHtml(noteText)}</textarea>
          <label class="crew-subject-card__priority">
            <input type="checkbox" data-subject-priority="${escapeHtml(s.id)}" ${prioritized ? "checked" : ""} />
            <span>Priorizar en caminos</span>
          </label>
          <p class="crew-panel__helper crew-subject-card__notes-helper">Orienta el examen y los próximos caminos de práctica.</p>
        </div>
      </div>`;
    }
    html += `</div></fieldset>`;
  }
  return html;
}

/**
 * Grid de materias solo lectura (tripulante): todas las del catálogo, activas e inactivas.
 * @param {SubjectMeta[]} catalog
 * @param {string[]} active
 * @param {{ progressSubjects?: Array<{ id?: string, subject_id?: string, label?: string, rank_label?: string, rank_next_label?: string, level_progress?: { current?: string, next?: string, percent_to_next?: number } }> }} [opts]
 * @returns {string}
 */
export function renderSubjectsGridReadOnly(catalog, active, opts = {}) {
  const activeSet = new Set(active);
  const progressById = progressSubjectsById(opts.progressSubjects);
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
      const { percent, levelLine, preserved } = computeSubjectProgressUi(on, prog);
      const stateClass = on ? "is-on" : "is-off";
      const badge = on
        ? `<span class="crew-subject-card__state crew-subject-card__state--on">Activa</span>`
        : `<span class="crew-subject-card__state crew-subject-card__state--off">No activa</span>`;
      html += `<div class="crew-subject-card crew-subject-card--readonly ${stateClass}${preserved ? " has-preserved-progress" : ""}" data-subject-card="${escapeHtml(s.id)}">
        <div class="crew-subject-card__head">
          <span class="crew-subject-card__label">${escapeHtml(s.label)}</span>
          ${badge}
        </div>
        <p class="crew-subject-card__level">${escapeHtml(levelLine)}</p>
        <div class="crew-progress__bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso en ${escapeHtml(s.label)}">
          <div class="crew-progress__bar-fill" style="width:${percent}%"></div>
        </div>
      </div>`;
    }
    html += `</div></fieldset>`;
  }
  return html;
}
