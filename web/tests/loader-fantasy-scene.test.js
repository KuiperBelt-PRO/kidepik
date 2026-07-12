import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CENTER_SCENE_MAX_CONCURRENT,
  CENTER_SCENE_SLOT_WEIGHTS,
  CENTER_SCENE_SLOTS,
  CENTER_LEFT_ZONE_MAX,
  CENTER_RIGHT_ZONE_MIN,
  SCENE_OCCUPIED_EXTRA_PADDING_PCT,
  buildCrystalOccupiedZones,
  buildSceneOccupiedZones,
  centerSlotForKind,
  computeSafeCenterRange,
  countActiveCenterSlots,
  dominantHemisphereFromOccupiedZones,
  findFreeIntervals,
  forestFootprintHalfWidthPercent,
  forestFootprintWidthPx,
  forestNeedsWidePlacement,
  isCenterDirectorMode,
  mergeBlockedIntervals,
  pickCenterGapPlacementX,
  pickCenterPlacementX,
  pickFairGapPlacementX,
  pickGapPlacementX,
  pickRandomCenterSlot,
  pickTrioScenePlacementX,
  pickWideForestCenterX,
  placementOverlapsOccupants,
  planBuildingKind,
  preferredCrystalHemispheres,
  resolveCenterPlacementHemispheres,
  isTrioCenterMode,
  TRIO_CENTER_MIN_GAP_FACTOR,
  usesFairGapPlacement,
} from "../js/components/loader-fantasy-scene.js";
import { createRng } from "../js/components/loader-ship-rng.js";
import { generateForest } from "../js/components/loader-fantasy-forest.js";

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

  it("buildSceneOccupiedZones incluye bosque castillo cristales y portal", () => {
    const zones = buildSceneOccupiedZones({
      forestX: 24,
      forestSizePx: 72,
      buildingX: 78,
      buildingSizePx: 120,
      crystalsX: 52,
      crystalsSizePx: 60,
      portalX: 40,
      portalSizePx: 88,
      layerWidthPx: 390,
    });
    assert.equal(zones.length, 4);
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
    assert.ok(triples >= 15, `solo ${triples} triples en 80 intentos`);
  });
});

