import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register();
}

import {
  inferLogoRevealState,
  isLogoAssetReady,
  syncLogoRevealState,
} from "../js/lib/logo-reveal.js";

/**
 * @returns {HTMLElement}
 */
function makeLogoWrap() {
  const wrap = document.createElement("div");
  wrap.className = "loader-logo-wrap";
  const img = document.createElement("img");
  img.className = "loader-logo";
  img.alt = "KidepiK";
  img.hidden = true;
  const fallback = document.createElement("p");
  fallback.className = "loader-logo-fallback";
  fallback.textContent = "KidepiK";
  fallback.hidden = true;
  wrap.append(img, fallback);
  return wrap;
}

describe("logo-reveal", () => {
  it("pending oculta img y fallback", () => {
    const wrap = makeLogoWrap();
    const img = wrap.querySelector(".loader-logo");
    const fallback = wrap.querySelector(".loader-logo-fallback");
    if (img instanceof HTMLImageElement) {
      img.hidden = false;
      img.setAttribute("src", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
    }
    if (fallback instanceof HTMLElement) fallback.hidden = false;

    syncLogoRevealState(wrap, "pending");
    assert.equal(wrap.classList.contains("is-logo-pending"), true);
    assert.equal(wrap.classList.contains("is-ready"), false);
    assert.equal(img instanceof HTMLElement && img.hidden, true);
    assert.equal(fallback instanceof HTMLElement && fallback.hidden, true);
  });

  it("ready muestra img y marca is-ready", () => {
    const wrap = makeLogoWrap();
    const img = wrap.querySelector(".loader-logo");
    if (img instanceof HTMLImageElement) {
      img.setAttribute("src", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
      Object.defineProperty(img, "complete", { configurable: true, get: () => true });
      Object.defineProperty(img, "naturalWidth", { configurable: true, get: () => 1 });
    }

    syncLogoRevealState(wrap, "ready");
    assert.equal(wrap.classList.contains("is-logo-ready"), true);
    assert.equal(wrap.classList.contains("is-ready"), true);
    assert.equal(wrap.classList.contains("is-logo-pending"), false);
    assert.equal(img instanceof HTMLElement && img.hidden, false);
  });

  it("error muestra solo fallback", () => {
    const wrap = makeLogoWrap();
    syncLogoRevealState(wrap, "error");
    const img = wrap.querySelector(".loader-logo");
    const fallback = wrap.querySelector(".loader-logo-fallback");
    assert.equal(wrap.classList.contains("is-logo-error"), true);
    assert.equal(img instanceof HTMLElement && img.hidden, true);
    assert.equal(fallback instanceof HTMLElement && fallback.hidden, false);
  });

  it("isLogoAssetReady exige src + decode", () => {
    const wrap = makeLogoWrap();
    assert.equal(isLogoAssetReady(wrap), false);
    const img = wrap.querySelector(".loader-logo");
    if (!(img instanceof HTMLImageElement)) throw new Error("missing img");
    img.setAttribute("src", "x.png");
    Object.defineProperty(img, "complete", { configurable: true, get: () => true });
    Object.defineProperty(img, "naturalWidth", { configurable: true, get: () => 12 });
    assert.equal(isLogoAssetReady(wrap), true);
  });

  it("inferLogoRevealState distingue pending/ready/error", () => {
    const wrap = makeLogoWrap();
    assert.equal(inferLogoRevealState(wrap), "pending");
    wrap.classList.add("is-logo-error");
    assert.equal(inferLogoRevealState(wrap), "error");
  });
});
