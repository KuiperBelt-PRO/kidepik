import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

/** @type {Map<string, string>} */
const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
  };
  globalThis.document = {
    documentElement: { dataset: {} },
    body: { classList: { remove() {} } },
  };
});

import { getThemeId, initTheme } from "../js/lib/theme.js";

describe("theme", () => {
  it("default fantasy sin storage", () => {
    assert.equal(getThemeId(), "fantasy");
  });

  it("lee spaceOpera del storage", () => {
    localStorage.setItem("kidepik-theme", "spaceOpera");
    assert.equal(getThemeId(), "spaceOpera");
  });

  it("initTheme aplica dataset", () => {
    localStorage.setItem("kidepik-theme", "spaceOpera");
    initTheme();
    assert.equal(document.documentElement.dataset.theme, "spaceOpera");
  });
});
