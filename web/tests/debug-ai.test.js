import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register();
}

import {
  initDebugAiFromUrl,
  isDebugAiClientActive,
  setDebugAiClientActive,
  debugAiRequestHeaders,
  setDebugAiServerAllowed,
  isDebugAiAllowed,
} from "../js/lib/debug-ai.js";

describe("debug-ai", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setDebugAiServerAllowed(false);
  });

  it("adds debug header when client active", () => {
    setDebugAiClientActive(true);
    assert.deepEqual(debugAiRequestHeaders(), { "X-Kidepik-Debug-Ai": "1" });
  });

  it("requires server allowed for isDebugAiAllowed", () => {
    setDebugAiClientActive(true);
    assert.equal(isDebugAiAllowed(), false);
    setDebugAiServerAllowed(true);
    assert.equal(isDebugAiAllowed(), true);
  });
});
