import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CENTER_LEFT_ZONE_MAX,
  CENTER_RIGHT_ZONE_MIN,
  SCENE_OCCUPIED_EXTRA_PADDING_PCT,
  buildCrystalOccupiedZones,
  buildSceneOccupiedZones,
  centerSlotForKind,
  computeSafeCenterRange,
  dominantHemisphereFromOccupiedZones,
  findFreeIntervals,
  mergeBlockedIntervals,
  pickCenterGapPlacementX,
  pickCenterPlacementX,
  pickFairGapPlacementX,
  pickGapPlacementX,
  pickTrioScenePlacementX,
  placementOverlapsOccupants,
  planBuildingKind,
  preferredCrystalHemispheres,
  resolveCenterPlacementHemispheres,
  isTrioCenterMode,
  TRIO_CENTER_MIN_GAP_FACTOR,
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

  it("resolveCenterPlacementHemispheres separa bosque y edificio", () => {
    assert.deepEqual(
      resolveCenterPlacementHemispheres("building", 24, createRng(1), true),
      ["right"],
    );
    assert.deepEqual(
      resolveCenterPlacementHemispheres("forest", 78, createRng(1), true),
      ["left"],
    );
    assert.equal(resolveCenterPlacementHemispheres("forest", null, createRng(1), false), null);
  });

  it("resolveCenterPlacementHemispheres evita hemisferio con cristales activos", () => {
    const zones = buildSceneOccupiedZones({
      crystalsX: 72,
      crystalsSizePx: 58,
      layerWidthPx: 390,
    });
    assert.deepEqual(
      resolveCenterPlacementHemispheres("forest", null, createRng(1), true, zones),
      ["left"],
    );
    assert.deepEqual(
      resolveCenterPlacementHemispheres("building", null, createRng(1), true, zones),
      ["left"],
    );
  });

  it("dominantHemisphereFromOccupiedZones detecta el lado ocupado", () => {
    assert.equal(
      dominantHemisphereFromOccupiedZones(
        buildSceneOccupiedZones({ forestX: 24, forestSizePx: 72, layerWidthPx: 390 }),
      ),
      "left",
    );
    assert.equal(
      dominantHemisphereFromOccupiedZones(
        buildSceneOccupiedZones({ buildingX: 78, buildingSizePx: 120, layerWidthPx: 390 }),
      ),
      "right",
    );
  });

  it("pickCenterGapPlacementX no solapa con cristales activos", () => {
    const occupiedZones = buildSceneOccupiedZones({
      buildingX: 78,
      buildingSizePx: 120,
      crystalsX: 11,
      crystalsSizePx: 46,
      layerWidthPx: 390,
    });
    let placed = 0;
    for (let s = 0; s < 40; s++) {
      const x = pickCenterGapPlacementX({
        rng: createRng(s + 880),
        slot: "forest",
        otherXPercent: 78,
        layerWidthPx: 390,
        selfSizePx: 72,
        bothSlotsEnabled: true,
        occupiedZones,
        minGapFactor: 1.55,
      });
      if (x == null) continue;
      placed += 1;
      assert.ok(x <= CENTER_LEFT_ZONE_MAX, `seed ${s}: bosque no fue a la izquierda (${x})`);
      assert.ok(
        !placementOverlapsOccupants(x, 72, 390, occupiedZones),
        `seed ${s}: bosque solapa (${x})`,
      );
    }
    assert.ok(placed >= 12);
  });

  it("pickCenterGapPlacementX separa bosque y castillo sin solape", () => {
    const rng = createRng(99);
    const forestX = pickCenterGapPlacementX({
      rng,
      slot: "forest",
      layerWidthPx: 390,
      selfSizePx: 72,
      bothSlotsEnabled: true,
      occupiedZones: [],
      minGapFactor: 1.65,
    });
    assert.ok(forestX != null);
    const buildingX = pickCenterGapPlacementX({
      rng,
      slot: "building",
      otherXPercent: forestX,
      layerWidthPx: 390,
      selfSizePx: 120,
      bothSlotsEnabled: true,
      minGapFactor: 1.62,
      occupiedZones: buildSceneOccupiedZones({
        forestX,
        forestSizePx: 72,
        layerWidthPx: 390,
      }),
    });
    assert.ok(buildingX != null);
    assert.ok(
      !placementOverlapsOccupants(
        buildingX,
        120,
        390,
        buildSceneOccupiedZones({ forestX, forestSizePx: 72, layerWidthPx: 390 }),
      ),
    );
    assert.ok(
      !placementOverlapsOccupants(
        forestX,
        72,
        390,
        buildSceneOccupiedZones({ buildingX, buildingSizePx: 120, layerWidthPx: 390 }),
      ),
    );
    if (forestX < 50) {
      assert.ok(forestX <= CENTER_LEFT_ZONE_MAX);
      assert.ok(buildingX >= CENTER_RIGHT_ZONE_MIN);
    } else {
      assert.ok(forestX >= CENTER_RIGHT_ZONE_MIN);
      assert.ok(buildingX <= CENTER_LEFT_ZONE_MAX);
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

  it("isTrioCenterMode requiere bosque castillo y cristales", () => {
    assert.equal(isTrioCenterMode({ forest: true, building: true, crystals: true }), true);
    assert.equal(isTrioCenterMode({ forest: true, building: true, crystals: false }), false);
    assert.equal(isTrioCenterMode({ forest: false, building: true, crystals: true }), false);
  });

  it("pickTrioScenePlacementX permite triple cuando hay sitio", () => {
    const layerWidthPx = 390;
    let triples = 0;
    for (let s = 0; s < 50; s++) {
      const rng = createRng(s + 900);
      const forestX = pickTrioScenePlacementX({
        rng,
        layerWidthPx,
        selfSizePx: 64,
        occupiedZones: [],
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (forestX == null) continue;
      const zonesF = buildSceneOccupiedZones({
        forestX,
        forestSizePx: 64,
        layerWidthPx,
      });
      const buildingX = pickTrioScenePlacementX({
        rng,
        layerWidthPx,
        selfSizePx: 100,
        occupiedZones: zonesF,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (buildingX == null) continue;
      const zonesBoth = buildSceneOccupiedZones({
        forestX,
        forestSizePx: 64,
        buildingX,
        buildingSizePx: 100,
        layerWidthPx,
      });
      const crystalsX = pickTrioScenePlacementX({
        rng,
        layerWidthPx,
        selfSizePx: 52,
        occupiedZones: zonesBoth,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (crystalsX == null) continue;
      triples += 1;
      assert.ok(
        !placementOverlapsOccupants(crystalsX, 52, layerWidthPx, zonesBoth),
        `seed ${s}: cristales solapan`,
      );
    }
    assert.ok(triples >= 10, `solo ${triples} triples en 50 intentos`);
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
        occupiedExtraPaddingPct: SCENE_OCCUPIED_EXTRA_PADDING_PCT,
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
        occupiedExtraPaddingPct: SCENE_OCCUPIED_EXTRA_PADDING_PCT,
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

  it("buildSceneOccupiedZones incluye bosque castillo y cristales", () => {
    const zones = buildSceneOccupiedZones({
      forestX: 24,
      forestSizePx: 72,
      buildingX: 78,
      buildingSizePx: 120,
      crystalsX: 52,
      crystalsSizePx: 60,
      layerWidthPx: 390,
    });
    assert.equal(zones.length, 3);
  });

  it("simulación de reaparición con cristales activos no solapa", () => {
    const layerWidthPx = 390;
    const crystalsX = 72;
    const crystalsSizePx = 58;
    const occupiedZones = buildSceneOccupiedZones({
      crystalsX,
      crystalsSizePx,
      layerWidthPx,
    });
    let placed = 0;
    for (let s = 0; s < 50; s++) {
      const forestX = pickCenterGapPlacementX({
        rng: createRng(s + 1200),
        slot: "forest",
        layerWidthPx,
        selfSizePx: 72,
        bothSlotsEnabled: true,
        occupiedZones,
        minGapFactor: 1.65,
      });
      if (forestX == null) continue;
      placed += 1;
      assert.ok(forestX <= CENTER_LEFT_ZONE_MAX, `seed ${s}: bosque no fue a la izquierda (${forestX})`);
      assert.ok(
        !placementOverlapsOccupants(forestX, 72, layerWidthPx, occupiedZones),
        `seed ${s}: bosque solapa cristales (${forestX})`,
      );
    }
    assert.ok(placed >= 10);
  });

  it("simulación triple bosque castillo cristales sin solapes", () => {
    const layerWidthPx = 390;
    let triples = 0;
    for (let s = 0; s < 80; s++) {
      const rng = createRng(s + 2000);
      const forestSizePx = 68 + (s % 12);
      const buildingSizePx = 108 + (s % 18);
      const crystalsSizePx = 50 + (s % 14);

      const forestX = pickTrioScenePlacementX({
        rng,
        layerWidthPx,
        selfSizePx: forestSizePx,
        occupiedZones: [],
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (forestX == null) continue;

      const zonesForest = buildSceneOccupiedZones({ forestX, forestSizePx, layerWidthPx });
      const buildingX = pickTrioScenePlacementX({
        rng,
        layerWidthPx,
        selfSizePx: buildingSizePx,
        occupiedZones: zonesForest,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (buildingX == null) continue;

      const zonesBoth = buildSceneOccupiedZones({
        forestX,
        forestSizePx,
        buildingX,
        buildingSizePx,
        layerWidthPx,
      });
      const crystalsX = pickTrioScenePlacementX({
        rng,
        layerWidthPx,
        selfSizePx: crystalsSizePx,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
        occupiedZones: zonesBoth,
      });
      if (crystalsX == null) continue;
      triples += 1;
      assert.ok(
        !placementOverlapsOccupants(crystalsX, crystalsSizePx, layerWidthPx, zonesBoth),
        `seed ${s}: cristales solapan (${crystalsX})`,
      );
      assert.ok(
        !placementOverlapsOccupants(
          buildingX,
          buildingSizePx,
          layerWidthPx,
          zonesForest,
        ),
        `seed ${s}: castillo solapa bosque`,
      );
      assert.ok(
        !placementOverlapsOccupants(forestX, forestSizePx, layerWidthPx, [
          { center: buildingX, halfWidth: (buildingSizePx * 1.16 / 2 / layerWidthPx) * 100 },
          { center: crystalsX, halfWidth: (crystalsSizePx * 1.14 / 2 / layerWidthPx) * 100 },
        ], SCENE_OCCUPIED_EXTRA_PADDING_PCT),
        `seed ${s}: bosque solapa en triple`,
      );
    }
    assert.ok(triples >= 20, `solo ${triples} triples en 80 intentos`);
  });
});
