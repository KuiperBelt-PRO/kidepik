import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseWorldLayerQuery } from "../js/components/loader-world-utils.js";

describe("loader-world-utils / parseWorldLayerQuery", () => {
  it("parsea gateDemo y flags fantasy/fx", () => {
    const q = new URLSearchParams(
      "gateDemo=1&fantasyDev=crystals&fantasySeed=42&fxDev=0&fxIntensity=0.5",
    );
    const opts = parseWorldLayerQuery(q);
    assert.equal(opts.gateDemo, true);
    assert.equal(opts.fantasyDev, "crystals");
    assert.equal(opts.fantasySeed, 42);
    assert.equal(opts.fxEnabled, false);
    assert.equal(opts.fxIntensity, 0.5);
  });

  it("defaults seguros sin query", () => {
    const opts = parseWorldLayerQuery(new URLSearchParams());
    assert.equal(opts.gateDemo, false);
    assert.equal(opts.fxEnabled, true);
    assert.equal(opts.fxIntensity, 1);
    assert.equal(opts.fantasySeed, undefined);
  });
});