describe("loader-fantasy-scene / director central", () => {
  const generalEnabled = {
    forest: true,
    building: true,
    crystals: true,
    portal: true,
  };

  it("CENTER_SCENE_SLOTS incluye los cuatro tipos del loader", () => {
    assert.deepEqual(CENTER_SCENE_SLOTS, ["forest", "building", "crystals", "portal"]);
    assert.equal(CENTER_SCENE_MAX_CONCURRENT, 3);
  });

  it("isCenterDirectorMode activo en loader general", () => {
    assert.equal(isCenterDirectorMode(undefined, generalEnabled), true);
    assert.equal(isCenterDirectorMode("forest", generalEnabled), false);
    assert.equal(isCenterDirectorMode(undefined, { forest: true }), false);
  });

  it("usesFairGapPlacement en modo director", () => {
    assert.equal(usesFairGapPlacement(undefined, generalEnabled), true);
    assert.equal(usesFairGapPlacement("portal", { portal: true }), false);
  });

  it("pickRandomCenterSlot evita ranuras ya activas", () => {
    const rng = createRng(77);
    const slot = pickRandomCenterSlot(rng, generalEnabled, {
      forest: true,
      building: false,
      crystals: true,
      portal: false,
    });
    assert.ok(slot === "building" || slot === "portal");
  });

  it("pickRandomCenterSlot pondera bosques más que otros tipos", () => {
    const counts = { forest: 0, building: 0, crystals: 0, portal: 0 };
    for (let i = 0; i < 400; i++) {
      const slot = pickRandomCenterSlot(createRng(i + 9000), generalEnabled, {
        forest: false,
        building: false,
        crystals: false,
        portal: false,
      });
      if (slot) counts[slot] += 1;
    }
    assert.ok(counts.forest > counts.building, "bosque debería salir más que castillo");
    assert.ok(counts.forest > counts.crystals, "bosque debería salir más que cristales");
    assert.equal(CENTER_SCENE_SLOT_WEIGHTS.forest, 2.4);
  });

  it("pickRandomCenterSlot alterna tipos con el tiempo", () => {
    const seen = new Set();
    let last = null;
    const active = { forest: false, building: false, crystals: false, portal: false };
    for (let i = 0; i < 24; i++) {
      const rng = createRng(i + 5000);
      const slot = pickRandomCenterSlot(rng, generalEnabled, active, last);
      if (!slot) break;
      seen.add(slot);
      active[slot] = true;
      last = slot;
      if (countActiveCenterSlots(active) >= CENTER_SCENE_MAX_CONCURRENT) {
        const freed = pickRandomCenterSlot(createRng(i + 6000), generalEnabled, active, last);
        if (freed) seen.add(freed);
        active[slot] = false;
      }
    }
    assert.ok(seen.size >= 3);
  });

  it("countActiveCenterSlots respeta el tope de tres", () => {
    assert.equal(
      countActiveCenterSlots({ forest: true, building: true, crystals: true, portal: false }),
      3,
    );
    assert.equal(
      countActiveCenterSlots({ forest: true, building: true, crystals: true, portal: true }),
      4,
    );
  });

  it("pickTrioScenePlacementX admite portal con tres elementos activos", () => {
    const layerWidthPx = 390;
    let ok = 0;
    for (let s = 0; s < 60; s++) {
      const rng = createRng(s + 7000);
      const forestX = pickFairGapPlacementX({
        rng,
        layerWidthPx,
        selfSizePx: 52,
        occupiedZones: [],
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (forestX == null) continue;
      const zonesA = buildSceneOccupiedZones({ forestX, forestSizePx: 52, layerWidthPx });
      const buildingX = pickFairGapPlacementX({
        rng,
        layerWidthPx,
        selfSizePx: 72,
        occupiedZones: zonesA,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (buildingX == null) continue;
      const zonesB = buildSceneOccupiedZones({
        forestX,
        forestSizePx: 52,
        buildingX,
        buildingSizePx: 72,
        layerWidthPx,
      });
      const portalX = pickFairGapPlacementX({
        rng,
        layerWidthPx,
        selfSizePx: 58,
        occupiedZones: zonesB,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (portalX == null) continue;
      ok += 1;
      assert.ok(
        !placementOverlapsOccupants(portalX, 58, layerWidthPx, zonesB),
        `seed ${s}: portal solapa`,
      );
    }
    assert.ok(ok >= 2, `solo ${ok} colocaciones con portal`);
  });

  it("forestFootprintWidthPx refleja bosques anchos tras normalizar por altura", () => {
    const roomy = generateForest({ seed: 42, roomy: true });
    const compact = generateForest({ seed: 42, extent: "compact" });
    const sizePx = 72;
    const wide = forestFootprintWidthPx(sizePx, roomy);
    const narrow = forestFootprintWidthPx(sizePx, compact);
    assert.ok(roomy.meta.layoutWidth > compact.meta.layoutWidth);
    assert.ok(wide >= sizePx * 1.0, "bosque roomy ocupa más que el cuadrado base");
    assert.ok(wide <= sizePx * 3.2);
    assert.ok(narrow >= sizePx * 0.9);
  });

  it("pickWideForestCenterX coloca bosques anchos en móvil sin acantilados", () => {
    const roomy = generateForest({ seed: 42, roomy: true });
    const spanPx = forestFootprintWidthPx(110, roomy);
    assert.ok(forestNeedsWidePlacement(spanPx, 390));
    let ok = 0;
    for (let s = 0; s < 12; s += 1) {
      const x = pickWideForestCenterX({
        rng: () => (s * 0.073) % 1,
        layerWidthPx: 390,
        spanPx,
        occupiedZones: [],
      });
      assert.ok(x != null);
      assert.ok(x >= 20 && x <= 80, `x=${x} fuera de rango seguro`);
      ok += 1;
    }
    assert.ok(ok >= 10);
  });

  it("buildSceneOccupiedZones usa forestHalfWidthPct cuando está definido", () => {
    const zones = buildSceneOccupiedZones({
      forestX: 30,
      forestSizePx: 70,
      forestHalfWidthPct: 18,
      layerWidthPx: 390,
    });
    assert.equal(zones.length, 1);
    assert.equal(zones[0].halfWidth, 18);
  });

  it("bosque compacto junto a castillo no solapa en simulación", () => {
    const layerWidthPx = 390;
    const forest = generateForest({ seed: 900, extent: "compact" });
    const forestSizePx = 68;
    const forestX = 24;
    const forestHalf = forestFootprintHalfWidthPercent(forestSizePx, forest, layerWidthPx);
    const zones = buildSceneOccupiedZones({
      forestX,
      forestSizePx,
      forestHalfWidthPct: forestHalf,
      layerWidthPx,
    });
    const spanPx = forestFootprintWidthPx(forestSizePx, forest);
    let placed = 0;
    for (let s = 0; s < 40; s++) {
      const x = pickTrioScenePlacementX({
        rng: createRng(s + 9100),
        layerWidthPx,
        selfSizePx: 96,
        occupiedZones: zones,
        minGapFactor: TRIO_CENTER_MIN_GAP_FACTOR,
      });
      if (x == null) continue;
      if (placementOverlapsOccupants(x, 96, layerWidthPx, zones)) continue;
      placed += 1;
      assert.ok(
        !placementOverlapsOccupants(forestX, spanPx, layerWidthPx, [
          { center: x, halfWidth: (96 / 2 / layerWidthPx) * 100 },
        ]),
        `seed ${s}: castillo solapa bosque`,
      );
    }
    assert.ok(placed >= 6);
  });
});
