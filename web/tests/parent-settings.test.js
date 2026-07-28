import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createSettingsDebouncer,
  defaultParentSettings,
  mergeParentSettings,
} from "../js/lib/parent-settings.js";

describe("parent-settings", () => {
  it("merge rellena defaults", () => {
    const merged = mergeParentSettings({ ui_theme: "sci-fi" });
    assert.equal(merged.ui_theme, "sci-fi");
    assert.equal(merged.font_scale_ui, "md");
    assert.equal(merged.crew_defaults.max_session_minutes, 10);
  });

  it("defaults tienen schema_version", () => {
    assert.equal(defaultParentSettings().schema_version, 1);
  });

  it("debouncer agrupa patches", async () => {
    /** @type {Record<string, unknown>[]} */
    const calls = [];
    const d = createSettingsDebouncer((patch) => {
      calls.push(patch);
    }, 20);
    d.schedule({ ui_theme: "sci-fi" });
    d.schedule({ font_scale_ui: "lg" });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].ui_theme, "sci-fi");
    assert.equal(calls[0].font_scale_ui, "lg");
  });
});
