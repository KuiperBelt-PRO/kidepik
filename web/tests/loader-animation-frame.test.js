import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import {
  loaderAnimationFrameSubscriberCount,
  resetLoaderAnimationFrameForTests,
  subscribeLoaderAnimationFrame,
} from "../js/components/loader-animation-frame.js";

describe("loader-animation-frame", () => {
  afterEach(() => {
    resetLoaderAnimationFrameForTests();
  });

  it("subscribe incrementa y unsubscribe limpia", () => {
    assert.equal(loaderAnimationFrameSubscriberCount(), 0);
    const off = subscribeLoaderAnimationFrame(() => {});
    assert.equal(loaderAnimationFrameSubscriberCount(), 1);
    off();
    assert.equal(loaderAnimationFrameSubscriberCount(), 0);
  });

  it("varios suscriptores coexisten", () => {
    const offA = subscribeLoaderAnimationFrame(() => {});
    const offB = subscribeLoaderAnimationFrame(() => {});
    assert.equal(loaderAnimationFrameSubscriberCount(), 2);
    offA();
    assert.equal(loaderAnimationFrameSubscriberCount(), 1);
    offB();
    assert.equal(loaderAnimationFrameSubscriberCount(), 0);
  });
});
