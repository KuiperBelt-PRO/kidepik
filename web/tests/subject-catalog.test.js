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
  SUBJECT_CATALOG,
} from "../js/lib/subject-catalog.js";

test("catalog has 14 subjects including reading separate from language", () => {
  assert.equal(SUBJECT_CATALOG.length, 14);
  assert.ok(SUBJECT_CATALOG.some((s) => s.id === "reading"));
  assert.ok(SUBJECT_CATALOG.some((s) => s.id === "language"));
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
