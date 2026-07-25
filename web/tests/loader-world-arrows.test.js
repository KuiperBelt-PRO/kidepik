import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ARROW_DIRECTIONS,
  ARROW_THEMES,
  renderWorldArrowFabSvgInner,
} from "../js/components/loader-world-arrows.js";

/**
 * @param {string} svgInner
 * @returns {string[]}
 */
function pathDs(svgInner) {
  const matches = [...svgInner.matchAll(/d="([^"]+)"/g)];
  return matches.map((m) => m[1]);
}

describe("loader-world-arrows", () => {
  it("expone 8 direcciones y 2 temas", () => {
    assert.equal(ARROW_DIRECTIONS.length, 8);
    assert.equal(ARROW_THEMES.length, 2);
  });

  it("renderWorldArrowFabSvgInner genera paths válidos para todas las variantes", () => {
    for (const theme of ARROW_THEMES) {
      for (const direction of ARROW_DIRECTIONS) {
        const html = renderWorldArrowFabSvgInner({ theme, direction, viewSize: 40 });
        const glyphs = pathDs(html);
        assert.ok(glyphs.length >= 1, `${theme}/${direction}`);
        for (const d of glyphs) {
          assert.match(d, /^M /);
          assert.match(d, / Z$/);
        }
      }
    }
  });

  it("sci-fi usa doble chevron y fantasía una sola pieza", () => {
    const sciFi = pathDs(renderWorldArrowFabSvgInner({ theme: "sci-fi", direction: "right", viewSize: 100 }));
    const fantasy = pathDs(renderWorldArrowFabSvgInner({ theme: "fantasy", direction: "right", viewSize: 100 }));
    assert.equal(sciFi.length, 2);
    assert.equal(fantasy.length, 1);
    assert.notEqual(sciFi.join("|"), fantasy.join("|"));
  });

  it("left y right son simétricos en sci-fi (misma longitud de path)", () => {
    const right = pathDs(renderWorldArrowFabSvgInner({ theme: "sci-fi", direction: "right", viewSize: 100 }));
    const left = pathDs(renderWorldArrowFabSvgInner({ theme: "sci-fi", direction: "left", viewSize: 100 }));
    assert.equal(right.length, left.length);
    const rightLen = right.reduce((n, d) => n + d.length, 0);
    const leftLen = left.reduce((n, d) => n + d.length, 0);
    assert.ok(Math.abs(rightLen - leftLen) < 8);
  });

  it("fill por defecto es blanco y acepta override", () => {
    const def = renderWorldArrowFabSvgInner({ theme: "fantasy", direction: "up", viewSize: 40 });
    assert.match(def, /fill="#fff"/);
    const custom = renderWorldArrowFabSvgInner({
      theme: "fantasy",
      direction: "up",
      viewSize: 40,
      fill: "#0f0",
    });
    assert.match(custom, /fill="#0f0"/);
  });
});
