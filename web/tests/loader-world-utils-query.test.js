import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  getLoaderQueryParams,
  parseWorldLayerQuery,
} from "../js/components/loader-world-utils.js";

describe("loader-world-utils query", () => {
  beforeEach(() => {
    window.location.hash = "#/loader";
    window.location.search = "";
  });

  it("getLoaderQueryParams desde search", () => {
    window.location.search = "?gateDemo=1";
    const q = getLoaderQueryParams();
    assert.equal(q.get("gateDemo"), "1");
  });

  it("getLoaderQueryParams desde hash", () => {
    window.location.hash = "#/loader?meteorDemo=1&fantasySeed=42";
    const q = getLoaderQueryParams();
    assert.equal(q.get("meteorDemo"), "1");
    assert.equal(q.get("fantasySeed"), "42");
  });

  it("parseWorldLayerQuery flags", () => {
    const q = new URLSearchParams("gateDemo=1&fxDev=0&fxIntensity=2&fantasyFormation=cliff");
    const parsed = parseWorldLayerQuery(q);
    assert.equal(parsed.gateDemo, true);
    assert.equal(parsed.fxEnabled, false);
    assert.equal(parsed.fxIntensity, 2);
    assert.equal(parsed.fantasyFormation, "cliff");
  });
});
