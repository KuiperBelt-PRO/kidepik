import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BACKDROP_KINDS,
  BACKDROP_PEAK_Y_MAX,
  BACKDROP_PEAK_Y_MIN,
  BACKDROP_SERRATED_PEAK_Y_MIN,
  BACKDROP_SERRATED_PEAK_Y_MAX,
  BACKDROP_DISTANT_PEAK_Y_MIN,
  BACKDROP_DISTANT_PEAK_Y_MAX,
  BACKDROP_MESA_PEAK_Y_MIN,
  BACKDROP_MESA_PEAK_Y_MAX,
  BACKDROP_VALLEY_Y_MAX,
  BACKDROP_HORIZON_Y_MIN,
  buildBackdropLayers,
  buildBackdropPath,
  buildBackdropProfile,
  buildDistantPeaksProfile,
  buildMesaHorizonProfile,
  buildRollingHillsProfile,
  buildSerratedRangeProfile,
  countLocalPeaks,
  parseBackdropKind,
  pickBackdropKind,
} from "../js/components/loader-fantasy-backdrop.js";
import { createRng } from "../js/components/loader-ship-rng.js";

describe("loader-fantasy-backdrop", () => {
  it("pickBackdropKind devuelve tipos conocidos", () => {
    const kinds = new Set();
    for (let s = 0; s < 40; s++) {
      kinds.add(pickBackdropKind(createRng(s + 3)));
    }
    for (const k of BACKDROP_KINDS) {
      assert.ok(kinds.has(k), `falta tipo ${k}`);
    }
  });

  it("parseBackdropKind valida query dev", () => {
    assert.equal(parseBackdropKind("rolling_hills"), "rolling_hills");
    assert.equal(parseBackdropKind("invalid"), undefined);
  });

  it("buildBackdropPath cierra y abarca el ancho", () => {
    const profile = buildRollingHillsProfile(createRng(8));
    const d = buildBackdropPath(390, 220, profile);
    assert.ok(d.startsWith("M 0 "), d);
    assert.ok(d.endsWith(" Z"), d);
    assert.ok(d.includes("L 390.0"), d);
    assert.ok(d.includes("220.0"), d);
  });

  it("perfiles mantienen picos bajos y en franja válida", () => {
    const builders = [
      buildRollingHillsProfile,
      buildDistantPeaksProfile,
      buildSerratedRangeProfile,
      buildMesaHorizonProfile,
    ];
    for (const build of builders) {
      const profile = build(createRng(21));
      assert.ok(profile.length >= 20, `perfil demasiado simple (${profile.length} pts)`);
      for (const p of profile) {
        assert.ok(p.y >= BACKDROP_PEAK_Y_MIN - 0.02, `y bajo mínimo: ${p.y}`);
        assert.ok(p.y <= BACKDROP_VALLEY_Y_MAX, `y fuera de rango: ${p.y}`);
      }
      const peakYs = profile.map((p) => p.y);
      const minY = Math.min(...peakYs);
      assert.ok(minY < BACKDROP_HORIZON_Y_MIN - 0.04, `sin relieve visible (minY=${minY})`);
      assert.ok(minY >= BACKDROP_PEAK_Y_MIN - 0.04, `demasiado alto (minY=${minY})`);
    }
  });

  it("cada tipo produce siluetas distintas", () => {
    const rng = createRng(5);
    const paths = BACKDROP_KINDS.map((kind) => {
      const profile = buildBackdropProfile(rng, kind);
      return buildBackdropPath(400, 200, profile);
    });
    const unique = new Set(paths);
    assert.equal(unique.size, BACKDROP_KINDS.length);
  });

  it("layered_hills genera tres planos", () => {
    const layers = buildBackdropLayers(createRng(12), "layered_hills");
    assert.equal(layers.length, 3);
    assert.ok(layers[0].opacity < layers[2].opacity);
  });

  it("semillas distintas producen paths distintos", () => {
    const a = buildBackdropPath(390, 200, buildBackdropProfile(createRng(1), "distant_peaks"));
    const b = buildBackdropPath(390, 200, buildBackdropProfile(createRng(2), "distant_peaks"));
    assert.notEqual(a, b);
  });

  it("buildBackdropPath devuelve vacío con dimensiones inválidas", () => {
    const profile = buildRollingHillsProfile(createRng(1));
    assert.equal(buildBackdropPath(0, 200, profile), "");
    assert.equal(buildBackdropPath(390, 0, profile), "");
    assert.equal(buildBackdropPath(390, 200, []), "");
  });

  it("serrated_range no genera agujas altas ni demasiados picos", () => {
    for (let s = 0; s < 40; s++) {
      const profile = buildSerratedRangeProfile(createRng(s + 300));
      const peaks = countLocalPeaks(profile);
      const minY = Math.min(...profile.map((p) => p.y));
      assert.ok(peaks <= 9, `seed ${s}: demasiados picos (${peaks})`);
      assert.ok(minY >= BACKDROP_SERRATED_PEAK_Y_MIN - 0.02, `seed ${s}: picos demasiado altos (${minY})`);
      assert.ok(minY <= BACKDROP_SERRATED_PEAK_Y_MAX + 0.04, `seed ${s}: picos fuera de techo (${minY})`);
    }
  });

  it("distant_peaks quedan bajo el cielo (50 % de relieve)", () => {
    for (let s = 0; s < 30; s++) {
      const profile = buildDistantPeaksProfile(createRng(s + 500));
      const minY = Math.min(...profile.map((p) => p.y));
      assert.ok(minY >= BACKDROP_DISTANT_PEAK_Y_MIN - 0.02, `seed ${s}: demasiado alto (${minY})`);
      assert.ok(minY <= BACKDROP_DISTANT_PEAK_Y_MAX + 0.04, `seed ${s}: demasiado bajo (${minY})`);
    }
  });

  it("mesa_horizon mantiene mesetas bajas (50 % de relieve)", () => {
    for (let s = 0; s < 30; s++) {
      const profile = buildMesaHorizonProfile(createRng(s + 700));
      const ridgeYs = profile.filter((p) => p.y < BACKDROP_HORIZON_Y_MIN).map((p) => p.y);
      assert.ok(ridgeYs.length > 0, `seed ${s}: sin mesetas`);
      const minY = Math.min(...ridgeYs);
      assert.ok(minY >= BACKDROP_MESA_PEAK_Y_MIN - 0.02, `seed ${s}: mesa demasiado alta (${minY})`);
      assert.ok(minY <= BACKDROP_MESA_PEAK_Y_MAX + 0.04, `seed ${s}: mesa fuera de techo (${minY})`);
    }
  });
});
