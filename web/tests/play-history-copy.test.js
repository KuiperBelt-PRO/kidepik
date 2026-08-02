import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  historyToneFromAgeBand,
  historyWorldKey,
  pickHistoryCopy,
  resolveHistoryCopy,
} from "../js/lib/play-history-copy.js";

describe("play-history-copy", () => {
  it("historyWorldKey mapea mundos y neutro", () => {
    assert.equal(historyWorldKey("fantasy"), "fantasy");
    assert.equal(historyWorldKey("sci-fi"), "sci-fi");
    assert.equal(historyWorldKey(null), "neutral");
  });

  it("historyToneFromAgeBand agrupa bandas", () => {
    assert.equal(historyToneFromAgeBand("band_early"), "early");
    assert.equal(historyToneFromAgeBand("band_tween"), "teen");
    assert.equal(historyToneFromAgeBand(undefined), "child");
  });

  it("pickHistoryCopy devuelve un miembro del pool", () => {
    const pool = ["A", "B", "C"];
    assert.equal(pickHistoryCopy(pool, () => 0), "A");
    assert.equal(pickHistoryCopy(pool, () => 0.99), "C");
  });

  it("resolveHistoryCopy usa pool fantasy child", () => {
    const label = resolveHistoryCopy("fantasy", "band_child", "idle", () => 0);
    assert.equal(label, "Recordar el camino");
  });
});
