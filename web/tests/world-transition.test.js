import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  captureRect,
  prepareWorldTransition,
  consumeWorldTransition,
  peekWorldTransition,
  pinLogoAtRect,
  clearLogoPinStyles,
  setWorldBandLayout,
} from "../js/lib/world-transition.js";

describe("world-transition", () => {
  it("captureRect ignora elementos vacíos", () => {
    assert.equal(captureRect(null), null);
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.style.width = "0px";
    el.style.height = "0px";
    assert.equal(captureRect(el), null);
    el.remove();
  });

  it("captureRect devuelve rect válido", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    Object.defineProperty(el, "getBoundingClientRect", {
      value: () => ({ left: 10, top: 20, width: 100, height: 40, right: 110, bottom: 60 }),
    });
    const rect = captureRect(el);
    assert.deepEqual(rect, { left: 10, top: 20, width: 100, height: 40 });
    el.remove();
  });

  it("prepare/consume/peek transición", () => {
    prepareWorldTransition({ from: "home" }, { to: "settings" });
    const peek = peekWorldTransition();
    assert.equal(peek.intent?.to, "settings");
    const consumed = consumeWorldTransition();
    assert.equal(consumed.intent?.to, "settings");
    assert.equal(peekWorldTransition().intent, null);
  });

  it("pin y clear logo styles", () => {
    const el = document.createElement("div");
    pinLogoAtRect(el, { left: 5, top: 6, width: 50, height: 30 });
    assert.equal(el.style.position, "fixed");
    clearLogoPinStyles(el);
    assert.equal(el.style.position, "");
  });

  it("setWorldBandLayout comprime bandas", () => {
    const scene = document.createElement("section");
    setWorldBandLayout(scene, true);
    assert.equal(scene.classList.contains("is-world-band-legal"), true);
    setWorldBandLayout(scene, false);
    assert.equal(scene.classList.contains("is-world-band-legal"), false);
  });
});
