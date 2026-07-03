import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateCastle } from "../js/components/loader-fantasy-castle.js";
import {
  castleBuildTimingProfile,
  erosionClipBoundsFromParts,
  erosionClipRectForThreshold,
  svgBoundsFromParts,
} from "../js/components/loader-fantasy-render.js";

describe("loader-fantasy-render / erosion clip", () => {
  const sampleBounds = { x: -60, width: 220, yMin: -10, yMax: 110 };

  it("threshold 0 deja todo el castillo visible", () => {
    const r = erosionClipRectForThreshold(0, sampleBounds);
    assert.equal(r.y, -10);
    assert.equal(r.height, 120);
    assert.equal(r.width, 220);
  });

  it("threshold 1 recorta por completo", () => {
    const r = erosionClipRectForThreshold(1, sampleBounds);
    assert.equal(r.height, 0);
  });

  it("el ancho del clip no cambia con el progreso", () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const r = erosionClipRectForThreshold(t, sampleBounds);
      assert.equal(r.x, -60);
      assert.equal(r.width, 220);
    }
  });

  it("el frente baja solo en Y", () => {
    const a = erosionClipRectForThreshold(0.2, sampleBounds);
    const b = erosionClipRectForThreshold(0.6, sampleBounds);
    assert.ok(b.y > a.y, "el frente debe descender");
    assert.ok(b.height < a.height, "menos área visible");
  });

  it("elfos: el clip cubre todo el zócalo en todas las seeds", () => {
    for (let s = 0; s < 50; s++) {
      const el = generateCastle({ seed: s * 41 + 2, faction: "elf" });
      const bounds = erosionClipBoundsFromParts(el.parts);
      const plinth = el.parts.find((p) => p.role === "plinth");
      assert.ok(plinth, `seed ${s}: sin zócalo`);
      const plinthBounds = svgBoundsFromParts([plinth]);
      assert.ok(
        plinthBounds.minX >= bounds.x && plinthBounds.maxX <= bounds.x + bounds.width,
        `seed ${s}: zócalo [${plinthBounds.minX}, ${plinthBounds.maxX}] fuera de clip [${bounds.x}, ${bounds.x + bounds.width}]`,
      );
    }
  });
});

describe("loader-fantasy-render / castleBuildTimingProfile", () => {
  it("elfos: trazos 30 % más lentos que el perfil base", () => {
    const elf = generateCastle({ seed: 1, faction: "elf" });
    const elfP = castleBuildTimingProfile(elf);
    assert.equal(elfP.strokeFactor, 0.15 * 1.3);
    assert.equal(elfP.strokeMinMs, Math.round(70 * 1.3));
  });

  it("humanos y enanos: bloques 65 % más rápidos", () => {
    const human = generateCastle({ seed: 2, faction: "human" });
    const dwarf = generateCastle({ seed: 2, faction: "dwarf" });
    const evil = generateCastle({ seed: 2, faction: "evil" });
    const fastScale = 1 / 1.65;
    assert.ok(Math.abs(castleBuildTimingProfile(human).fillScale - fastScale) < 1e-9);
    assert.ok(Math.abs(castleBuildTimingProfile(dwarf).fillScale - fastScale) < 1e-9);
    assert.equal(castleBuildTimingProfile(evil).fillScale, 1);
  });
});
