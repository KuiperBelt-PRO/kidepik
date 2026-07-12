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
  sampleTerrainCrestYNorm,
  terrainCrestOffsetPx,
  computeTreeScreenXPercent,
  computeTreeTerrainLiftSvg,
  computeElementTerrainLiftSvg,
  computePortalGroundBottomPx,
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

  it("sampleTerrainCrestYNorm interpola entre puntos", () => {
    const profile = [
      { x: 0, y: 0.4 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0.6 },
    ];
    assert.equal(sampleTerrainCrestYNorm(profile, 0), 0.4);
    assert.equal(sampleTerrainCrestYNorm(profile, 1), 0.6);
    assert.ok(Math.abs(sampleTerrainCrestYNorm(profile, 0.5) - 0.5) < 0.01);
  });

  it("terrainCrestOffsetPx aumenta cuando la cresta sube", () => {
    const low = [{ x: 0, y: 0.6 }, { x: 1, y: 0.6 }];
    const high = [{ x: 0, y: 0.35 }, { x: 1, y: 0.35 }];
    const offLow = terrainCrestOffsetPx(low, 50, 48);
    const offHigh = terrainCrestOffsetPx(high, 50, 48);
    assert.ok(offHigh > offLow);
  });

  it("computeTreeTerrainLiftSvg alinea la base del árbol con la cresta", () => {
    const profile = [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }];
    const crestPx = terrainCrestOffsetPx(profile, 50, 48);
    const pivotYAligned = 100 - (crestPx / 96) * 100;
    const lift = computeTreeTerrainLiftSvg(profile, 50, 50, pivotYAligned, 96, 390, 48);
    assert.ok(Math.abs(lift) < 0.5, "base alineada con cresta → lift ~0");
    const liftHigh = computeTreeTerrainLiftSvg(profile, 50, 50, 92, 96, 390, 48);
    assert.ok(liftHigh > 0, "árbol con base por encima del suelo necesita lift positivo");
  });

  it("computePortalGroundBottomPx apoya portal con ligero hundimiento", () => {
    const profile = [{ x: 0, y: 0.45 }, { x: 1, y: 0.45 }];
    const crestPx = terrainCrestOffsetPx(profile, 40, 48);
    const bottom = computePortalGroundBottomPx(profile, 40, 100, 72, 48);
    assert.ok(bottom > 0);
    assert.ok(bottom < crestPx, "no debe flotar por encima de la cresta");
    const liftSvg = computeElementTerrainLiftSvg(profile, 40, 100, 72, 48);
    assert.ok(bottom < (liftSvg / 100) * 72, "menos elevación que el lift SVG bruto");
  });

  it("computeTreeScreenXPercent desplaza según pivot en viewBox", () => {
    assert.ok(computeTreeScreenXPercent(50, 70, 100, 400) > 50);
    assert.ok(computeTreeScreenXPercent(50, 30, 100, 400) < 50);
  });
});
