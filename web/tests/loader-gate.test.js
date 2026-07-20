import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GATE_COPY,
  GATE_HINT_DELAY_DEMO_MS,
  GATE_HINT_DELAY_MS,
  GATE_HINT_DELAY_REDUCED_MS,
  GATE_MORPH_MS,
  GATE_MORPH_REDUCED_MS,
  isSessionValid,
  resolveGateHintDelay,
  resolveGateMorphDuration,
} from "../js/components/loader-gate-constants.js";

describe("loader-gate-constants", () => {
  it("copy dual tipográfico del hint y eslogan", () => {
    assert.equal(GATE_COPY.hintSci, "PULSA PARA COMENZAR");
    assert.equal(GATE_COPY.hintFantasy, "TU VIAJE ÉPICO");
    assert.equal(GATE_COPY.aria, "Pulsa para comenzar tu viaje épico");
    assert.equal(GATE_COPY.sloganLine1, "DOS MUNDOS.");
    assert.equal(GATE_COPY.sloganLine2, "UN VIAJE ÉPICO.");
  });

  it("hint delay: 500ms normal, 150ms reduced, 100ms demo", () => {
    assert.equal(resolveGateHintDelay(false), GATE_HINT_DELAY_MS);
    assert.equal(GATE_HINT_DELAY_MS, 500);
    assert.equal(resolveGateHintDelay(true), GATE_HINT_DELAY_REDUCED_MS);
    assert.equal(GATE_HINT_DELAY_REDUCED_MS, 150);
    assert.equal(resolveGateHintDelay(false, { demo: true }), GATE_HINT_DELAY_DEMO_MS);
    assert.equal(GATE_HINT_DELAY_DEMO_MS, 100);
  });

  it("overrideMs gana sobre demo y reduced", () => {
    assert.equal(resolveGateHintDelay(true, { demo: true, overrideMs: 50 }), 50);
  });

  it("morph: 800ms normal, 150ms reduced", () => {
    assert.equal(resolveGateMorphDuration(false), GATE_MORPH_MS);
    assert.equal(GATE_MORPH_MS, 800);
    assert.equal(resolveGateMorphDuration(true), GATE_MORPH_REDUCED_MS);
    assert.equal(GATE_MORPH_REDUCED_MS, 150);
  });

  it("isSessionValid exige access_token no vacío", () => {
    assert.equal(isSessionValid(null), false);
    assert.equal(isSessionValid({}), false);
    assert.equal(isSessionValid({ access_token: "" }), false);
    assert.equal(isSessionValid({ access_token: "jwt" }), true);
  });
});
