import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register();
}

import {
  isDebugAiClientActive,
  setDebugAiClientActive,
  debugAiRequestHeaders,
  syncDebugAiCapabilities,
  isDebugAiAllowed,
  isDebugAiOperatorEligible,
} from "../js/lib/debug-ai.js";

describe("debug-ai", () => {
  beforeEach(() => {
    syncDebugAiCapabilities({
      operator_eligible: false,
      debug_enabled: false,
      debug_allowed: false,
    });
  });

  it("adds debug header when operator and setting active", () => {
    syncDebugAiCapabilities({
      operator_eligible: true,
      debug_enabled: true,
      debug_allowed: true,
    });
    assert.deepEqual(debugAiRequestHeaders(), { "X-Kidepik-Debug-Ai": "1" });
  });

  it("requires operator eligibility and enabled setting", () => {
    syncDebugAiCapabilities({ operator_eligible: true, debug_enabled: true });
    assert.equal(isDebugAiOperatorEligible(), true);
    assert.equal(isDebugAiAllowed(), true);
    setDebugAiClientActive(false);
    assert.equal(isDebugAiClientActive(), false);
  });
});
