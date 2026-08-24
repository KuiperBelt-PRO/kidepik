/**
 * @module play-compose-debug.test
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  composeDebugChipLabel,
  shouldShowComposeDebugChip,
} from "../js/lib/play-compose-debug.js";

test("shouldShowComposeDebugChip only on compose_failed with debug", () => {
  assert.equal(shouldShowComposeDebugChip(false, { meta: { compose_failed: true } }), false);
  assert.equal(shouldShowComposeDebugChip(true, { meta: { phase: "choose_path" } }), false);
  assert.equal(
    shouldShowComposeDebugChip(true, { meta: { compose_failed: true, phase: "compose_failed" } }),
    true,
  );
});

test("composeDebugChipLabel adapts to path_composer", () => {
  assert.equal(composeDebugChipLabel({ purpose: "path_composer" }), "Ver diagnóstico del compose");
  assert.equal(composeDebugChipLabel({ purpose: "placement_item_writer" }), "Ver diagnóstico de la prueba");
});
