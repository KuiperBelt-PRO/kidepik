import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLOUD_MAX_CONCURRENT,
  CLOUD_SPAWN_INTERVAL_MAX_MS,
  CLOUD_SPAWN_INTERVAL_MIN_MS,
  CLOUD_Y_FRACTION_MAX,
  CLOUD_Y_FRACTION_MIN,
  cloudOpacityAt,
  cloudPoseAt,
  createCloudParams,
  generateCloudPath,
  planNextCloudSpawnDelayMs,
} from "../js/components/loader-fantasy-clouds.js";
import { createRng } from "../js/components/loader-ship-rng.js";

describe("loader-fantasy-clouds planner", () => {
  it("planNextCloudSpawnDelayMs: primera aparición 1,5–4 s; siguientes 2,5–7 s", () => {
    const rng = createRng(42);
    const first = planNextCloudSpawnDelayMs(rng, true);
    assert.ok(first >= 1500 && first <= 4000, `first delay ${first}`);

    for (let i = 0; i < 40; i += 1) {
      const delay = planNextCloudSpawnDelayMs(rng, false);
      assert.ok(delay >= CLOUD_SPAWN_INTERVAL_MIN_MS, `delay ${delay}`);
      assert.ok(delay <= CLOUD_SPAWN_INTERVAL_MAX_MS, `delay ${delay}`);
    }
  });

  it("createCloudParams: trayectoria derecha → izquierda y banda Y acotada", () => {
    const rng = createRng(99);
    for (let i = 0; i < 30; i += 1) {
      const p = createCloudParams(rng);
      assert.ok(p.xEndFraction < p.xStartFraction, "debe ir de derecha a izquierda");
      assert.ok(p.yFraction >= CLOUD_Y_FRACTION_MIN && p.yFraction <= CLOUD_Y_FRACTION_MAX);
      assert.ok(p.widthPx >= 52 && p.widthPx <= 148);
      assert.ok(p.durationMs >= 18000 && p.durationMs <= 64000);
      assert.ok(p.pathD.includes("M"), "path SVG válido");
    }
  });

  it("generateCloudPath es determinista, usa curvas suaves y no vacío", () => {
    const rngA = createRng(7);
    const rngB = createRng(7);
    const a = generateCloudPath(rngA);
    const b = generateCloudPath(rngB);
    assert.equal(a, b);
    assert.ok(a.length > 20);
    assert.ok(a.includes(" C "), "picos con curvas cúbicas Bézier");
    assert.ok(!a.includes(" L ") || a.indexOf(" L ") > a.indexOf("M"), "base plana con segmento L");
    const other = generateCloudPath(createRng(8));
    assert.notEqual(a, other);
  });

  it("cloudPoseAt mantiene Y constante", () => {
    const params = createCloudParams(createRng(12));
    const y0 = cloudPoseAt(params, 390, 400, 0).y;
    const y1 = cloudPoseAt(params, 390, 400, 0.5).y;
    const y2 = cloudPoseAt(params, 390, 400, 1).y;
    assert.equal(y0, y1);
    assert.equal(y1, y2);
  });

  it("cloudOpacityAt hace fade-in y fade-out", () => {
    assert.equal(cloudOpacityAt(0), 0);
    assert.ok(cloudOpacityAt(0.03) > 0);
    assert.equal(cloudOpacityAt(0.5), 1);
    assert.ok(cloudOpacityAt(0.96) < cloudOpacityAt(0.5));
    assert.equal(cloudOpacityAt(1), 0);
  });

  it("CLOUD_MAX_CONCURRENT es 6", () => {
    assert.equal(CLOUD_MAX_CONCURRENT, 6);
  });
});
