import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  effectiveProximityDistance,
  nearestPlanetProximity,
  proximityFade,
  PROXIMITY_INNER_PX,
  PROXIMITY_OUTER_PX,
} from "../js/components/loader-ship-proximity-hud.js";

describe("loader-ship-proximity-hud", () => {
  it("proximityFade es 0 fuera del rango exterior", () => {
    assert.equal(proximityFade(PROXIMITY_OUTER_PX), 0);
    assert.equal(proximityFade(PROXIMITY_OUTER_PX + 40), 0);
  });

  it("proximityFade es 1 dentro del rango interior", () => {
    assert.equal(proximityFade(PROXIMITY_INNER_PX), 1);
    assert.equal(proximityFade(0), 1);
  });

  it("proximityFade interpola linealmente entre inner y outer", () => {
    const mid = (PROXIMITY_INNER_PX + PROXIMITY_OUTER_PX) / 2;
    assert.ok(Math.abs(proximityFade(mid) - 0.5) < 0.001);
  });

  it("effectiveProximityDistance resta radios de nave y planeta", () => {
    const ship = { x: 0, y: 0, radius: 20 };
    const planet = { x: 100, y: 0, radius: 30 };
    assert.equal(effectiveProximityDistance(ship, planet), 50);
  });

  it("nearestPlanetProximity elige el planeta con mayor fade", () => {
    const ship = { x: 200, y: 200, radius: 25 };
    const planets = [
      { id: "far", x: 500, y: 200, radius: 26 },
      { id: "near", x: 260, y: 200, radius: 26 },
    ];
    const match = nearestPlanetProximity(ship, planets);
    assert.ok(match);
    assert.equal(match.planet.id, "near");
    assert.ok(match.fade > 0);
  });

  it("nearestPlanetProximity devuelve null si ningún planeta está cerca", () => {
    const ship = { x: 0, y: 0, radius: 20 };
    const planets = [{ id: "far", x: 900, y: 900, radius: 40 }];
    assert.equal(nearestPlanetProximity(ship, planets), null);
  });
});
