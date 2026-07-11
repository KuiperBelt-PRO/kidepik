import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import {
  LOADER_REVEAL_DELAYS_MS,
  LOADER_REVEAL_ORDER,
  resolveLoaderRevealDelays,
  startLoaderRevealSequence,
} from "../js/components/loader-reveal-sequence.js";

describe("loader-reveal-sequence", () => {
  /** @type {ReturnType<typeof startLoaderRevealSequence> | null} */
  let active = null;

  afterEach(() => {
    active?.destroy();
    active = null;
  });

  /** @returns {HTMLElement} */
  function createSceneStub() {
    const classes = new Set();
    return /** @type {HTMLElement} */ ({
      classList: {
        add: (name) => classes.add(name),
        contains: (name) => classes.has(name),
      },
    });
  }

  it("define el orden bg → logo → ring → fantasy → space", () => {
    assert.deepEqual(LOADER_REVEAL_ORDER, ["bg", "logo", "ring", "fantasy", "space"]);
  });

  it("reduced motion colapsa todos los retrasos a 0", () => {
    const delays = resolveLoaderRevealDelays(true);
    for (const stage of LOADER_REVEAL_ORDER) {
      assert.equal(delays[stage], 0);
    }
  });

  it("emite las etapas en orden con delays personalizados", async () => {
    const scene = createSceneStub();
    /** @type {string[]} */
    const seen = [];

    active = startLoaderRevealSequence(scene, {
      delays: { bg: 0, logo: 5, ring: 10, fantasy: 15, space: 20 },
      onStage: (stage) => seen.push(stage),
    });

    await new Promise((resolve) => setTimeout(resolve, 35));

    assert.deepEqual(seen, LOADER_REVEAL_ORDER);
    for (const stage of LOADER_REVEAL_ORDER) {
      assert.ok(scene.classList.contains(`is-reveal-${stage}`), `falta is-reveal-${stage}`);
    }
  });

  it("destroy cancela etapas pendientes", async () => {
    const scene = createSceneStub();
    /** @type {string[]} */
    const seen = [];

    active = startLoaderRevealSequence(scene, {
      delays: { bg: 0, logo: 40, ring: 80, fantasy: 120, space: 160 },
      onStage: (stage) => seen.push(stage),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    active.destroy();
    active = null;
    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.deepEqual(seen, ["bg"]);
    assert.ok(scene.classList.contains("is-reveal-bg"));
    assert.ok(!scene.classList.contains("is-reveal-space"));
  });

  it("expone delays por defecto crecientes", () => {
    let prev = -1;
    for (const stage of LOADER_REVEAL_ORDER) {
      const delay = LOADER_REVEAL_DELAYS_MS[stage];
      assert.ok(delay >= prev, `${stage} debe ir después de la etapa previa`);
      prev = delay;
    }
  });
});
