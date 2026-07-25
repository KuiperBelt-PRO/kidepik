import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ARROW_DIRECTIONS,
  ARROW_THEMES,
  buildWorldArrowCatalog,
  buildWorldArrowGlyphGroups,
  generateWorldArrowFab,
  generateWorldArrowGlyph,
  generateWorldArrowGlyphPaths,
  pointsToPath,
  rotatePoints,
} from "../js/components/loader-world-arrows.js";

describe("loader-world-arrows", () => {
  it("expone 8 direcciones y 2 temas", () => {
    assert.equal(ARROW_DIRECTIONS.length, 8);
    assert.equal(ARROW_THEMES.length, 2);
  });

  it("genera paths SVG válidos para todas las variantes", () => {
    const catalog = buildWorldArrowCatalog(40);
    assert.equal(Object.keys(catalog).length, 16);
    for (const key of Object.keys(catalog)) {
      const { glyphs } = catalog[key];
      assert.ok(glyphs.length >= 1);
      for (const d of glyphs) {
        assert.match(d, /^M /);
        assert.match(d, / Z$/);
      }
    }
  });

  it("sci-fi usa doble chevron y fantasía una sola pieza", () => {
    const sciFi = generateWorldArrowGlyphPaths("sci-fi", "right", 100);
    const fantasy = generateWorldArrowGlyphPaths("fantasy", "right", 100);
    assert.equal(sciFi.length, 2);
    assert.equal(fantasy.length, 1);
    assert.notEqual(sciFi.join("|"), fantasy.join("|"));
  });

  it("left y right son simétricos en sci-fi (misma área aproximada)", () => {
    const areaOf = (paths) =>
      paths.reduce((sum, pts) => {
        let a = 0;
        for (let i = 0; i < pts.length; i += 1) {
          const p = pts[i];
          const q = pts[(i + 1) % pts.length];
          a += p.x * q.y - q.x * p.y;
        }
        return sum + Math.abs(a) / 2;
      }, 0);

    const right = buildWorldArrowGlyphGroups("sci-fi", "right", 100);
    const left = buildWorldArrowGlyphGroups("sci-fi", "left", 100);
    assert.ok(Math.abs(areaOf(right) - areaOf(left)) < 4);
  });

  it("rotar 180° devuelve la misma forma que direction left", () => {
    const rotated = rotatePoints(buildWorldArrowGlyphGroups("fantasy", "right", 100)[0], 50, 50, 180);
    const left = buildWorldArrowGlyphGroups("fantasy", "left", 100)[0];
    assert.equal(pointsToPath(rotated), pointsToPath(left));
  });

  it("generateWorldArrowFab solo devuelve glifos", () => {
    const fab = generateWorldArrowFab("fantasy", "up", 40);
    assert.equal(fab.glyphs.length, 1);
    assert.equal(fab.viewSize, 40);
    assert.equal(generateWorldArrowGlyph("fantasy", "up", 40), fab.glyphs[0]);
  });
});
