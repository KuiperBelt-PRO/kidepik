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
  };
});

import {
  defaultParentSettings,
  mergeParentSettings,
  applyParentSettingsToDom,
  cacheParentSettingsLocal,
  readCachedParentSettings,
  createSettingsDebouncer,
} from "../js/lib/parent-settings.js";

describe("parent-settings extended", () => {
  it("merge profundo conserva defaults", () => {
    const merged = mergeParentSettings({ ui_theme: "sci-fi", learning: { pause_adaptation: true } });
    assert.equal(merged.ui_theme, "sci-fi");
    assert.equal(merged.learning.pause_adaptation, true);
    assert.equal(merged.crew_defaults.session_limit_per_day, 3);
  });

  it("applyParentSettingsToDom actualiza dataset", () => {
    const s = defaultParentSettings();
    s.font_scale_ui = "lg";
    s.ui_theme = "sci-fi";
    applyParentSettingsToDom(s);
    assert.equal(document.documentElement.dataset.fontScaleUi, "lg");
  });

  it("cache y read local", () => {
    const s = defaultParentSettings();
    cacheParentSettingsLocal(s);
    const read = readCachedParentSettings();
    assert.equal(read?.ui_theme, "fantasy");
  });

  it("debouncer agrupa patches", async () => {
    const calls = [];
    const deb = createSettingsDebouncer((p) => calls.push(p), 30);
    deb.schedule({ ui_theme: "sci-fi" });
    deb.schedule({ font_scale_ui: "xl" });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].ui_theme, "sci-fi");
    assert.equal(calls[0].font_scale_ui, "xl");
  });

  it("debouncer flush inmediato", () => {
    const calls = [];
    const deb = createSettingsDebouncer((p) => calls.push(p), 1000);
    deb.schedule({ ui_theme: "sci-fi" });
    deb.flush();
    assert.equal(calls.length, 1);
  });
});
