import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeDisplaySize,
  generateShip,
  generateShipForSlot,
  isValidGeneratedShip,
  PROPULSION_STYLES,
} from "../js/components/loader-ship-procedural.js";
import { createRng, hashSeed } from "../js/components/loader-ship-rng.js";

describe("loader-ship-rng", () => {
  it("produce la misma secuencia con la misma seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });

  it("hashSeed es estable por texto", () => {
    assert.equal(hashSeed("alpha:fighter"), hashSeed("alpha:fighter"));
    assert.notEqual(hashSeed("alpha:fighter"), hashSeed("beta:fighter"));
  });
});

describe("loader-ship-procedural", () => {
  it("misma seed y archetype → mismo path", () => {
    const a = generateShip({ seed: 1234, archetype: "fighter", styleHint: "lightCraft" });
    const b = generateShip({ seed: 1234, archetype: "fighter", styleHint: "lightCraft" });
    assert.deepEqual(a.paths, b.paths);
  });

  it("seeds distintas → siluetas distintas", () => {
    const a = generateShip({ seed: 1, archetype: "fighter" });
    const b = generateShip({ seed: 2, archetype: "fighter" });
    assert.notDeepEqual(a.paths, b.paths);
  });

  it("genera paths SVG válidos con área positiva", () => {
    for (const archetype of ["fighter", "interceptor", "gunship", "shuttle"]) {
      const ship = generateShip({ seed: hashSeed(archetype), archetype });
      assert.ok(isValidGeneratedShip(ship), `invalid ship for ${archetype}`);
      assert.ok(ship.paths.length >= 8, `too few layers for ${archetype}`);
    }
  });

  it("generateShipForSlot es determinista con misma rollSeed", () => {
    const a = generateShipForSlot("alpha", 4242);
    const b = generateShipForSlot("alpha", 4242);
    assert.deepEqual(a.paths, b.paths);
    assert.ok(a.archetype);
    assert.ok(a.style);
    assert.ok(a.display.w >= 42);
  });

  it("generateShipForSlot varía entre rollSeeds distintas", () => {
    const a = generateShipForSlot("alpha", 111);
    const b = generateShipForSlot("alpha", 222);
    assert.notDeepEqual(a.paths, b.paths);
  });

  it("slots distintos con misma rollSeed pueden diferir en arquetipo", () => {
    const ids = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
    const archetypes = new Set(ids.map((id) => generateShipForSlot(id, 9001).archetype));
    assert.ok(archetypes.size >= 2, "expected archetype spread across slots");
  });

  it("lengthScale y widthScale cambian la silueta", () => {
    const base = generateShip({ seed: 555, archetype: "gunship", styleHint: "heavyCruiser" });
    const stretched = generateShip({
      seed: 555,
      archetype: "gunship",
      styleHint: "heavyCruiser",
      lengthScale: 1.35,
      widthScale: 0.7,
    });
    assert.notDeepEqual(base.paths, stretched.paths);
  });

  it("computeDisplaySize respeta aspect ratio", () => {
    const ship = generateShip({ seed: 77, archetype: "interceptor", styleHint: "needleScout" });
    const rng = createRng(1);
    const { w, h } = computeDisplaySize(ship, rng, 40);
    assert.ok(w >= 42 && h >= 42);
    assert.notEqual(w, h);
  });

  it("archetypes producen anchuras distintas", () => {
    const gunship = generateShip({ seed: 999, archetype: "gunship", styleHint: "heavyCruiser" });
    const fighter = generateShip({ seed: 999, archetype: "fighter", styleHint: "needleScout" });
    assert.notEqual(gunship.width, fighter.width);
  });

  it("aplica variaciones de propulsión en la popa", () => {
    const seen = new Set();
    for (let i = 0; i < 80; i += 1) {
      const ship = generateShip({ seed: hashSeed(`propulsion-${i}`), archetype: "interceptor" });
      assert.ok(PROPULSION_STYLES.includes(ship.propulsionStyle));
      seen.add(ship.propulsionStyle);
    }
    assert.ok(seen.size >= 4, `expected propulsion spread, got ${[...seen].join(", ")}`);
  });
});
