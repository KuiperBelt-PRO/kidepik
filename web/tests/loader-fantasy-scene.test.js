import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CENTER_LEFT_ZONE_MAX,
  CENTER_RIGHT_ZONE_MIN,
  centerSlotForKind,
  computeSafeCenterRange,
  pickCenterPlacementX,
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

  it("pickCenterPlacementX separa bosque y edificio en franjas opuestas", () => {
    const rng = createRng(99);
    const forestX = pickCenterPlacementX({
      rng,
      slot: "forest",
      layerWidthPx: 390,
      selfSizePx: 72,
      bothSlotsEnabled: true,
    });
    const buildingX = pickCenterPlacementX({
      rng,
      slot: "building",
      otherXPercent: forestX,
      layerWidthPx: 390,
      selfSizePx: 120,
      bothSlotsEnabled: true,
    });

    if (forestX < 50) {
      assert.ok(forestX <= CENTER_LEFT_ZONE_MAX);
      assert.ok(buildingX >= CENTER_RIGHT_ZONE_MIN);
    } else {
      assert.ok(forestX >= CENTER_RIGHT_ZONE_MIN);
      assert.ok(buildingX <= CENTER_LEFT_ZONE_MAX);
    }
  });

  it("pickCenterPlacementX respeta la posición del otro elemento activo", () => {
    for (let s = 0; s < 20; s++) {
      const rng = createRng(s + 200);
      const otherX = 28;
      const x = pickCenterPlacementX({
        rng,
        slot: "building",
        otherXPercent: otherX,
        layerWidthPx: 390,
        selfSizePx: 100,
        bothSlotsEnabled: true,
      });
      assert.ok(x >= CENTER_RIGHT_ZONE_MIN, `seed ${s}: edificio no fue a la derecha (${x})`);
    }
  });

  it("pickCenterPlacementX usa rango completo si no hay espacio", () => {
    const rng = createRng(7);
    const x = pickCenterPlacementX({
      rng,
      slot: "forest",
      layerWidthPx: 120,
      selfSizePx: 96,
      bothSlotsEnabled: true,
    });
    assert.ok(x >= 8 && x <= 92);
  });

  it("pickCenterPlacementX usa rango completo con una sola ranura", () => {
    const rng = createRng(11);
    const x = pickCenterPlacementX({
      rng,
      slot: "forest",
      layerWidthPx: 390,
      selfSizePx: 72,
      bothSlotsEnabled: false,
    });
    assert.ok(x >= 8 && x <= 92);
  });

  it("computeSafeCenterRange reserva margen de riscos laterales", () => {
    const both = computeSafeCenterRange(390, 160, 140, 140);
    assert.ok(both.min > 8);
    assert.ok(both.max < 50);

    const rightOnly = computeSafeCenterRange(390, 160, 140, 140, "right");
    assert.ok(rightOnly.max < 50);
    assert.equal(rightOnly.min, 8);
  });

  it("pickCenterPlacementX aleja el edificio del risco del lado elegido", () => {
    const layerWidthPx = 390;
    const selfSizePx = 160;
    const cliffPx = 140;
    const safeRight = computeSafeCenterRange(layerWidthPx, selfSizePx, cliffPx, cliffPx, "right");
    for (let s = 0; s < 25; s++) {
      const x = pickCenterPlacementX({
        rng: createRng(s + 50),
        slot: "building",
        otherXPercent: 22,
        layerWidthPx,
        selfSizePx,
        cliffLeftPx: cliffPx,
        cliffRightPx: cliffPx,
        avoidEdgeCliffs: true,
        bothSlotsEnabled: true,
      });
      assert.ok(x <= safeRight.max + 0.01, `seed ${s}: demasiado cerca del risco derecho (${x})`);
    }
  });
});
