import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  METEOR_BURST_COUNT_MAX,
  METEOR_BURST_COUNT_MIN,
  METEOR_BURST_INTERVAL_MAX_MS,
  METEOR_BURST_INTERVAL_MIN_MS,
  createMeteorParams,
  meteorOpacityAt,
  meteorPoseAt,
  planBurstMeteorCount,
  planNextBurstDelayMs,
} from "../js/components/loader-meteor-shower.js";
import { createRng } from "../js/components/loader-ship-rng.js";

describe("loader-meteor-shower planner", () => {
  it("planBurstMeteorCount devuelve 10–28", () => {
    const rng = createRng(77);
    for (let i = 0; i < 80; i += 1) {
      const count = planBurstMeteorCount(rng);
      assert.ok(count >= METEOR_BURST_COUNT_MIN, `too few: ${count}`);
      assert.ok(count <= METEOR_BURST_COUNT_MAX, `too many: ${count}`);
    }
  });

  it("planNextBurstDelayMs: primera ráfaga 4–8 s; siguientes 12–22 s", () => {
    const rng = createRng(88);
    const first = planNextBurstDelayMs(rng, true);
    assert.ok(first >= 4000 && first <= 8000, `first delay ${first}`);

    for (let i = 0; i < 40; i += 1) {
      const delay = planNextBurstDelayMs(rng, false);
      assert.ok(delay >= METEOR_BURST_INTERVAL_MIN_MS, `delay ${delay}`);
      assert.ok(delay <= METEOR_BURST_INTERVAL_MAX_MS, `delay ${delay}`);
    }
  });

  it("createMeteorParams genera trayectoria horizontal", () => {
    const rng = createRng(99);
    for (let i = 0; i < 30; i += 1) {
      const p = createMeteorParams(rng);
      assert.ok(p.xEndFraction > p.xStartFraction, "debe ir de izquierda a derecha");
      assert.ok(p.yFraction >= 0.08 && p.yFraction <= 0.38);
      assert.ok(p.lengthPx >= 16 && p.lengthPx <= 108);
    }
  });

  it("meteorPoseAt mantiene Y constante", () => {
    const params = createMeteorParams(createRng(12));
    const y0 = meteorPoseAt(params, 390, 400, 0).y;
    const y1 = meteorPoseAt(params, 390, 400, 0.5).y;
    const y2 = meteorPoseAt(params, 390, 400, 1).y;
    assert.equal(y0, y1);
    assert.equal(y1, y2);
  });

  it("meteorOpacityAt hace fade-in y fade-out", () => {
    assert.equal(meteorOpacityAt(0), 0);
    assert.ok(meteorOpacityAt(0.04) > 0);
    assert.equal(meteorOpacityAt(0.5), 1);
    assert.ok(meteorOpacityAt(0.95) < meteorOpacityAt(0.5));
    assert.equal(meteorOpacityAt(1), 0);
  });
});
