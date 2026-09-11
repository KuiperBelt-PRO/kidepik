/**
 * @module play-thinking-kind.test
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePlayThinkingKind,
  resolveRewindThinkingKindForPhase,
  triggersPathPackCompose,
} from "../js/lib/play-thinking-kind.js";

test("triggersPathPackCompose after path completion", () => {
  assert.equal(triggersPathPackCompose("adventure_ready", { path_completed: true }), true);
});

test("triggersPathPackCompose on last placement feedback", () => {
  assert.equal(triggersPathPackCompose("placement_feedback", { next_index: 5, total: 5 }), true);
  assert.equal(triggersPathPackCompose("placement_feedback", { next_index: 3, total: 5 }), false);
});

test("triggersPathPackCompose on last placement answer", () => {
  assert.equal(triggersPathPackCompose("placement_item", { index: 4, total: 5 }), true);
  assert.equal(triggersPathPackCompose("placement_item", { index: 2, total: 5 }), false);
});

test("resolvePlayThinkingKind uses adventure_compose after path completion", () => {
  assert.equal(
    resolvePlayThinkingKind("adventure_ready", { path_completed: true }, { kind: "continue" }, "complete"),
    "adventure_compose",
  );
});

test("resolvePlayThinkingKind keeps evaluating_answer for mid placement", () => {
  assert.equal(
    resolvePlayThinkingKind("placement_item", { index: 1, total: 5 }, { kind: "option" }, "placement"),
    "evaluating_answer",
  );
});

test("resolvePlayThinkingKind composes paths after final placement feedback", () => {
  assert.equal(
    resolvePlayThinkingKind(
      "placement_feedback",
      { next_index: 5, total: 5 },
      { kind: "continue" },
      "placement",
    ),
    "adventure_compose",
  );
});

test("resolvePlayThinkingKind uses dictation_compose on path dictation card", () => {
  assert.equal(
    resolvePlayThinkingKind("choose_path", {}, { kind: "option", option_id: "start_path_dictation" }, ""),
    "dictation_compose",
  );
});

test("resolvePlayThinkingKind uses dictation_grade on photo", () => {
  assert.equal(
    resolvePlayThinkingKind("dictation_listen", {}, { kind: "photo" }, ""),
    "dictation_grade",
  );
});

test("resolveRewindThinkingKindForPhase mirrors adventure_ready compose", () => {
  assert.equal(
    resolveRewindThinkingKindForPhase("adventure_ready", { path_completed: true }),
    "adventure_compose",
  );
});

test("resolveRewindThinkingKindForPhase uses dictation_compose on dictation phases", () => {
  assert.equal(resolveRewindThinkingKindForPhase("dictation_listen"), "dictation_compose");
});
