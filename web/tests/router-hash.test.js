import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashRoutePath } from "../js/lib/router.js";

describe("router / hashRoutePath", () => {
  it("ignora query en el hash al resolver la ruta", () => {
    assert.equal(hashRoutePath("#/loader?fantasyDev=crystals&fantasySeed=4242"), "loader");
  });

  it("ruta por defecto sin hash", () => {
    assert.equal(hashRoutePath(""), "loader");
    assert.equal(hashRoutePath("#/"), "loader");
  });

  it("mockup con params en hash", () => {
    assert.equal(hashRoutePath("#/mockup/home?preview=1"), "mockup/home");
  });
});
