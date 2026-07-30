import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ASSETS, assetUrl } from "../js/lib/assets.manifest.js";

describe("assets.manifest", () => {
  it("assetUrl devuelve rutas conocidas", () => {
    assert.match(assetUrl("loader.logo"), /wordmark/);
    assert.equal(assetUrl("missing"), undefined);
  });

  it("ASSETS tiene slots loader", () => {
    assert.ok(ASSETS["loader.bg.plain"]);
    assert.ok(ASSETS["loader.logo"]);
  });
});
