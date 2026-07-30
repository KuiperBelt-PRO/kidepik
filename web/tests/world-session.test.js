import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  getWorldSession,
  registerWorldSession,
  destroyWorldSession,
  isWorldRouteHash,
  worldLayersHaveFantasyMounted,
  worldLayersHaveSpaceMounted,
  attachWorldLayersTo,
  detachWorldLayers,
} from "../js/lib/world-session.js";

function mockLayers() {
  const layers = {
    isConnected: true,
    classList: {
      _c: new Set(),
      add(...xs) { xs.forEach((x) => this._c.add(x)); },
      remove(...xs) { xs.forEach((x) => this._c.delete(x)); },
      toggle(x, v) { if (v) this._c.add(x); else this._c.delete(x); },
      contains(x) { return this._c.has(x); },
    },
    remove() { this.isConnected = false; },
    insertBefore() {},
    contains() { return false; },
    querySelector(sel) {
      if (sel === ".loader-layer--fantasy-scene") return { tag: "fantasy" };
      if (sel === ".loader-layer--space-orbit") return { tag: "orbit" };
      return null;
    },
    offsetWidth: 1,
  };
  layers.isConnected = true;
  return layers;
}

describe("world-session", () => {
  beforeEach(() => {
    destroyWorldSession();
  });

  it("isWorldRouteHash reconoce rutas mundo", () => {
    assert.equal(isWorldRouteHash("#/loader"), true);
    assert.equal(isWorldRouteHash("#/home"), true);
    assert.equal(isWorldRouteHash("#/crew/new"), true);
    assert.equal(isWorldRouteHash("#/legal/terminos"), true);
    assert.equal(isWorldRouteHash("#/play"), false);
  });

  it("register y destroy sesión", () => {
    const layers = mockLayers();
    registerWorldSession({
      layers,
      ownerScene: null,
      teardownLogoMaskSync: () => {},
      spaceOrbitTeardown: null,
      meteorTeardown: null,
      fantasyBackdropTeardown: null,
      fantasyTerrainTeardown: null,
      fantasyCloudsTeardown: null,
      fantasyCelestialTeardown: null,
      fantasySceneTeardown: null,
      fantasyLayersMounted: false,
      spaceLayersMounted: false,
    });
    assert.ok(getWorldSession()?.layers === layers);
    destroyWorldSession();
    assert.equal(getWorldSession(), null);
  });

  it("detecta capas fantasy y space montadas", () => {
    const layers = document.createElement("div");
    layers.innerHTML =
      '<div class="loader-layer--fantasy-scene"></div><div class="loader-layer--meteor-shower"></div>';
    assert.equal(worldLayersHaveFantasyMounted(layers), true);
    assert.equal(worldLayersHaveSpaceMounted(layers), true);
  });

  it("attach y detach capas en escena", () => {
    const layers = document.createElement("div");
    const scene = document.createElement("section");
    registerWorldSession({
      layers,
      ownerScene: null,
      teardownLogoMaskSync: () => {},
      spaceOrbitTeardown: null,
      meteorTeardown: null,
      fantasyBackdropTeardown: null,
      fantasyTerrainTeardown: null,
      fantasyCloudsTeardown: null,
      fantasyCelestialTeardown: null,
      fantasySceneTeardown: null,
      fantasyLayersMounted: false,
      spaceLayersMounted: false,
    });
    assert.equal(attachWorldLayersTo(scene), true);
    assert.equal(scene.contains(layers), true);
    detachWorldLayers();
    assert.equal(scene.contains(layers), false);
    destroyWorldSession();
  });
});
