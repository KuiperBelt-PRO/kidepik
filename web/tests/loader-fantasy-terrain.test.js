import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TERRAIN_CREST_MAX,
  TERRAIN_CREST_MIN,
  TERRAIN_ROUGHNESS_MAX,
  TERRAIN_ROUGHNESS_MIN,
  TERRAIN_SEGMENT_MAX,
  TERRAIN_SEGMENT_MIN,
  buildTerrainPath,
  buildTerrainProfile,
  maxTerrainCrestFromBottomFrac,
  planTerrainSegmentCount,
} from "../js/components/loader-fantasy-terrain.js";
import { createRng } from "../js/components/loader-ship-rng.js";

describe("loader-fantasy-terrain", () => {
  it("planTerrainSegmentCount devuelve 10–18", () => {
    const rng = createRng(42);
    for (let i = 0; i < 60; i += 1) {
      const count = planTerrainSegmentCount(rng);
      assert.ok(count >= TERRAIN_SEGMENT_MIN, `too few: ${count}`);
      assert.ok(count <= TERRAIN_SEGMENT_MAX, `too many: ${count}`);
    }
  });

  it("buildTerrainPath cierra el polígono y abarca el ancho", () => {
    const profile = buildTerrainProfile(createRng(7));
    const d = buildTerrainPath(390, 120, profile);
    assert.ok(d.startsWith("M 0 "), `path start: ${d}`);
    assert.ok(d.endsWith(" Z"), `path end: ${d}`);
    assert.ok(d.includes("L 390.0"), `missing right edge: ${d}`);
    assert.ok(d.includes("120.0"), `missing bottom: ${d}`);
  });

  it("buildTerrainProfile mantiene la cresta en franja llana", () => {
    const profile = buildTerrainProfile(createRng(99));
    const crestYs = profile.map((p) => p.y);
    const minCrest = Math.min(...crestYs);
    const maxCrest = Math.max(...crestYs);
    assert.ok(minCrest >= TERRAIN_CREST_MIN - TERRAIN_ROUGHNESS_MAX);
    assert.ok(maxCrest <= TERRAIN_CREST_MAX + TERRAIN_ROUGHNESS_MAX);
    assert.ok(maxCrest - minCrest <= TERRAIN_ROUGHNESS_MAX * 2 + 0.05);
  });

  it("semillas distintas producen siluetas distintas", () => {
    const a = buildTerrainPath(390, 120, buildTerrainProfile(createRng(1)));
    const b = buildTerrainPath(390, 120, buildTerrainProfile(createRng(2)));
    assert.notEqual(a, b);
  });

  it("buildTerrainPath conserva la forma al reescalar", () => {
    const profile = buildTerrainProfile(createRng(5));
    const narrow = buildTerrainPath(200, 80, profile);
    const wide = buildTerrainPath(400, 160, profile);
    assert.notEqual(narrow, wide);
    assert.equal(
      narrow.replace(/[\d.]+/g, "N"),
      wide.replace(/[\d.]+/g, "N"),
    );
  });

  it("buildTerrainPath devuelve vacío con dimensiones inválidas", () => {
    const profile = buildTerrainProfile(createRng(1));
    assert.equal(buildTerrainPath(0, 120, profile), "");
    assert.equal(buildTerrainPath(390, 0, profile), "");
    assert.equal(buildTerrainPath(390, 120, []), "");
  });

  it("maxTerrainCrestFromBottomFrac está en rango válido", () => {
    const frac = maxTerrainCrestFromBottomFrac();
    const minCrest = 1 - (TERRAIN_CREST_MAX + TERRAIN_ROUGHNESS_MAX);
    const maxCrest = 1 - (TERRAIN_CREST_MIN - TERRAIN_ROUGHNESS_MAX);
    assert.ok(frac >= minCrest && frac <= maxCrest);
  });
});
