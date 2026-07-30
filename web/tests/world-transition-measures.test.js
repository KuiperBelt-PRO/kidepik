import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  measureAuthBrandLogoTarget,
  measureShellBrandLogoTarget,
  measureSectionFrameLogoTarget,
  setOrbitLayoutPaused,
  measureLogoRectAtBand,
  animateWorldBands,
} from "../js/lib/world-transition.js";

describe("world-transition measures", () => {
  it("measureAuthBrandLogoTarget devuelve rect", () => {
    const scene = document.createElement("section");
    document.body.appendChild(scene);
    const rect = measureAuthBrandLogoTarget(scene, { width: 120, height: 40 });
    assert.ok(rect.width > 0);
    assert.ok(rect.height > 0);
    scene.remove();
  });

  it("measureShellBrandLogoTarget devuelve rect", () => {
    const rect = measureShellBrandLogoTarget({ width: 100, height: 30 });
    assert.ok(rect.width > 0);
    assert.ok(rect.height > 0);
  });

  it("measureSectionFrameLogoTarget no lanza con mount", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const rect = measureSectionFrameLogoTarget(mount);
    assert.ok(rect === null || typeof rect.width === "number");
    mount.remove();
  });

  it("setOrbitLayoutPaused toggles clase", () => {
    const scene = document.createElement("section");
    document.body.appendChild(scene);
    setOrbitLayoutPaused(scene, true);
    assert.equal(scene.classList.contains("is-orbit-layout-paused"), true);
    setOrbitLayoutPaused(scene, false);
    assert.equal(scene.classList.contains("is-orbit-layout-paused"), false);
    scene.remove();
  });

  it("measureLogoRectAtBand y animateWorldBands", async () => {
    const scene = document.createElement("section");
    scene.classList.add("scene-loader");
    document.body.appendChild(scene);
    const logo = document.createElement("div");
    logo.style.width = "80px";
    logo.style.height = "30px";
    scene.appendChild(logo);
    Object.defineProperty(logo, "getBoundingClientRect", {
      value: () => ({ left: 10, top: 20, width: 80, height: 30, right: 90, bottom: 50 }),
    });
    const rect = measureLogoRectAtBand(scene, logo, false);
    assert.ok(rect);
    await animateWorldBands(scene, true, 10);
    assert.equal(scene.classList.contains("is-world-band-legal"), true);
    scene.remove();
  });
});
