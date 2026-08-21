/**
 * @module play-compose-layout.test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { shouldRenderChoiceChips } from "../js/lib/play-compose-layout.js";

test("shouldRenderChoiceChips hides chips when world/zone/path use cards", () => {
  assert.equal(shouldRenderChoiceChips("options_only", { useChoiceCards: true }), false);
  assert.equal(shouldRenderChoiceChips("continue", { useChoiceCards: true }), false);
});

test("shouldRenderChoiceChips shows chips for MCQ, continue and options_or_text", () => {
  assert.equal(shouldRenderChoiceChips("options_only"), true);
  assert.equal(shouldRenderChoiceChips("options_or_text"), true);
  assert.equal(shouldRenderChoiceChips("continue"), true);
  assert.equal(shouldRenderChoiceChips("text_only"), false);
  assert.equal(shouldRenderChoiceChips("blocked"), false);
});
