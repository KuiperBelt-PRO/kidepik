import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  centerSlotForKind,
  planBuildingKind,
} from "../js/components/loader-fantasy-scene.js";
import { createRng } from "../js/components/loader-ship-rng.js";

describe("loader-fantasy-scene / ranuras centrales", () => {
  it("centerSlotForKind separa bosque y edificio", () => {
    assert.equal(centerSlotForKind("forest"), "forest");
    assert.equal(centerSlotForKind("castle"), "building");
    assert.equal(centerSlotForKind("palace"), "building");
    assert.equal(centerSlotForKind("cliffs"), null);
  });

  it("planBuildingKind respeta devKind", () => {
    assert.equal(planBuildingKind(createRng(1), "castle"), "castle");
    assert.equal(planBuildingKind(createRng(1), "palace"), "palace");
  });

  it("planBuildingKind alterna castillo y palacio", () => {
    const kinds = new Set();
    for (let s = 0; s < 30; s++) {
      kinds.add(planBuildingKind(createRng(s + 40), undefined));
    }
    assert.ok(kinds.has("castle"));
    assert.ok(kinds.has("palace"));
  });
});
