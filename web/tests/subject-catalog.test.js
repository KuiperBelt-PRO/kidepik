/**
 * @module subject-catalog.test
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ACTIVE_SUBJECTS,
  groupSubjectsByFamily,
  normalizeActiveSubjects,
  renderSubjectsChecklistHtml,
  renderSubjectProgressBarsHtml,
  subjectPrioritiesFromLearning,
  SUBJECT_CATALOG,
} from "../js/lib/subject-catalog.js";

test("catalog has 15 subjects including history and reading separate from language", () => {
  assert.equal(SUBJECT_CATALOG.length, 15);
  assert.ok(SUBJECT_CATALOG.some((s) => s.id === "reading"));
  assert.ok(SUBJECT_CATALOG.some((s) => s.id === "language"));
  assert.ok(SUBJECT_CATALOG.some((s) => s.id === "history"));
  assert.ok(SUBJECT_CATALOG.some((s) => s.id === "mythology"));
  assert.ok(SUBJECT_CATALOG.some((s) => s.id === "finance"));
});

test("normalize filters invalid and requires fallback", () => {
  assert.deepEqual(normalizeActiveSubjects(["math", "bogus", "math"]), ["math"]);
  assert.deepEqual(normalizeActiveSubjects([]), DEFAULT_ACTIVE_SUBJECTS);
});

test("groupSubjectsByFamily and checklist html", () => {
  const groups = groupSubjectsByFamily();
  assert.ok(groups.fundamentals.some((s) => s.id === "reading"));
  const html = renderSubjectsChecklistHtml(SUBJECT_CATALOG, ["math", "ethics"]);
  assert.match(html, /data-subject="math"/);
  assert.match(html, /checked/);
  assert.match(html, /Fundamentales/);
  assert.match(html, /Ética/);
});

test("subject priorities checkbox in checklist", () => {
  const priorities = subjectPrioritiesFromLearning({
    subject_priorities: ["math"],
  });
  assert.ok(priorities.has("math"));
  const html = renderSubjectsChecklistHtml(SUBJECT_CATALOG, ["math"], {
    subjectPriorities: priorities,
  });
  assert.match(html, /data-subject-priority="math"/);
  assert.match(html, /Priorizar en caminos/);
  assert.match(html, /is-priority/);
});

test("progress bars include full catalog with active and inactive subjects", () => {
  const html = renderSubjectProgressBarsHtml(SUBJECT_CATALOG, ["math", "language"], [
    {
      subject_id: "math",
      rank_label: "Chispa del reino",
      rank_next_label: "Aprendiz de los reinos",
      level_progress: { percent_to_next: 42 },
    },
    {
      subject_id: "logic",
      rank_label: "Adepto del artefacto",
      rank_next_label: "Guardián del saber",
      level_progress: { percent_to_next: 70 },
    },
  ], {
    placementCompleted: true,
    baseProgress: { rank: "Chispa del reino", rankNext: "Aprendiz de los reinos", percent: 10 },
  });
  assert.equal((html.match(/crew-progress__row--subject/g) || []).length, SUBJECT_CATALOG.length);
  assert.match(html, /Matemáticas/);
  assert.match(html, /Finanzas/);
  assert.match(html, /crew-progress__row--off/);
  assert.match(html, /Pausada · Adepto del artefacto/);
  assert.match(html, /has-preserved-progress/);
  assert.match(html, /Chispa del reino/);
  assert.doesNotMatch(html, /Sin nivel/);
});
