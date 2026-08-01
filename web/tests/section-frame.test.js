import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register();
}

import { mountSectionFrame } from "../js/components/section-frame.js";

describe("section-frame", () => {
  /** @type {HTMLElement} */
  let host;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(async () => {
    host.remove();
  });

  it("expone titleEl y setTitle actualiza el DOM", async () => {
    const frame = mountSectionFrame(host, { title: "Tripulación", navigation: false });
    assert.ok(frame.titleEl instanceof HTMLHeadingElement);
    assert.equal(frame.titleEl?.textContent, "Tripulación");
    assert.equal(frame.root.getAttribute("aria-labelledby"), frame.titleEl?.id);

    frame.setTitle("Vatardar");
    assert.equal(frame.titleEl?.textContent, "Vatardar");

    const skel = frame.logoMountEl.querySelector(".section-frame__logo-skeleton");
    assert.ok(skel instanceof HTMLElement);
    assert.equal(skel.hidden, false);

    await frame.destroy();
    assert.equal(host.querySelector(".section-frame"), null);
  });

  it("sin title inicial usa aria-label hasta setTitle", async () => {
    const frame = mountSectionFrame(host, { ariaLabel: "Sección", navigation: false });
    assert.equal(frame.titleEl, null);
    assert.equal(frame.root.getAttribute("aria-label"), "Sección");

    frame.setTitle("Cuenta");
    assert.ok(frame.titleEl instanceof HTMLHeadingElement);
    assert.equal(frame.titleEl?.textContent, "Cuenta");
    assert.equal(frame.root.hasAttribute("aria-label"), false);

    await frame.destroy();
  });
});
