import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SHELL_UI_ICON_IDS,
  SHELL_UI_ICON_THEMES,
  renderShellUiIconSvgInner,
} from "../js/components/shell-ui-icons.js";

/**
 * @param {string} svgInner
 * @returns {string[]}
 */
function pathDs(svgInner) {
  const matches = [...svgInner.matchAll(/d="([^"]+)"/g)];
  return matches.map((m) => m[1]);
}

describe("shell-ui-icons", () => {
  it("expone catálogo de ids y 2 temas", () => {
    assert.ok(SHELL_UI_ICON_IDS.length >= 10);
    assert.deepEqual([...SHELL_UI_ICON_THEMES], ["sci-fi", "fantasy"]);
  });

  it("renderShellUiIconSvgInner genera paths válidos para todas las variantes", () => {
    for (const theme of SHELL_UI_ICON_THEMES) {
      for (const id of SHELL_UI_ICON_IDS) {
        const html = renderShellUiIconSvgInner({ id, theme, viewSize: 40 });
        const glyphs = pathDs(html);
        assert.ok(glyphs.length >= 1, `${theme}/${id}`);
        for (const d of glyphs) {
          assert.match(d, /^M /);
        }
      }
    }
  });

  it("sci-fi y fantasy producen path distinto en menu y account", () => {
    for (const id of /** @type {const} */ (["menu", "account", "home", "crew"])) {
      const sci = renderShellUiIconSvgInner({ id, theme: "sci-fi", viewSize: 100 });
      const fantasy = renderShellUiIconSvgInner({ id, theme: "fantasy", viewSize: 100 });
      assert.notEqual(sci, fantasy, id);
    }
  });

  it("fill por defecto es blanco y acepta override", () => {
    const def = renderShellUiIconSvgInner({ id: "settings", theme: "fantasy", viewSize: 40 });
    assert.match(def, /fill="#fff"/);
    const custom = renderShellUiIconSvgInner({
      id: "settings",
      theme: "fantasy",
      viewSize: 40,
      fill: "#0f0",
    });
    assert.match(custom, /fill="#0f0"/);
  });

  it("es determinista", () => {
    const a = renderShellUiIconSvgInner({ id: "legal", theme: "sci-fi", viewSize: 40 });
    const b = renderShellUiIconSvgInner({ id: "legal", theme: "sci-fi", viewSize: 40 });
    assert.equal(a, b);
  });
});
