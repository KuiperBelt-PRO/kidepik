import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LOGO_MASK_EDGE_PAD,
  LOADER_RING_INNER_RADIUS_FRAC,
  logoMaskRadiusPx,
  measureLogoCenterInLayer,
} from "../js/components/loader-logo-mask.js";

describe("loader-logo-mask", () => {
  it("logoMaskRadiusPx usa el disco interior del anillo, no el focal completo", () => {
    const expected = 260 * LOADER_RING_INNER_RADIUS_FRAC + LOGO_MASK_EDGE_PAD;
    assert.equal(logoMaskRadiusPx(260), expected);
    assert.ok(logoMaskRadiusPx(260) < 260 / 2 + LOGO_MASK_EDGE_PAD);
  });

  it("measureLogoCenterInLayer devuelve el centro del focal en coords de capa", () => {
    const layer = {
      getBoundingClientRect: () => ({ left: 0, top: 400, width: 390, height: 444 }),
    };
    const focal = {
      getBoundingClientRect: () => ({ left: 65, top: 293, width: 260, height: 260 }),
    };

    const center = measureLogoCenterInLayer(layer, focal);
    assert.equal(center.x, 65 + 130);
    assert.equal(center.y, 293 + 130 - 400);
  });
});
