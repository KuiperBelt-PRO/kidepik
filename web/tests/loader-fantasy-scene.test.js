import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CENTER_LEFT_ZONE_MAX,
  CENTER_RIGHT_ZONE_MIN,
  buildCrystalOccupiedZones,
  centerSlotForKind,
  computeSafeCenterRange,
  findFreeIntervals,
  mergeBlockedIntervals,
  pickCenterPlacementX,
  pickGapPlacementX,
  placementOverlapsOccupants,
  planBuildingKind,
  preferredCrystalHemispheres,
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

describe("loader-fantasy-scene / huecos para cristales", () => {
  it("mergeBlockedIntervals une solapes", () => {
    const merged = mergeBlockedIntervals([
      { min: 10, max: 30 },
      { min: 25, max: 40 },
      { min: 50, max: 55 },
    ]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].min, 10);
    assert.equal(merged[0].max, 40);
  });

  it("findFreeIntervals devuelve huecos entre zonas bloqueadas", () => {
    const free = findFreeIntervals(
      [{ min: 10, max: 30 }, { min: 60, max: 80 }],
      8,
      92,
    );
    assert.ok(free.some((iv) => iv.min >= 30 && iv.max <= 60));
  });

  it("pickGapPlacementX coloca en el hueco libre opuesto al bosque", () => {
    const rng = createRng(42);
    const x = pickGapPlacementX({
      rng,
      layerWidthPx: 390,
      selfSizePx: 65,
      occupiedZones: [{ center: 26, halfWidth: 8 }],
    });
    assert.ok(x != null);
    assert.ok(x >= CENTER_RIGHT_ZONE_MIN);
  });

  it("pickGapPlacementX evita zonas ocupadas", () => {
    const rng = createRng(7);
    const x = pickGapPlacementX({
      rng,
      layerWidthPx: 390,
      selfSizePx: 60,
      occupiedZones: [
        { center: 72, halfWidth: 12 },
      ],
    });
    assert.ok(x != null);
    assert.ok(x <= CENTER_LEFT_ZONE_MAX);
    assert.ok(x < 72 - 12 - 4 || x > 72 + 12 + 4);
  });

  it("pickGapPlacementX con riscos grandes requiere relajar márgenes", () => {
    let strictFound = 0;
    let relaxedFound = 0;
    for (let s = 0; s < 25; s++) {
      const strict = pickGapPlacementX({
        rng: createRng(s + 300),
        layerWidthPx: 390,
        selfSizePx: 62,
        cliffLeftPx: 110,
        cliffRightPx: 110,
        avoidEdgeCliffs: true,
        minGapFactor: 1.65,
      });
      if (strict != null) strictFound += 1;

      const relaxed = pickGapPlacementX({
        rng: createRng(s + 400),
        layerWidthPx: 390,
        selfSizePx: 62,
        cliffLeftPx: 110,
        cliffRightPx: 110,
        avoidEdgeCliffs: false,
        minGapFactor: 1.65,
      });
      if (relaxed != null) {
        relaxedFound += 1;
        assert.ok(
          relaxed <= CENTER_LEFT_ZONE_MAX || relaxed >= CENTER_RIGHT_ZONE_MIN,
          `seed ${s}: cristal en zona del logo (${relaxed})`,
        );
      }
    }
    assert.ok(relaxedFound >= 20);
    assert.ok(strictFound <= relaxedFound);
  });

  it("preferredCrystalHemispheres evita el lado del bosque o castillo", () => {
    assert.deepEqual(preferredCrystalHemispheres(24, null), ["right"]);
    assert.deepEqual(preferredCrystalHemispheres(null, 78), ["left"]);
    assert.deepEqual(preferredCrystalHemispheres(24, 78), ["left", "right"]);
  });

  it("pickGapPlacementX con bosque activo solo en hemisferio opuesto", () => {
    for (let s = 0; s < 20; s++) {
      const x = pickGapPlacementX({
        rng: createRng(s + 500),
        layerWidthPx: 390,
        selfSizePx: 58,
        minGapFactor: 1.75,
        zoneMarginFrac: 0.62,
        occupiedExtraPaddingPct: 3.5,
        allowedHemispheres: ["right"],
        occupiedZones: buildCrystalOccupiedZones({
          forestX: 24,
          forestSizePx: 72,
          layerWidthPx: 390,
        }),
      });
      if (x == null) continue;
      assert.ok(x >= CENTER_RIGHT_ZONE_MIN, `seed ${s}: cristal no fue a la derecha (${x})`);
      assert.ok(
        !placementOverlapsOccupants(
          x,
          58,
          390,
          buildCrystalOccupiedZones({ forestX: 24, forestSizePx: 72, layerWidthPx: 390 }),
        ),
        `seed ${s}: solapa bosque (${x})`,
      );
    }
  });

  it("pickGapPlacementX con bosque y castillo nunca solapa si coloca", () => {
    const occupiedZones = buildCrystalOccupiedZones({
      forestX: 24,
      forestSizePx: 72,
      buildingX: 78,
      buildingSizePx: 120,
      layerWidthPx: 390,
    });
    for (let s = 0; s < 40; s++) {
      const x = pickGapPlacementX({
        rng: createRng(s + 700),
        layerWidthPx: 390,
        selfSizePx: 52,
        minGapFactor: 1.62,
        zoneMarginFrac: 0.62,
        occupiedExtraPaddingPct: 3.5,
        allowedHemispheres: ["left", "right"],
        occupiedZones,
      });
      if (x == null) continue;
      assert.ok(
        !placementOverlapsOccupants(x, 52, 390, occupiedZones),
        `seed ${s}: solapa bosque o castillo (${x})`,
      );
      assert.ok(x <= CENTER_LEFT_ZONE_MAX || x >= CENTER_RIGHT_ZONE_MIN);
    }
  });

  it("pickGapPlacementX devuelve null si no hay hueco", () => {
    const rng = createRng(1);
    const x = pickGapPlacementX({
      rng,
      layerWidthPx: 200,
      selfSizePx: 120,
      occupiedZones: [
        { center: 20, halfWidth: 25 },
        { center: 80, halfWidth: 25 },
      ],
    });
    assert.equal(x, null);
  });
});
