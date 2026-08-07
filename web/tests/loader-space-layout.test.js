import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LOADER_SPACE_BAND_FRACTION,
  LEGAL_SPACE_BAND_FRACTION,
  measureOrbitLogoCenterY,
  resolveOrbitLayerHeight,
} from "../js/components/loader-space-layout.js";

/**
 * @param {HTMLElement} el
 * @param {{ left?: number; top?: number; width?: number; height?: number }} rect
 */
function mockRect(el, rect) {
  const full = {
    left: rect.left ?? 0,
    top: rect.top ?? 0,
    width: rect.width ?? 100,
    height: rect.height ?? 100,
    right: (rect.left ?? 0) + (rect.width ?? 100),
    bottom: (rect.top ?? 0) + (rect.height ?? 100),
    x: rect.left ?? 0,
    y: rect.top ?? 0,
  };
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ ...full, toJSON: () => full }),
  });
}

describe("loader-space-layout", () => {
  it("measureOrbitLogoCenterY no escala el ancla al comprimir bandas en scene-loader", () => {
    const scene = document.createElement("section");
    scene.className = "scene scene-loader scene-world is-world-band-loader";
    scene.style.height = "800px";
    document.body.appendChild(scene);

    const focal = document.createElement("div");
    focal.className = "loader-focal";
    scene.appendChild(focal);

    const layer = document.createElement("div");
    layer.className = "loader-layer loader-layer--space-orbit";
    scene.appendChild(layer);

  const sceneH = 800;
  const expandedLayerH = sceneH * LOADER_SPACE_BAND_FRACTION;
  const compactLayerH = sceneH * LEGAL_SPACE_BAND_FRACTION;
  const logoCenterY = sceneH * 0.5;

    mockRect(scene, { width: 400, height: sceneH });
    Object.defineProperty(scene, "clientHeight", { configurable: true, value: sceneH });
    mockRect(focal, { top: logoCenterY - 20, width: 40, height: 40 });
    mockRect(layer, { top: 0, width: 400, height: expandedLayerH });
    Object.defineProperty(layer, "clientHeight", { configurable: true, value: expandedLayerH });
    layer.style.height = `${expandedLayerH}px`;

    const expandedY = measureOrbitLogoCenterY(layer);
    assert.ok(Math.abs(expandedY - logoCenterY) < 1, `expandedY=${expandedY}`);

    scene.classList.remove("is-world-band-loader");
    scene.classList.add("is-world-band-legal");
    scene.style.setProperty("--legal-space-band-frac", String(LEGAL_SPACE_BAND_FRACTION));
    mockRect(layer, { top: 0, width: 400, height: compactLayerH });
    Object.defineProperty(layer, "clientHeight", { configurable: true, value: compactLayerH });
    layer.style.height = `${compactLayerH}px`;

    const compactY = measureOrbitLogoCenterY(layer);
    assert.ok(
      Math.abs(compactY - logoCenterY) < 1,
      `compactY=${compactY} debería seguir cerca de ${logoCenterY}`,
    );

    scene.classList.remove("is-world-band-legal");
    scene.classList.add("is-world-band-loader");
    scene.style.setProperty("--legal-space-band-frac", String(LOADER_SPACE_BAND_FRACTION));
    mockRect(layer, { top: 0, width: 400, height: expandedLayerH });
    Object.defineProperty(layer, "clientHeight", { configurable: true, value: expandedLayerH });
    layer.style.height = `${expandedLayerH}px`;

    const reexpandedY = measureOrbitLogoCenterY(layer);
    assert.ok(Math.abs(reexpandedY - logoCenterY) < 1, `reexpandedY=${reexpandedY}`);

    scene.remove();
  });

  it("migra caché legacy orbitAnchorFrac inválida (medida en banda comprimida)", () => {
    const scene = document.createElement("section");
    scene.className = "scene scene-loader scene-world is-world-band-legal";
    scene.style.height = "800px";
    document.body.appendChild(scene);

    const layer = document.createElement("div");
    layer.className = "loader-layer loader-layer--space-orbit";
    layer.dataset.orbitAnchorFrac = "2.08";
    scene.appendChild(layer);

    const sceneH = 800;
    const compactLayerH = sceneH * LEGAL_SPACE_BAND_FRACTION;
    mockRect(scene, { width: 400, height: sceneH });
    Object.defineProperty(scene, "clientHeight", { configurable: true, value: sceneH });
    mockRect(layer, { top: 0, width: 400, height: compactLayerH });
    Object.defineProperty(layer, "clientHeight", { configurable: true, value: compactLayerH });
    layer.style.height = `${compactLayerH}px`;
    scene.style.setProperty("--legal-space-band-frac", String(LEGAL_SPACE_BAND_FRACTION));

    const y = measureOrbitLogoCenterY(layer);
    assert.ok(Math.abs(y - sceneH * 0.5) < 1, `fallback y=${y}`);
    assert.equal(layer.dataset.orbitAnchorFrac, undefined);

    scene.remove();
  });

  it("resolveOrbitLayerHeight prioriza altura CSS", () => {
    const layer = document.createElement("div");
    layer.style.height = "240px";
    document.body.appendChild(layer);
    mockRect(layer, { width: 100, height: 120 });
    Object.defineProperty(layer, "clientHeight", { configurable: true, value: 120 });

    assert.equal(resolveOrbitLayerHeight(layer), 240);
    layer.remove();
  });
});
