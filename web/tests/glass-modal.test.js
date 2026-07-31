import { GlobalRegistrator } from "@happy-dom/global-registrator";
import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

GlobalRegistrator.register();

import {
  closeGlassModal,
  showGlassAlert,
  showGlassConfirm,
  syncGlassModalBodyScrollFade,
} from "../js/components/glass-modal.js";

describe("glass-modal", () => {
  afterEach(() => {
    closeGlassModal();
    document.body.replaceChildren();
  });

  it("showGlassAlert monta diálogo con un botón", async () => {
    const promise = showGlassAlert({
      title: "Aviso",
      body: "<p>Texto</p>",
      okLabel: "OK",
    });
    const modal = document.querySelector(".glass-modal");
    assert.ok(modal instanceof HTMLElement);
    const body = modal.querySelector(".glass-modal__body");
    assert.ok(body instanceof HTMLElement);
    assert.equal(body.classList.contains("glass-scroll-fade"), false);
    assert.equal(modal.querySelectorAll(".crew-panel__btn").length, 1);
    const btn = modal.querySelector(".crew-panel__btn");
    if (btn instanceof HTMLButtonElement) btn.click();
    await promise;
    assert.equal(document.querySelector(".glass-modal"), null);
  });

  it("syncGlassModalBodyScrollFade añade fade solo con overflow", () => {
    const el = document.createElement("div");
    el.className = "glass-modal__body";
    document.body.appendChild(el);

    Object.defineProperty(el, "clientHeight", { configurable: true, value: 80 });
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: 80 });
    syncGlassModalBodyScrollFade(el);
    assert.equal(el.classList.contains("glass-scroll-fade"), false);

    Object.defineProperty(el, "scrollHeight", { configurable: true, value: 160 });
    syncGlassModalBodyScrollFade(el);
    assert.equal(el.classList.contains("glass-scroll-fade"), true);

    Object.defineProperty(el, "scrollHeight", { configurable: true, value: 80 });
    syncGlassModalBodyScrollFade(el);
    assert.equal(el.classList.contains("glass-scroll-fade"), false);
  });

  it("showGlassAlert largo aplica fade cuando hay scroll", async () => {
    const promise = showGlassAlert({
      title: "Largo",
      size: "sm",
      body: "<p>1</p><p>2</p><p>3</p><p>4</p><p>5</p><p>6</p><p>7</p><p>8</p>",
    });
    const body = document.querySelector(".glass-modal__body");
    assert.ok(body instanceof HTMLElement);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (body.scrollHeight > body.clientHeight + 1) {
      assert.equal(body.classList.contains("glass-scroll-fade"), true);
    }
    const btn = document.querySelector(".glass-modal .crew-panel__btn");
    if (btn instanceof HTMLButtonElement) btn.click();
    await promise;
  });

  it("showGlassConfirm resuelve true al confirmar", async () => {
    const promise = showGlassConfirm({
      title: "¿Continuar?",
      body: "<p>Demo</p>",
    });
    const buttons = document.querySelectorAll(".glass-modal .crew-panel__btn");
    assert.equal(buttons.length, 2);
    const confirm = buttons[1];
    if (confirm instanceof HTMLButtonElement) confirm.click();
    assert.equal(await promise, true);
  });

  it("showGlassConfirm resuelve false al cancelar", async () => {
    const promise = showGlassConfirm({
      title: "¿Continuar?",
    });
    const cancel = document.querySelector(".glass-modal .crew-panel__btn");
    if (cancel instanceof HTMLButtonElement) cancel.click();
    assert.equal(await promise, false);
  });
});
