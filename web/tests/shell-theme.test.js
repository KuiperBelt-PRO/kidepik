import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  DEFAULT_SHELL_UI_THEME,
  SHELL_UI_THEME_STORAGE_KEY,
  applyShellUiTheme,
  getShellUiTheme,
  setShellUiTheme,
  toggleShellUiTheme,
} from "../js/lib/shell-theme.js";

/** @type {Map<string, string>} */
const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
  globalThis.document = {
    documentElement: {
      dataset: {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.dispatchEvent = () => true;
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
});

describe("shell-theme", () => {
  it("default es fantasy", () => {
    assert.equal(DEFAULT_SHELL_UI_THEME, "fantasy");
    assert.equal(getShellUiTheme(), "fantasy");
  });

  it("setShellUiTheme persiste y aplica data-shell-theme", () => {
    setShellUiTheme("sci-fi");
    assert.equal(getShellUiTheme(), "sci-fi");
    assert.equal(store.get(SHELL_UI_THEME_STORAGE_KEY), "sci-fi");
    assert.equal(document.documentElement.dataset.shellTheme, "sci-fi");
  });

  it("ignora valores inválidos al leer", () => {
    store.set(SHELL_UI_THEME_STORAGE_KEY, "neon");
    assert.equal(getShellUiTheme(), "fantasy");
  });

  it("toggleShellUiTheme alterna sci-fi ↔ fantasy", () => {
    applyShellUiTheme("fantasy");
    assert.equal(toggleShellUiTheme(), "sci-fi");
    assert.equal(toggleShellUiTheme(), "fantasy");
  });

  it("subscribeShellUiTheme recibe eventos", async () => {
    const { subscribeShellUiTheme, SHELL_UI_THEME_CHANGE_EVENT } = await import("../js/lib/shell-theme.js");
    let seen = null;
    const listeners = [];
    globalThis.addEventListener = (type, fn) => listeners.push({ type, fn });
    globalThis.removeEventListener = (type, fn) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    };
    globalThis.dispatchEvent = (event) => {
      listeners.filter((l) => l.type === event.type).forEach((l) => l.fn(event));
      return true;
    };
    const off = subscribeShellUiTheme((t) => { seen = t; });
    globalThis.dispatchEvent(new CustomEvent(SHELL_UI_THEME_CHANGE_EVENT, { detail: { theme: "sci-fi" } }));
    assert.equal(seen, "sci-fi");
    off();
  });
});
